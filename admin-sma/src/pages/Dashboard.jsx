import { useEffect, useState } from "react";
import { api } from "../lib/api";

const Card = ({ title, value }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <div className="text-sm text-white/60">{title}</div>
    <div className="mt-2 text-2xl font-semibold">{value}</div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => setStats(null));
  }, []);

  return (
    <div>
      <div className="text-xl font-semibold">Admin Control Panel</div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="ร้านค้าทั้งหมด" value={stats?.stores ?? "-"} />
        <Card title="ผู้ใช้ทั้งหมด" value={stats?.customers ?? "-"} />
        <Card title="ใบรับประกันทั้งหมด" value={stats?.warranties ?? "-"} />
        <Card title="ร้องเรียน (เปิด)" value={stats?.complaintsOpen ?? "-"} />
      </div>
    </div>
  );
}
