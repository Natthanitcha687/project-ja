import { prisma } from '../src/db/prisma.js'

async function main() {
  console.log('Starting test-delete-flow')

  // 1) create store
  const store = await prisma.user.create({
    data: {
      email: `test-store-${Date.now()}@example.com`,
      passwordHash: 'x',
      role: 'STORE',
      emailVerifiedAt: new Date(),
      storeProfile: { create: { storeName: 'T-Store', storeType: 'Demo', ownerName: 'Owner', phone: '0900000000', email: 'store@example.com', address: 'Addr', businessHours: '9-5' } }
    },
  })

  // 2) create customer
  const customer = await prisma.user.create({
    data: {
      email: `test-customer-${Date.now()}@example.com`,
      passwordHash: 'x',
      role: 'CUSTOMER',
      emailVerifiedAt: new Date(),
      customerProfile: { create: { firstName: 'Fn', lastName: 'Ln', phone: '0812345678' } }
    }
  })

  console.log('Created store.id=', store.id, 'customer.id=', customer.id)

  // 3) create warranty linked to customer
  const w = await prisma.warranty.create({
    data: {
      storeId: store.id,
      code: `WR-TEST-${Date.now()}`,
      customerEmail: customer.email,
      customerUserId: customer.id,
      customerName: 'Test Customer',
      customerPhone: '0812345678',
      items: { create: [{ productName: 'Widget', serial: 'S-123', purchaseDate: new Date(), expiryDate: new Date(Date.now()+1000*60*60*24*365) }] }
    },
    include: { items: true }
  })

  console.log('Created warranty id=', w.id)

  // Show before
  const before = await prisma.warranty.findUnique({ where: { id: w.id } })
  console.log('Before delete - warranty:', before)

  // 4) emulate admin deleteCustomerAccount behavior: backup previousCustomer* and unlink customerUserId
  await prisma.warranty.updateMany({ where: { customerUserId: customer.id }, data: {
    previousCustomerUserId: customer.id,
    previousCustomerEmail: before.customerEmail,
    previousCustomerName: before.customerName,
    previousCustomerPhone: before.customerPhone,
    customerUserId: null
  }})

  await prisma.user.update({ where: { id: customer.id }, data: { isDeleted: true, deletedAt: new Date() } })

  const afterDelete = await prisma.warranty.findUnique({ where: { id: w.id } })
  const customerRow = await prisma.user.findUnique({ where: { id: customer.id } })
  console.log('After delete - warranty:', afterDelete)
  console.log('After delete - customer:', { id: customerRow.id, isDeleted: customerRow.isDeleted })

  // 5) emulate restoreUserAccount
  await prisma.user.update({ where: { id: customer.id }, data: { isDeleted: false, deletedAt: null } })

  // restore warranties from previousCustomerUserId
  const rows = await prisma.warranty.findMany({ where: { previousCustomerUserId: customer.id } })
  for (const r of rows) {
    await prisma.warranty.update({ where: { id: r.id }, data: {
      customerUserId: customer.id,
      customerEmail: r.previousCustomerEmail ?? null,
      customerName: r.previousCustomerName ?? null,
      customerPhone: r.previousCustomerPhone ?? null,
      previousCustomerUserId: null,
      previousCustomerEmail: null,
      previousCustomerName: null,
      previousCustomerPhone: null,
    }})
  }

  const afterRestore = await prisma.warranty.findUnique({ where: { id: w.id } })
  const customerRestored = await prisma.user.findUnique({ where: { id: customer.id } })
  console.log('After restore - warranty:', afterRestore)
  console.log('After restore - customer:', { id: customerRestored.id, isDeleted: customerRestored.isDeleted })

  // cleanup
  try {
    await prisma.warranty.delete({ where: { id: w.id } })
    await prisma.user.delete({ where: { id: store.id } })
    await prisma.user.delete({ where: { id: customer.id } })
    console.log('Cleaned up test data')
  } catch (e) {
    console.warn('Cleanup failed (ignored):', e?.message || e)
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); prisma.$disconnect() })
