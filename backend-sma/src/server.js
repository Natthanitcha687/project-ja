// src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

import authRoutes from './routes/auth.routes.js';
import storeRoutes from './routes/store.routes.js';
import warrantyRoutes from './routes/warranty.routes.js';
import warrantyItemRoutes from './routes/warrantyItem.routes.js';

// ✅ เพิ่ม: เส้นทางฝั่งลูกค้า
import customerRoutes from './routes/customer.routes.js';
import statsRoutes from './routes/stats.routes.js';

// Swagger
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './docs/swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ CORS: อนุญาตส่ง Authorization + credentials
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ⬇️ เพิ่ม limit เพื่อแก้ 413 Payload Too Large (เช่นตอนส่งรูปโปรไฟล์แบบ base64)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use(cookieParser());

// Swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// เสิร์ฟไฟล์อัปโหลดกลับให้หน้าเว็บ (ฐานเดียวกับ uploadImages.js)
// ถ้าโฟลเดอร์อัปโหลดอยู่ที่ src/uploads ให้ใช้บรรทัดนี้
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// ถ้าอยู่ที่ root (../uploads) ให้สลับมาใช้บรรทัดด้านล่างแทน
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (_req, res) => res.send('SME Email Auth API - Running OK'));

// routes (คง prefix เดิมไว้ทั้งหมด)
app.use('/auth', authRoutes);
app.use('/store', storeRoutes);
app.use('/warranties', warrantyRoutes);
app.use('/warranty-items', warrantyItemRoutes);

// ✅ เพิ่ม: ผูกเส้นทางฝั่งลูกค้า (ดู/ค้นหาใบรับประกันของตัวเอง, เพิ่มหมายเหตุ, ดาวน์โหลด PDF)
app.use('/customer', customerRoutes);
// public misc endpoints (stats, feedback)
app.use('/public', statsRoutes);

// Multer & Validation errors → ตอบ 400 แทน 500
app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }
  if (err && /รองรับเฉพาะไฟล์รูปภาพ/.test(err.message)) {
    return res.status(400).json({ message: err.message });
  }
  return next(err);
});

// Global error handler (ของเดิม)
app.use((err, _req, res, _next) => {
  console.error('GlobalError:', err);
  const code = err.status || 500;
  const msg = err.message || 'Server error';
  res.status(code).json({ message: msg });
});

const port = Number(process.env.PORT || 4000);
const baseUrl =
  (process.env.APP_URL && process.env.APP_URL.replace(/\/+$/, '')) ||
  `http://localhost:${port}`;

app.listen(port, () => {
  console.log(`🚀 API running on ${baseUrl}`);
  console.log(`📚 Swagger UI -> ${baseUrl}/docs`);
});
