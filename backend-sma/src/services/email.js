// backend-sma/src/services/email.js
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

/* =========================
 * Email template helpers
 * ========================= */
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(s) {
  return escapeHtml(s).replace(/\r\n|\n|\r/g, "<br>");
}

function normalizeBaseUrl(u) {
  const s = String(u || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s.replace(/\/+$/, "");
}

function getFrontendBaseUrl() {
  // ใช้ FRONTEND_URL เป็นหลัก (ปลอดภัย/ถูกเจตนา: ปุ่มพาไปหน้าเว็บ)
  return normalizeBaseUrl(process.env.FRONTEND_URL);
}

function inferWarrantyCta({ subject, text }) {
  const base = getFrontendBaseUrl();
  if (!base) return null;

  const s = `${subject || ""} ${text || ""}`;

  // ตรวจจับว่าเป็นอีเมลสำหรับร้านค้า (สรุปรายวัน)
  const looksLikeStoreSummary = /สรุปแจ้งเตือน|ประจำวัน|nearing|expired.*รายการ/i.test(s);
  if (looksLikeStoreSummary) {
    return {
      url: `${base}/dashboard/warranty`,
      text: "ไปที่แดชบอร์ด",
    };
  }

  // heuristic: ถ้าเนื้อหามีคำเกี่ยวกับใบรับประกัน/หมดประกัน/ใกล้หมดประกัน/รหัส WRxxx
  const looksLikeWarranty =
    /ใบรับประกัน|หมดประกัน|ใกล้หมดประกัน|WR\d{3,}/i.test(s);

  if (!looksLikeWarranty) return null;

  // พาไปหน้ารายการรับประกันฝั่งลูกค้า (ไม่กระทบ auth เดิม)
  return {
    url: `${base}/customer/warranties`,
    text: "เปิดดูใบรับประกัน",
  };
}


export function buildEmailShell({ title, messageHtml, ctaUrl, ctaText, footerNote }) {
  const safeTitle = escapeHtml(title || "การแจ้งเตือน");
  const safeFooter = escapeHtml(
    footerNote ||
    "หากคุณไม่ได้เป็นผู้ทำรายการนี้ สามารถละเว้นอีเมลนี้ได้"
  );

  const hasCta = !!(ctaUrl && ctaText);

  const ctaBlock = hasCta
    ? `
      <tr>
        <td style="padding: 20px 28px 0 28px;" align="center">
          <a href="${escapeHtml(ctaUrl)}"
             style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#0ea5e9 100%);
                    color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;
                    font-weight:700;font-size:15px;box-shadow:0 4px 14px rgba(37,99,235,0.25);">
            ${escapeHtml(ctaText)}
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding: 14px 28px 0 28px; font-size: 12px; color: #6b7280; line-height: 1.6;" align="center">
          ถ้าปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>
          <a href="${escapeHtml(ctaUrl)}" style="color:#2563eb; text-decoration:underline; word-break:break-all;">
            ${escapeHtml(ctaUrl)}
          </a>
        </td>
      </tr>
    `
    : "";

  // Logo URL - ใช้จาก FRONTEND_URL แต่ถ้าเป็น localhost ให้ใช้ emoji แทน (email clients ไม่สามารถเข้าถึง localhost ได้)
  const frontendBase = getFrontendBaseUrl();
  const isLocalhost = frontendBase && /localhost|127\.0\.0\.1/i.test(frontendBase);
  const logoUrl = (frontendBase && !isLocalhost) ? `${frontendBase}/home-assets/logo.png` : '';
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Warranty" style="height:40px;width:auto;display:block;" />`
    : `<span style="font-size:28px;">🛡️</span>`;

  // ใช้ table layout เพื่อให้แสดงผลใน email client ได้เสถียรกว่า
  return `
    <div style="margin:0;padding:0;background:linear-gradient(180deg,#e0f2fe 0%,#f3f4f6 100%);">
      <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">
        ${safeTitle}
      </span>

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
             style="background:linear-gradient(180deg,#e0f2fe 0%,#f3f4f6 100%);padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600"
                   style="width:600px;max-width:600px;background:#ffffff;border-radius:20px;
                          overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.08);">
              
              <!-- Logo Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%);padding:24px 28px;" align="center">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="padding-right:12px;">
                        ${logoBlock}
                      </td>
                      <td>
                        <span style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
                                     font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                          Warranty Platform
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Title -->
              <tr>
                <td style="padding:28px 28px 12px 28px;">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
                    <div style="font-size:20px;font-weight:800;color:#111827;line-height:1.4;">
                      ${safeTitle}
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 0 28px 16px 28px;">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
                              font-size:15px;color:#374151;line-height:1.8;
                              background:#f8fafc;border-radius:12px;padding:16px 20px;
                              border-left:4px solid #2563eb;">
                    ${messageHtml}
                  </div>
                </td>
              </tr>

              ${ctaBlock}

              <!-- Footer Note -->
              <tr>
                <td style="padding: 24px 28px 28px 28px;">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
                              font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">
                    ${safeFooter}
                  </div>
                </td>
              </tr>
            </table>

            <!-- Brand Footer -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">
              <tr>
                <td align="center">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
                              font-size:12px;color:#6b7280;">
                    © ${new Date().getFullYear()} <strong style="color:#2563eb;">Warranty Platform</strong> — ระบบจัดการใบรับประกันอัจฉริยะ
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}


/* =========================
 * Existing emails
 * ========================= */

export async function sendVerificationEmail({ to, verifyUrl }) {
  assertAbsoluteUrl("verifyUrl", verifyUrl);
  const transport = await getTransport();
  const from = getFrom();

  const subject = "ยืนยันอีเมลของคุณ";
  const text = `ยืนยันอีเมลของคุณโดยเปิดลิงก์นี้: ${verifyUrl}`;

  // Use the shared professional template
  const msgHtml = `
    <p style="margin:0 0 12px;font-size:15px;color:#374151;">
      ขอบคุณที่สมัครสมาชิกกับ <strong>Warranty Platform</strong>
    </p>
    <p style="margin:0 0 12px;font-size:15px;color:#374151;">
      เพื่อให้การสมัครสมาชิกสมบูรณ์ กรุณายืนยันอีเมลของคุณโดยคลิกปุ่มด้านล่าง
    </p>
  `;

  const html = buildEmailShell({
    title: "ยืนยันอีเมล",
    messageHtml: msgHtml,
    ctaUrl: verifyUrl,
    ctaText: "ยืนยันอีเมล",
    footerNote: "หากคุณไม่ได้สมัครสมาชิก สามารถละเว้นอีเมลนี้ได้"
  });

  return transport.sendMail({ from, to, subject, text, html });
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  assertAbsoluteUrl("resetUrl", resetUrl);
  const transport = await getTransport();
  const from = getFrom();

  const subject = "ตั้งรหัสผ่านใหม่";
  const text = `ตั้งรหัสผ่านใหม่โดยเปิดลิงก์นี้: ${resetUrl}`;

  const msgHtml = `
    <p style="margin:0 0 12px;font-size:15px;color:#374151;">
      เราได้รับคำขอให้รีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ
    </p>
    <p style="margin:0 0 12px;font-size:15px;color:#374151;">
      หากคุณต้องการตั้งรหัสผ่านใหม่ กรุณาคลิกปุ่มด้านล่าง (ลิงก์นี้จะหมดอายุภายใน 1 ชั่วโมง)
    </p>
  `;

  const html = buildEmailShell({
    title: "ตั้งรหัสผ่านใหม่",
    messageHtml: msgHtml,
    ctaUrl: resetUrl,
    ctaText: "ตั้งรหัสผ่านใหม่",
    footerNote: "หากคุณไม่ได้ส่งคำขอนี้ สามารถละเว้นอีเมลนี้ได้ รหัสผ่านของคุณจะยังคงปลอดภัย"
  });

  return transport.sendMail({ from, to, subject, text, html });
}

/**
 * Notification email (ใช้กับระบบแจ้งเตือน)
 * - ถ้าไม่ส่ง html มา จะใช้เทมเพลตสวยแบบมาตรฐาน
 * - ถ้าเป็นเนื้อหาเกี่ยวกับใบรับประกัน และมี FRONTEND_URL จะใส่ปุ่ม "เปิดดูใบรับประกัน" ให้อัตโนมัติ
 * - หรือจะส่ง actionUrl/actionText มาเองก็ได้
 */
export async function sendNotificationEmail({ to, subject, text, html, actionUrl, actionText }) {
  const transport = await getTransport();
  const from = getFrom();

  const subj = (subject || "การแจ้งเตือน").toString();
  const plainText = (text || subj).toString();

  // build nice html if none provided
  let htmlBody = html;

  if (!htmlBody) {
    let ctaUrl = actionUrl || null;
    let ctaText = actionText || null;

    // auto CTA for warranty-related notifications (best-effort, no throw)
    if (!ctaUrl || !ctaText) {
      const inferred = inferWarrantyCta({ subject: subj, text: plainText });
      if (inferred?.url && inferred?.text) {
        ctaUrl = ctaUrl || inferred.url;
        ctaText = ctaText || inferred.text;
      }
    }

    // if caller provided actionUrl, validate it; if invalid, drop CTA to avoid breaking email send
    if (ctaUrl) {
      const normalized = normalizeBaseUrl(ctaUrl) || (String(ctaUrl || "").trim() || null);
      if (!normalized || !/^https?:\/\//i.test(normalized)) {
        ctaUrl = null;
        ctaText = null;
      } else {
        ctaUrl = normalized;
      }
    }

    const messageHtml = `<div>${nl2br(plainText)}</div>`;
    htmlBody = buildEmailShell({
      title: subj,
      messageHtml,
      ctaUrl,
      ctaText,
    });
  }

  return transport.sendMail({
    from,
    to,
    subject: subj,
    text: plainText || subj,
    html: htmlBody,
  });
}

export async function sendLoginOtpEmail({ to, code, minutes = 10 }) {
  const transport = await getTransport();
  const from = getFrom();

  const subject = "รหัส OTP สำหรับเข้าสู่ระบบ";
  const text = `รหัส OTP ของคุณคือ: ${code} (หมดอายุใน ${minutes} นาที)`;
  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;line-height:1.6">
      <h2 style="margin:0 0 12px">รหัส OTP สำหรับเข้าสู่ระบบ</h2>
      <p>กรอกรหัสด้านล่างเพื่อเข้าสู่ระบบ (หมดอายุใน <b>${minutes}</b> นาที)</p>
      <div style="font-size:28px;font-weight:800;letter-spacing:6px;
                  padding:12px 16px;border:1px solid #e5e7eb;border-radius:12px;
                  display:inline-block;background:#f9fafb">
        ${code}
      </div>
      <p style="margin-top:14px;color:#6b7280;font-size:12px">
        หากคุณไม่ได้เป็นผู้ร้องขอ OTP นี้ สามารถละเว้นอีเมลนี้ได้
      </p>
    </div>
  `;

  return transport.sendMail({ from, to, subject, text, html });
}

/**
 * Account locked email (เมื่อ login ผิด 5 ครั้ง)
 */
export async function sendAccountLockedEmail({ to }) {
  const transport = await getTransport();
  const from = getFrom();

  const subject = "🔒 บัญชีของคุณถูกระงับชั่วคราว";
  const text = `บัญชีอีเมล ${to} ถูกระงับ 24 ชั่วโมง เนื่องจากมีการเข้าสู่ระบบผิดพลาด 5 ครั้งติดต่อกัน`;

  const html = buildEmailShell({
    title: "บัญชีถูกระงับ 24 ชั่วโมง",
    messageHtml: `
      <p style="margin:0 0 12px;font-size:15px;color:#374151;">
        บัญชีอีเมล <strong>${escapeHtml(to)}</strong> ถูกระงับชั่วคราว
      </p>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;">
        เนื่องจากมีการเข้าสู่ระบบผิดพลาด <strong>5 ครั้ง</strong>ติดต่อกันภายใน 1 ชั่วโมง
      </p>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;">
        คุณจะสามารถเข้าสู่ระบบได้อีกครั้งหลังจาก <strong>24 ชั่วโมง</strong>
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#b91c1c;">
          ⚠️ หากไม่ใช่คุณเป็นผู้พยายามเข้าสู่ระบบ กรุณาเปลี่ยนรหัสผ่านทันทีหลังจากหมดเวลาระงับ
        </p>
      </div>
    `,
    footerNote: "อีเมลนี้ส่งโดยอัตโนมัติเพื่อแจ้งเตือนเรื่องความปลอดภัยบัญชีของคุณ"
  });

  return transport.sendMail({ from, to, subject, text, html });
}
