import { getTransport } from "../config/mail.js";

function getFrom() {
  
  const envFrom = process.env.SMTP_FROM;
  const user = process.env.NODEMAILER_USER;
  if (envFrom && envFrom.trim()) return envFrom;
  if (user && user.trim()) return `"No-Reply" <${user}>`;
  throw new Error("Please set SMTP_FROM or NODEMAILER_USER in .env");
}

function assertAbsoluteUrl(name, url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error(`${name} must be an absolute URL (starts with http:// or https://)`);
  }
}

export async function sendVerificationEmail({ to, verifyUrl }) {
  assertAbsoluteUrl("verifyUrl", verifyUrl);
  const transport = await getTransport();
  const from = getFrom();

  const subject = "ยืนยันอีเมลของคุณ";
  const text = `ยืนยันอีเมลของคุณโดยเปิดลิงก์นี้: ${verifyUrl}`;
  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;line-height:1.6">
      <h1 style="margin:0 0 12px">ยืนยันอีเมล</h1>
      <p>ขอบคุณที่สมัครใช้งาน คลิกลิงก์ด้านล่างเพื่อยืนยันอีเมลของคุณ</p>
      <p>
        <a href="${verifyUrl}" 
           style="display:inline-block;padding:10px 16px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none">
          ยืนยันอีเมล
        </a>
      </p>
      <p>ถ้าปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>
        <a href="${verifyUrl}">${verifyUrl}</a>
      </p>
    </div>
  `;

  return transport.sendMail({ from, to, subject, text, html });
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  assertAbsoluteUrl("resetUrl", resetUrl);
  const transport = await getTransport();
  const from = getFrom();

  const subject = "ตั้งรหัสผ่านใหม่";
  const text = `ตั้งรหัสผ่านใหม่โดยเปิดลิงก์นี้: ${resetUrl}`;
  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;line-height:1.6">
      <h1 style="margin:0 0 12px">ตั้งรหัสผ่านใหม่</h1>
      <p>คลิกลิงก์ด้านล่างเพื่อไปหน้าตั้งรหัสผ่านใหม่ ลิงก์นี้จะหมดอายุในไม่ช้า</p>
      <p>
        <a href="${resetUrl}" 
           style="display:inline-block;padding:10px 16px;border-radius:8px;background:#16a34a;color:#fff;text-decoration:none">
          ตั้งรหัสผ่านใหม่
        </a>
      </p>
      <p>ถ้าปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
    </div>
  `;

  return transport.sendMail({ from, to, subject, text, html });
}

export async function sendNotificationEmail({ to, subject, text, html }) {
  const transport = await getTransport();
  const from = getFrom();
  // build minimal html if none provided
  const htmlBody = html || `<div style="font-family:system-ui,Arial,sans-serif;line-height:1.6"><p>${text || ''}</p></div>`;
  return transport.sendMail({ from, to, subject, text: text || subject, html: htmlBody });
}
