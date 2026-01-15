export default function Faq() {
  const faqs = [
    {
      q: 'ฉันจะเพิ่มใบรับประกันใหม่ได้อย่างไร?',
      a: 'ไปที่เมนูจัดการใบรับประกัน กด "เพิ่มสินค้า" ใส่ serial, วันที่ซื้อ และระยะเวลารับประกัน แล้วบันทึก'
    },
    {
      q: 'ระบบรองรับการแนบรูปไหม?',
      a: 'รองรับการแนบรูปใบเสร็จและรูปสินค้าสำหรับการเคลม เพื่อให้การตรวจสอบรวดเร็วขึ้น'
    },
    {
      q: 'จะตั้งค่าการแจ้งเตือนล่วงหน้าได้อย่างไร?',
      a: 'ไปที่การตั้งค่าแจ้งเตือนในโปรไฟล์ร้านค้า เลือกระยะเวลาที่ต้องการให้ระบบเตือนก่อนหมดอายุ'
    },
    {
      q: 'มีค่าใช้จ่ายหรือไม่?',
      a: 'ปัจจุบันให้บริการเวอร์ชันทดลองฟรีสำหรับร้านค้าขนาดเล็ก หากต้องการฟีเจอร์พรีเมียม ติดต่อเราเพื่อเสนอราคา'
    }
  ]

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900 py-12">
      <div className="mx-auto max-w-3xl px-6">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold">คำถามที่พบบ่อย (FAQ)</h1>
          <p className="text-slate-600 mt-2">รวมคำถามยอดนิยมและคำตอบเพื่อช่วยเริ่มต้นใช้งาน</p>
        </header>

        <div className="space-y-4">
          {faqs.map((f, i) => (
            <details key={i} className="rounded-lg bg-white border border-slate-100 p-4">
              <summary className="font-semibold cursor-pointer">{f.q}</summary>
              <div className="mt-2 text-slate-600">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
