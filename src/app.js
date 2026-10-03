require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('./middleware/auth');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// 1. Health check (Mục 4)
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'UP',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ status: 'DOWN', database: 'disconnected', error: error.message });
  }
});

// 2. Auth: Đăng ký (Mục 6: Tự động Role normal + MemberShip score 10)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, fullname, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Thiếu username hoặc password' });
    }

    // Đảm bảo có role 'normal'
    let normalRole = await prisma.role.findFirst({ where: { rolename: 'normal' } });
    if (!normalRole) {
      normalRole = await prisma.role.create({ data: { rolename: 'normal' } });
    }

    // Tạo MemberShip mặc định score = 10
    const membership = await prisma.memberShip.create({
      data: {
        mname: 'Standard',
        score: 10
      }
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        fullname: fullname || username,
        password: hashedPassword,
        roleid: normalRole.roleid,
        mid: membership.mid
      },
      include: {
        role: true,
        membership: true
      }
    });

    res.status(201).json({
      message: 'Đăng ký thành công',
      user: {
        uid: user.uid,
        username: user.username,
        fullname: user.fullname,
        role: user.role.rolename,
        membershipScore: user.membership.score
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. Auth: Đăng nhập cấp JWT (Mục 6)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true, membership: true }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Sai username hoặc password' });
    }

    const token = jwt.sign(
      { uid: user.uid, username: user.username, roleid: user.roleid },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        uid: user.uid,
        username: user.username,
        role: user.role?.rolename,
        score: user.membership?.score
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Products: Danh sách & Tạo mới CLI/API (Mục 5)
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { pid: 'asc' } });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { pname, price, quantity } = req.body;
    const product = await prisma.product.create({
      data: {
        pname,
        price: parseFloat(price),
        quantity: parseInt(quantity)
      }
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 5. Orders: Đặt hàng Transaction (Mục 7: X mua 2, Y mua 5 -> Trừ kho -> Tạo Shipment)
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body; // Mảng: [ { pid: 1, qty: 2 }, { pid: 2, qty: 5 } ]
    if (!items || !items.length) {
      return res.status(400).json({ message: 'Danh sách sản phẩm không hợp lệ' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Tạo Order với thời gian hiện hành
      const order = await tx.order.create({
        data: {
          uid: req.user.uid,
          createat: new Date()
        }
      });

      // 2. Duyệt items, trừ kho Product và tạo OrderDetail
      for (const item of items) {
        const prod = await tx.product.findUnique({ where: { pid: Number(item.pid) } });
        if (!prod || prod.quantity < item.qty) {
          throw new Error(`Sản phẩm ID ${item.pid} không đủ hàng tồn kho`);
        }

        // Trừ tồn kho
        await tx.product.update({
          where: { pid: prod.pid },
          data: { quantity: prod.quantity - Number(item.qty) }
        });

        // Tạo OrderDetail
        await tx.orderDetail.create({
          data: {
            oid: order.oid,
            pid: prod.pid,
            qty: Number(item.qty),
            unit_price: prod.price
          }
        });
      }

      // 3. Tự động chuyển sang Shipment
      const shipment = await tx.shipment.create({
        data: {
          oid: order.oid,
          status: 'IN_TRANSIT'
        }
      });

      // 4. Lấy đầy đủ thông tin đơn hàng vừa tạo kèm chi tiết
      return await tx.order.findUnique({
        where: { oid: order.oid },
        include: {
          orderDetails: {
            include: { product: true }
          },
          shipments: true
        }
      });
    });

    res.status(201).json({
      message: 'Đặt hàng thành công và đã tạo vận đơn giao hàng',
      order: result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

module.exports = { app, prisma };