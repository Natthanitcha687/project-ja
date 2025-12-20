#!/usr/bin/env node
/**
 * Safe cleanup script for notifications/warranties by code.
 * By default runs in preview mode and only shows matches.
 * Use `--force` to actually delete, and `--delete-warranties` to also remove warranty rows.
 * Examples:
 *   node tools/cleanupFake.js                 # preview
 *   node tools/cleanupFake.js --force         # delete matched notifications
 *   node tools/cleanupFake.js --force --delete-warranties
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const deleteWarranties = args.includes('--delete-warranties')
  const force = args.includes('--force')

  // No preset codes — avoid matching/deleting example warranty codes by default
  const codes = []

  console.log('Preview mode:', !force)
  console.log('Searching warranties by code:', codes)
  const warranties = await prisma.warranty.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } })
  if (!warranties.length) {
    console.log('No warranties found for codes:', codes)
  } else {
    console.log('Found warranties:', warranties.map(w => `${w.code} (${w.id})`).join(', '))
  }

  const warrantyIds = warranties.map(w => w.id)

  // Build notification filter: either references warrantyId in data OR title/body contains code
  const orConditions = []
  for (const id of warrantyIds) {
    orConditions.push({ data: { path: ['warrantyId'], equals: id } })
  }
  for (const code of codes) {
    orConditions.push({ title: { contains: code } })
    orConditions.push({ body: { contains: code } })
  }

  if (!orConditions.length) {
    console.log('No warranty ids or codes to match. Exiting.')
    await prisma.$disconnect()
    return
  }

  const matches = await prisma.notification.findMany({ where: { OR: orConditions }, take: 1000 })
  if (!matches.length) {
    console.log('No matching notifications found')
  } else {
    console.log(`Found ${matches.length} matching notifications:`)
    for (const n of matches) {
      console.log(`- id=${n.id} title=${n.title || ''}`)
    }

    if (force) {
      const ids = matches.map(m => m.id)
      const deleted = await prisma.notification.deleteMany({ where: { id: { in: ids } } })
      console.log('Deleted notifications count:', deleted.count)
    } else {
      console.log('Run with --force to delete the above notifications')
    }
  }

  if (deleteWarranties && warrantyIds.length) {
    if (force) {
      for (const id of warrantyIds) {
        try {
          await prisma.warranty.delete({ where: { id } })
          console.log('Deleted warranty', id)
        } catch (e) {
          console.warn('Failed to delete warranty', id, e.message)
        }
      }
    } else {
      console.log('Would delete warranties:', warrantyIds, '(use --force to actually delete)')
    }
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
