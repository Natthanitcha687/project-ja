import { Router } from 'express'
import { getStats, getWarrantyStatusSummary, postFeedback } from '../controllers/stats.controller.js'

const router = Router()

router.get('/stats', getStats)
router.get('/warranty-statuses', getWarrantyStatusSummary)
router.post('/feedback', postFeedback)

export default router
