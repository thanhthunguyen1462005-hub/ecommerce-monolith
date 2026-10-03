FROM node:20-alpine

# Cài đặt OpenSSL bắt buộc cho Prisma Engine trên nền tảng Alpine Linux
RUN apk add --no-cache openssl

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push --schema=./prisma/schema.prisma && node src/app.js"]