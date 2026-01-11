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

function buildEmailShell({ title, messageHtml, ctaUrl, ctaText, footerNote }) {
  const safeTitle = escapeHtml(title || "การแจ้งเตือน");
  const safeFooter = escapeHtml(
    footerNote ||
      "หากคุณไม่ได้เป็นผู้ทำรายการนี้ สามารถละเว้นอีเมลนี้ได้"
  );

  const hasCta = !!(ctaUrl && ctaText);

  const ctaBlock = hasCta
    ? `
      <tr>
        <td style="padding: 8px 28px 0 28px;">
          <a href="${escapeHtml(ctaUrl)}"
             style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;
                    padding:12px 18px;border-radius:10px;font-weight:700;">
            ${escapeHtml(ctaText)}
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding: 14px 28px 0 28px; font-size: 12px; color: #6b7280; line-height: 1.6;">
          ถ้าปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>
          <a href="${escapeHtml(ctaUrl)}" style="color:#2563eb; text-decoration:underline;">
            ${escapeHtml(ctaUrl)}
          </a>
        </td>
      </tr>
    `
    : "";

  // ใช้ table layout เพื่อให้แสดงผลใน email client ได้เสถียรกว่า
  return `
    <div style="margin:0;padding:0;background:#f3f4f6;">
      <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">
        ${safeTitle}
      </span>

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
             style="background:#f3f4f6;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600"
                   style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;
                          overflow:hidden;border:1px solid #e5e7eb;">
              <tr>
                <td style="padding:22px 28px 10px 28px;">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
                    <div style="font-size:18px;font-weight:800;color:#111827;line-height:1.3;">
                      ${safeTitle}
                    </div>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding: 0 28px 8px 28px;">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
                              font-size:14px;color:#111827;line-height:1.7;">
                    ${messageHtml}
                  </div>
                </td>
              </tr>

              ${ctaBlock}

              <tr>
                <td style="padding: 18px 28px 22px 28px;">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
                              font-size:12px;color:#6b7280;line-height:1.6;">
                    ${safeFooter}
                  </div>
                </td>
              </tr>
            </table>

            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
                        font-size:12px;color:#9ca3af;margin-top:14px;">
              © ${new Date().getFullYear()} No-Reply
            </div>
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
