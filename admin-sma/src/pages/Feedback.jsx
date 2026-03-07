import { useEffect, useState } from "react";
import { api } from "../lib/api";

function StarRow({ rating }) {
  const n = Number(rating) || 0;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "text-amber-400" : "text-slate-300"}>
          ★
        </span>
      ))}
      <span className="ml-1 text-slate-500">{n || "-"}</span>
    </span>
  );
}

export default function Feedback() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ratingFilter, setRatingFilter] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (ratingFilter) params.rating = ratingFilter;
      const { data } = await api.get("/admin/feedback", { params });
      setItems(Array.isArray(data?.feedback) ? data.feedback : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratingFilter]);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">ข้อเสนอแนะจากผู้ใช้</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            ดูคะแนนความพึงพอใจและข้อเสนอแนะที่ผู้ใช้ส่งมาผ่านแบบประเมิน
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="text-slate-600">กรองตามคะแนน:</span>
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(Number(e.target.value) || 0)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-400"
          >
            <option value={0}>ทั้งหมด</option>
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>
                {r} ดาว
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">กำลังโหลดข้อมูล…</div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">ยังไม่มีข้อเสนอแนะ</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2 font-medium">วันที่</th>
                <th className="px-3 py-2 font-medium">คะแนน</th>
                <th className="px-3 py-2 font-medium">ข้อเสนอแนะ</th>
                <th className="px-3 py-2 font-medium">ผู้ใช้</th>
              </tr>
            </thead>
            <tbody>
              {items.map((fb) => {
                const created = fb.createdAt ? new Date(fb.createdAt) : null;
                const createdText = created
                  ? created.toLocaleString("th-TH", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "-";
                const userEmail = fb.user?.email || "—";
                const userRole = fb.user?.role || null;

                return (
                  <tr key={fb.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2 align-top whitespace-nowrap text-slate-700">{createdText}</td>
                    <td className="px-3 py-2 align-top"><StarRow rating={fb.rating} /></td>
                    <td className="px-3 py-2 align-top max-w-xl">
                      <div className="text-slate-800 text-xs sm:text-sm whitespace-pre-wrap">
                        {fb.comment?.trim() || <span className="text-slate-400">(ไม่มีข้อความ)</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700">
                      {userEmail}
                      {userRole && (
                        <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                          {userRole}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
