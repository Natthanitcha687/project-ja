// src/config/mail.js
import nodemailer from "nodemailer";

let cachedTransport = null;

/**
 * สร้าง transport และ cache เมื่อ verify ผ่านเท่านั้น
 * (กันปัญหา cache ค่าที่พังไว้ แล้ว request ต่อไปค้าง/พังซ้ำ)
 */
export async function getTransport() {
  if (cachedTransport) return cachedTransport;

  const useEthereal = String(process.env.USE_ETHEREAL).toLowerCase() === "true";

  // ค่ากันค้างนาน (ms)
  const CONNECTION_TIMEOUT = Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000);
  const GREETING_TIMEOUT = Number(process.env.SMTP_GREETING_TIMEOUT || 10000);
  const SOCKET_TIMEOUT = Number(process.env.SMTP_SOCKET_TIMEOUT || 20000);

  if (useEthereal) {
    const testAccount = await nodemailer.createTestAccount();

    const transport = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },

      connectionTimeout: CONNECTION_TIMEOUT,
      greetingTimeout: GREETING_TIMEOUT,
      socketTimeout: SOCKET_TIMEOUT,

      // ให้ STARTTLS ทำงานชัด ๆ
      requireTLS: true,
    });

    // ถ้า verify ไม่ผ่าน ให้ throw และไม่ cache
    await transport.verify();
    cachedTransport = transport;
    return cachedTransport;
  }

  // ====== Production / Gmail / SMTP จริง ======
  const host = process.env.SMTP_HOST || "smtp.gmail.com";

  // ✅ แนะนำ default เป็น 587 (STARTTLS) ไม่ใช่ 465
  const port = Number(process.env.SMTP_PORT || 587);

  const user = process.env.NODEMAILER_USER;
  const pass = process.env.NODEMAILER_PASS;

  if (!user || !pass) {
    throw new Error("Missing NODEMAILER_USER/NODEMAILER_PASS in env");
  }

  const secure = port === 465; // 465 = SMTPS (Implicit TLS), 587 = STARTTLS (Explicit TLS)

  // สร้าง transport แต่ยังไม่ cache จนกว่า verify ผ่าน
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },

    // ✅ กันค้างนาน
    connectionTimeout: CONNECTION_TIMEOUT,
    greetingTimeout: GREETING_TIMEOUT,
    socketTimeout: SOCKET_TIMEOUT,

    // ✅ ถ้าใช้ 587 ให้บังคับ STARTTLS
    requireTLS: port === 587,

    // บางระบบต้อง relax TLS เล็กน้อย (ปกติไม่จำเป็น)
    // tls: { minVersion: "TLSv1.2" },
  });

  try {
    await transport.verify(); // ถ้าต่อไม่ได้จะจบตาม timeout ที่ตั้งไว้
    cachedTransport = transport;
    return cachedTransport;
  } catch (err) {
    cachedTransport = null;
    throw err;
  }
}

export async function sendMail({ to, subject, html, text }) {
  const transporter = await getTransport();

  // รองรับ SMTP_FROM ก่อน (คุณตั้งไว้แล้วใน Render)
  const fromAddress =
    process.env.SMTP_FROM ||
    (process.env.NODEMAILER_USER
      ? `"No-Reply" <${process.env.NODEMAILER_USER}>`
      : undefined);

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
    text,
  });

  if (String(process.env.USE_ETHEREAL).toLowerCase() === "true") {
    const url = nodemailer.getTestMessageUrl(info);
    if (url) console.log("Ethereal preview:", url);
  }

  return info;
}

export async function sendVerificationEmail(to, token) {
  const base =
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:5173";

  const verifyUrl = `${base}/verify-email?token=${encodeURIComponent(token)}`;

  const subject = "ยืนยันอีเมลของคุณ";
  const html = `
    <div style="font-family: system-ui, Arial, sans-serif;">
      <h2>ยืนยันอีเมล</h2>
      <p>คลิกปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ</p>
      <p>
        <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">ยืนยันอีเมล</a>
      </p>
      <p>ถ้าปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    </div>
  `;

  return sendMail({ to, subject, html, text: `Verify: ${verifyUrl}` });
}

export async function sendPasswordResetEmail(to, token) {
  const base =
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:5173";

  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;

  const subject = "ตั้งรหัสผ่านใหม่";
  const html = `
    <div style="font-family: system-ui, Arial, sans-serif;">
      <h2>ตั้งรหัสผ่านใหม่</h2>
      <p>คลิกปุ่มด้านล่างเพื่อไปหน้าตั้งรหัสผ่านใหม่</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">ตั้งรหัสผ่านใหม่</a>
      </p>
      <p>ถ้าปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
    </div>
  `;

  return sendMail({ to, subject, html, text: `Reset: ${resetUrl}` });
}
