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
 * ✅ TRUST PROXY (สำคัญ)
 * - ทำให้ req.ip อ่าน IP จริงจาก X-Forwarded-For ได้เมื่ออยู่หลัง Render/Proxy
 * - ต้องตั้งก่อน middleware ที่อ่าน req.ip (เช่น access log)
 * ========================================================= */
app.set('trust proxy', 1);

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

/* =========================================================
 * ✅ Access Log (Production-style) -> stdout/console
 * - Log ทุก request แบบสรุป (ไม่ log body/authorization)
 * - Render/Docker/PM2 จะเก็บ stdout ให้เอง
 * - ใส่ X-Request-Id เพื่อ trace
 * ========================================================= */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.ip ||
    null
  );
}

function makeRequestId() {
  // ไม่พึ่งพา lib เพิ่ม: พอสำหรับ trace ใน log
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  ).toUpperCase();
}

function shouldSkipAccessLog(req) {
  const p = (req.originalUrl || req.url || '').toString();
  // ลด noise จาก static + swagger
  if (p.startsWith('/uploads')) return true;
  if (p.startsWith('/docs')) return true;

  // ✅ แบบที่ 1: ลด noise จาก Render health check (ยิงถี่)
  if (p === '/healthz') return true;

  return false;
}

app.use((req, res, next) => {
  if (shouldSkipAccessLog(req)) return next();

  const rid = makeRequestId();
  const start = process.hrtime.bigint();

  // ส่ง request id กลับไปด้วย (ช่วย debug ฝั่ง client/proxy)
  try {
    res.setHeader('X-Request-Id', rid);
  } catch {
    // ignore
  }

  res.on('finish', () => {
    const durMs = Number(process.hrtime.bigint() - start) / 1e6;

    // อ่าน userId ตอน "finish" เพื่อให้กรณี route ตั้งค่า req.user ทีหลังยังอ่านได้
    const userId = req.user?.id ?? req.user?.sub ?? null;

    const line = {
      ts: new Date().toISOString(),
      rid,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      ms: Math.round(durMs),
      ip: getClientIp(req),
      userId,
      ua: req.get('user-agent') || null,
    };

    console.log('ACCESS', JSON.stringify(line));
  });

  next();
});

// Swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* =========================================================
 * ✅ Serve uploaded files (IMPORTANT for Render Disk)
 * - ถ้า set UPLOAD_ROOT=/var/data/uploads -> รูปจะไม่หายหลัง redeploy
 * - ถ้าไม่ตั้ง -> fallback ใช้โฟลเดอร์เดิม src/uploads
 * ========================================================= */
const uploadsDir = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.join(__dirname, 'uploads');

app.use('/uploads', express.static(uploadsDir));

app.get('/', (_req, res) => res.send('SME Email Auth API - Running OK'));

/* =========================================================
 * ✅ แบบที่ 1: Render Health Check (Liveness)
 * - ตอบไว ๆ ไม่เช็ค DB (กัน fail/restart loop เวลา DB มีปัญหา)
 * - ใช้ตั้งค่า Health Check Path ใน Render เป็น /healthz
 * ========================================================= */
app.get('/healthz', (_req, res) => {
  return res.status(200).json({
    ok: true,
    ts: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
  });
});

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
    runExpiryScanJob();
    setInterval(() => runExpiryScanJob(), 24 * 3600 * 1000);
    console.log('🔔 Expiry scan job scheduled (every 24h)');
  } catch (e) {
    console.warn('Unable to start expiry scan job', e?.message || e);
  }
});
