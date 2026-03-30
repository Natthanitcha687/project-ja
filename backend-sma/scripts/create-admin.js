import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '../src/db/prisma.js'

// Debug เพื่อดูว่าค่าที่พิมพ์เข้ามาคืออะไร
const args = process.argv.slice(2);

let email = (args[0] || '').trim();
if (!email) {
  // ถ้าไม่พิมพ์ต่อท้าย ให้ไปใช้ค่าใน env
  email = (process.env.ADMIN_EMAIL || '').trim();
}

let password = args[1] || '';
if (!password) {
  // ถ้าไม่พิมพ์ต่อท้าย ให้ไปใช้ค่าใน env
  password = process.env.ADMIN_PASSWORD || '';
}

console.log(`🔍 ข้อมูลที่จะใช้สร้าง Admin: Email="${email}"`);

if (!email || !password) {
  console.error('❌ กรุณาระบุ email และ password (เช่น: npm run create:admin -- user@test.com 123456)');
  process.exit(1);
}

const run = async () => {
  const exists = await prisma.user.findUnique({ where: { email } })
  const hash = await bcrypt.hash(password, 10)

  if (exists) {
    // อัปเดตรหัสผ่านกรณีมีอยู่แล้ว
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: hash,
        role: 'ADMIN', // กันเหนียว บังคับให้เป็น ADMIN
        status: 'ACTIVE'
      }
    })
    console.log(`✅ Updated password for existing admin: ${email}`)
    return
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date() // ให้ล็อกอินได้เลย
    }
  })

  console.log('✅ Created admin:', { id: user.id, email: user.email, role: user.role })
}

run()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
