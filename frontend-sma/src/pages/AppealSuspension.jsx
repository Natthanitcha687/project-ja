import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { stripEmojisAndSpecials } from "../lib/text";

export default function AppealSuspension() {
    const [searchParams] = useSearchParams();
    const nav = useNavigate();

    const [email, setEmail] = useState("");
    const [reason, setReason] = useState("");
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    useEffect(() => {
        const e = searchParams.get("email");
        if (e) setEmail(e);
    }, [searchParams]);

    async function onSubmit(e) {
        e.preventDefault();
        setErr("");
        setMsg("");
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append("email", email);
            formData.append("reason", reason);
            for (let i = 0; i < files.length; i++) {
                formData.append("images", files[i]);
            }

            const res = await api.post("/auth/appeal", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            setMsg(res.data.message || "ส่งคำร้องสำเร็จ");
        } catch (e) {
            setErr(e?.response?.data?.message || "เกิดข้อผิดพลาดในการส่งคำร้อง");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 grid place-items-center p-6">
            <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-8 shadow-xl">
                <h1 className="text-2xl font-bold text-center mb-2 text-slate-900">ยื่นอุทธรณ์ / ขอปลดระงับ</h1>
                <p className="text-center text-slate-500 mb-8 text-sm">
                    หากคุณเชื่อว่าการระงับบัญชีเป็นความผิดพลาด กรุณากรอกแบบฟอร์มด้านล่าง
                </p>

                {msg ? (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-center">
                        <div className="text-lg font-semibold mb-1">ส่งคำร้องสำเร็จ</div>
                        <div>{msg}</div>
                        <button
                            onClick={() => nav("/")}
                            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            กลับหน้าหลัก
                        </button>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">อีเมลบัญชีที่ถูกระงับ</label>
                            <input
                                type="email"
                                required
                                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                                placeholder="example@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                readOnly={!!searchParams.get("email")}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">เหตุผลที่ขอยื่นอุทธรณ์</label>
                            <textarea
                                required
                                rows={4}
                                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm resize-none"
                                placeholder="อธิบายเหตุผลของคุณ..."
                                value={reason}
                                onChange={(e) => setReason(stripEmojisAndSpecials(e.target.value))}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">หลักฐานเพิ่มเติม (ถ้ามี)</label>
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                onChange={(e) => setFiles(e.target.files)}
                            />
                            <p className="mt-1 text-xs text-slate-400">รองรับไฟล์รูปภาพ .jpg, .png (เลือกได้หลายไฟล์)</p>
                        </div>

                        {err && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm text-center">
                                {err}
                            </div>
                        )}

                        <button
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-all active:scale-[0.98] shadow-md hover:shadow-lg"
                        >
                            {loading ? "กำลังส่งข้อมูล..." : "ส่งคำร้องอุทธรณ์"}
                        </button>

                        <div className="pt-4 text-center">
                            <a href="/" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                                กลับหน้าหลัก
                            </a>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
