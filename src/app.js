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

// 1. Health check endpoint (Yêu cầu 4)
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'UP',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'DOWN',
      database: 'disconnected',
      error: error.message
    });
  }
});

// 2. Auth: Đăng ký User
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, fullname, password, roleid, mid } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        fullname,
        password: hashedPassword,
        roleid: Number(roleid),
        mid: mid ? Number(mid) : null
      }
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: { uid: user.uid, username: user.username, fullname: user.fullname }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. Auth: Đăng nhập cấp JWT (Yêu cầu 2)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { uid: user.uid, username: user.username, roleid: user.roleid },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    res.json({ message: 'Login successful', token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Products: Lấy danh sách (Public)
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Products: Thêm sản phẩm (Protected bằng JWT)
app.post('/api/products', authMiddleware, async (req, res) => {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Ecommerce Monolith API running on port ${PORT}`));

module.exports = { app, prisma };