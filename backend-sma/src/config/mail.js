// src/config/mail.js
import nodemailer from "nodemailer";

let cachedTransport = null;

export async function getTransport() {
  if (cachedTransport) return cachedTransport;

  const useEthereal = String(process.env.USE_ETHEREAL).toLowerCase() === "true";

  if (useEthereal) {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransport = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  } else {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.NODEMAILER_USER;
    const pass = process.env.NODEMAILER_PASS;

    if (!user || !pass) {
      throw new Error("Missing NODEMAILER_USER/NODEMAILER_PASS in .env");
    }

    cachedTransport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, 
      auth: { user, pass },
    });

    await cachedTransport.verify(); // ตรวจค่าคอนฟิก ถ้าผิดจะ throw เลย
  }

  return cachedTransport;
}

export async function sendMail({ to, subject, html, text }) {
  const transporter = await getTransport();
  const fromAddress = process.env.NODEMAILER_USER
    ? `"No-Reply" <${process.env.NODEMAILER_USER}>`
    : undefined;

  const info = await transporter.sendMail({ from: fromAddress, to, subject, html, text });

  if (String(process.env.USE_ETHEREAL).toLowerCase() === "true") {
    const url = nodemailer.getTestMessageUrl(info);
    if (url) console.log("Ethereal preview:", url);
  }
  return info;
}

export async function sendVerificationEmail(to, token) {
  const base = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173";
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
    </div>`;
  return sendMail({ to, subject, html, text: `Verify: ${verifyUrl}` });
}

export async function sendPasswordResetEmail(to, token) {
  const base = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173";
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
    </div>`;
  return sendMail({ to, subject, html, text: `Reset: ${resetUrl}` });
}
