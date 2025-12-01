import { prisma } from '../db/prisma.js'

export async function getStats(_req, res) {
  try {
    const stores = await prisma.user.count({ where: { role: 'STORE' } })
    const customers = await prisma.user.count({ where: { role: 'CUSTOMER' } })
    const warranties = await prisma.warranty.count()

    // satisfaction: average rating & total
    const agg = await prisma.satisfaction.aggregate({
      _avg: { rating: true },
      _count: { id: true },
    })

    const satisfaction = {
      average: agg._avg.rating ? Number(Number(agg._avg.rating).toFixed(2)) : null,
      count: agg._count.id || 0,
    }

    res.json({ stores, customers, warranties, satisfaction })
  } catch (e) {
    console.error('getStats error', e)
    res.status(500).json({ message: 'Server error' })
  }
}

export async function postFeedback(req, res) {
  try {
    const { rating, comment, storeId, warrantyId } = req.body
    const r = Number(rating || 0)
    if (!r || r < 1 || r > 5) return res.status(400).json({ message: 'rating must be 1..5' })

    // user id optional - try to read from auth header if token exists
    let userId = null
    try {
      const header = req.headers.authorization || ''
      const token = header.startsWith('Bearer ') ? header.slice(7) : null
      if (token) {
        const p = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
        userId = Number(p.sub || null)
      }
    } catch { /* ignore */ }

    const created = await prisma.satisfaction.create({
      data: { rating: r, comment: comment || null, userId: userId || null, storeId: storeId ? Number(storeId) : null, warrantyId: warrantyId || null }
    })
    res.status(201).json({ ok: true, feedback: created })
  } catch (e) {
    console.error('postFeedback error', e)
    res.status(500).json({ message: 'Server error' })
  }
}
