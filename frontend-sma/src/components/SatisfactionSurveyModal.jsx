import { useState } from "react";
import { api } from "../lib/api";
import { stripEmojisAndSpecials } from "../lib/text";

/**
 * SatisfactionSurveyModal
 * - ใช้เก็บแบบประเมินความพึงพอใจการใช้งาน (1–5 ดาว + ข้อเสนอแนะ)
 * - context: 'customer' | 'store' เพื่อปรับข้อความให้เหมาะกับฝั่งผู้ใช้
 */
export default function SatisfactionSurveyModal({ open, onClose, context = "customer" }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const title = "ช่วยประเมินความพึงพอใจในการใช้งานแพลตฟอร์ม";
  const subtitle =
    context === "store"
      ? "หลังจากร้านของคุณออกใบรับประกันครบ 3 ใบ เราอยากฟังความคิดเห็นเพื่อพัฒนาระบบให้ดีขึ้น"
      : "หลังจากคุณมีใบรับประกันครบ 3 ใบ เราอยากฟังความคิดเห็นเพื่อพัฒนาประสบการณ์ใช้งาน";

  const current = hoverRating || rating;

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!rating || submitting) return;

    setSubmitting(true);
    try {
      await api.post("/public/feedback", {
        rating,
        comment: comment?.trim() || null,
      });
      setSubmitted(true);
      // ปิด popup หลังจากแสดงข้อความขอบคุณสั้น ๆ
      setTimeout(() => {
        setSubmitting(false);
        setRating(0);
        setComment("");
        setSubmitted(false);
        onClose?.();
      }, 900);
    } catch (err) {
      console.error("submit satisfaction feedback failed", err);
      alert(
        err?.response?.data?.message ||
          "ส่งแบบประเมินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-sky-100 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-sky-100 flex items-start gap-3">
          <div className="mt-1 text-2xl">✨</div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pt-4 pb-5 space-y-4">
          {/* Stars */}
          <div>
            <div className="text-sm font-medium text-slate-800 mb-2">
              ให้คะแนนความพึงพอใจโดยรวม
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= current;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="text-2xl focus:outline-none"
                    aria-label={`${star} ดาว`}
                  >
                    <span
                      className={
                        active ? "text-yellow-400 drop-shadow-sm" : "text-slate-300"
                      }
                    >
                      ★
                    </span>
                  </button>
                );
              })}
              <span className="ml-2 text-xs text-slate-500">
                {rating ? `${rating} / 5 ดาว` : "เลือกจำนวนดาวที่ต้องการ"}
              </span>
            </div>
          </div>

          {/* Comment */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="satisfaction-comment"
                className="text-sm font-medium text-slate-800"
              >
                ข้อเสนอแนะเพิ่มเติม (ไม่บังคับ)
              </label>
              <span className="text-[11px] text-slate-400">
                เช่น สิ่งที่ชอบ, สิ่งที่อยากให้ปรับปรุง
              </span>
            </div>
            <textarea
              id="satisfaction-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(stripEmojisAndSpecials(e.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 resize-none bg-slate-50"
              placeholder="แบ่งปันประสบการณ์ของคุณให้เราหน่อยนะ"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={() => {
                setRating(0);
                setComment("");
                setSubmitted(false);
                onClose?.();
              }}
              className="text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              ภายหลัง
            </button>

            <button
              type="submit"
              disabled={!rating || submitting}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition ${
                !rating || submitting
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-sky-600 hover:bg-sky-500"
              }`}
            >
              {submitted
                ? "ขอบคุณสำหรับความคิดเห็น"
                : submitting
                ? "กำลังส่ง..."
                : "ส่งแบบประเมิน"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
