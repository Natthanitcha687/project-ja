import { Router } from 'express'
import { getStats, postFeedback } from '../controllers/stats.controller.js'

const router = Router()

router.get('/stats', getStats)
router.post('/feedback', postFeedback)

export default router
