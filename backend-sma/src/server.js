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
import notificationsRoutes from './routes/notifications.routes.js';
import runExpiryScanJob from './jobs/notifyExpirations.js';

// ✅ NEW: Admin routes
import adminRoutes from './routes/admin.routes.js';

// Swagger
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './docs/swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* =========================================================
 * ✅ CORS: รองรับทั้งหน้าเว็บเดิม + หน้า Admin (แยก frontend)
 * - คง behavior เดิมไว้ (credentials + Authorization header)
 * - เพิ่ม allow หลาย origin ด้วย callback
 * ========================================================= */
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.FRONTEND_ADMIN_URL || 'http://localhost:5174',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow curl/postman/no-origin
      if (!origin) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);

      // ถ้าต้องการ “เข้ม” ให้ block ตามเดิม
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ⬇️ คงของเดิม: เพิ่ม limit เพื่อแก้ 413 Payload Too Large (เช่นตอนส่งรูปโปรไฟล์แบบ base64)
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

// ✅ คงของเดิม: ฝั่งลูกค้า
app.use('/customer', customerRoutes);
app.use('/notifications', notificationsRoutes);
// public misc endpoints (stats, feedback)
app.use('/public', statsRoutes);

// ✅ NEW: ผูกเส้นทาง Admin (หลังบ้านแยก frontend แต่ใช้ backend เดิม)
app.use('/admin', adminRoutes);

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
  console.log(`✅ Allowed origins: ${allowedOrigins.join(', ')}`);
  // start expiry notification job: run once at startup and then every 24h
  try {
    runExpiryScanJob()
    setInterval(() => runExpiryScanJob(), 24 * 3600 * 1000)
    console.log('🔔 Expiry scan job scheduled (every 24h)')
  } catch (e) {
    console.warn('Unable to start expiry scan job', e?.message || e)
  }
});
