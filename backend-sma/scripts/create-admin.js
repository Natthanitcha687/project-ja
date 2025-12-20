import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '../src/db/prisma.js'

const email = (process.env.ADMIN_EMAIL || '').trim()
const password = process.env.ADMIN_PASSWORD || ''

if (!email || !password) {
  console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in env')
  process.exit(1)
}

const run = async () => {
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    console.log('Admin already exists:', email)
    return
  }

  const hash = await bcrypt.hash(password, 10)
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
