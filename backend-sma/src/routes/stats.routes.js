import { Router } from 'express'
import { getStats, getWarrantyStatusSummary, postFeedback, getUsageSurveyEligibility } from '../controllers/stats.controller.js'

const router = Router()

router.get('/stats', getStats)
router.get('/warranty-statuses', getWarrantyStatusSummary)
router.post('/feedback', postFeedback)
router.get('/usage-survey', getUsageSurveyEligibility)

export default router
