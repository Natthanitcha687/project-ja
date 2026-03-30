
import { prisma } from '../db/prisma.js'
import ExcelJS from 'exceljs'

// Export Warranties for Store
export async function exportStoreWarranties(req, res) {
    try {
        const { storeId } = req.params
        // Verification: Ensure user owns this store (middleware should handle, but extra check is good)
        // Here we assume req.user is set by auth middleware
        const requesterId = req.user.id

        // Fetch store to verify ownership
        const store = await prisma.user.findUnique({
            where: { id: parseInt(storeId) },
            include: { storeProfile: true }
        })

        if (!store) {
            return res.status(404).json({ error: 'Store not found' })
        }

        // Check if requester is the store owner 
        if (store.id !== requesterId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Unauthorized' })
        }

        // Fetch warranties
        const warranties = await prisma.warranty.findMany({
            where: { storeId: parseInt(storeId) },
            include: {
                items: true,
                customer: {
                    include: { customerProfile: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        // Create Workbook
        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'Warranty Platform'
        workbook.lastModifiedBy = 'System'
        workbook.created = new Date()
        workbook.modified = new Date()

        // Add Sheet
        const sheet = workbook.addWorksheet('Warranty Data', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }] // Freeze header row
        })

        // Define Columns
        sheet.columns = [
            { header: 'Warranty Code', key: 'code', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Product Name', key: 'product', width: 25 },
            { header: 'Model', key: 'model', width: 15 },
            { header: 'Serial Number', key: 'serial', width: 20 },
            { header: 'Price (฿)', key: 'price', width: 15 },
            { header: 'Customer Name', key: 'customer', width: 25 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
            { header: 'Expiry Date', key: 'expiryDate', width: 15 },
            { header: 'Days Left', key: 'daysLeft', width: 12 },
            { header: 'Duration (Months)', key: 'duration', width: 18 },
        ]

        // Style Header Row
        const headerRow = sheet.getRow(1)
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 }
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1E40AF' } // Blue-800
        }
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
        headerRow.height = 24

        // Add Data
        warranties.forEach(w => {
            w.items.forEach(item => {
                // Calculate status & days left
                const now = new Date()
                const expiry = item.expiryDate ? new Date(item.expiryDate) : null
                let status = 'Active'
                let daysLeft = 0

                if (expiry) {
                    const diffTime = expiry - now
                    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                    if (daysLeft < 0) status = 'Expired'
                    else if (daysLeft <= 30) status = 'Expiring Soon'
                }

                // Get customer name
                let customerName = w.customerName || '-'
                if (w.customer?.customerProfile) {
                    customerName = `${w.customer.customerProfile.firstName} ${w.customer.customerProfile.lastName}`
                }

                const row = sheet.addRow({
                    code: w.code,
                    status: status,
                    product: item.productName,
                    model: item.model || '-',
                    serial: item.serial || '-',
                    price: item.price != null ? item.price : '',
                    customer: customerName,
                    phone: w.customerPhone || (w.customer?.customerProfile?.phone || '-'),
                    purchaseDate: item.purchaseDate,
                    expiryDate: item.expiryDate,
                    daysLeft: expiry ? daysLeft : '-',
                    duration: item.durationMonths || '-'
                })

                // Conditional Formatting for Status
                const statusCell = row.getCell('status')
                statusCell.alignment = { horizontal: 'center' }
                statusCell.font = { bold: true }

                if (status === 'Active') {
                    statusCell.font = { color: { argb: '166534' } } // Green
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } } // Light Green
                } else if (status === 'Expiring Soon') {
                    statusCell.font = { color: { argb: '9A3412' } } // Orange
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDD5' } } // Light Orange
                } else {
                    statusCell.font = { color: { argb: '991B1B' } } // Red
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } } // Light Red
                }

                // Center align dates and numbers
                row.getCell('purchaseDate').alignment = { horizontal: 'center' }
                row.getCell('expiryDate').alignment = { horizontal: 'center' }
                row.getCell('daysLeft').alignment = { horizontal: 'center' }
                row.getCell('duration').alignment = { horizontal: 'center' }
            })
        })

        // Enable Auto Filter for the first sheet
        sheet.autoFilter = {
            from: 'A1',
            to: {
                row: 1,
                column: sheet.columns.length
            }
        }

        // ---------------------------------------------------------
        // Add Annual Summary Sheet
        // ---------------------------------------------------------
        const summarySheet = workbook.addWorksheet('Annual Summary')
        const currentYear = new Date().getFullYear()

        summarySheet.mergeCells('A1', 'C1')
        summarySheet.getCell('A1').value = `สรุปข้อมูลรายปี (แบ่งตามปีปฏิทิน)`
        summarySheet.getCell('A1').font = { bold: true, size: 14 }
        summarySheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
        summarySheet.getRow(1).height = 30

        summarySheet.columns = [
            { header: 'ปี (พ.ศ.)', key: 'yearLabel', width: 20 },
            { header: 'ใบรับประกันที่สร้าง (รายการ)', key: 'created', width: 25 },
            { header: 'สินค้าที่จะหมดอายุ (รายการ)', key: 'expiring', width: 25 }
        ]

        // Style the header row (Row 2, since Row 1 is the merged title)
        const summaryHeader = summarySheet.getRow(2)
        summaryHeader.font = { bold: true, color: { argb: 'FFFFFF' } }
        summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E40AF' } }
        summaryHeader.alignment = { horizontal: 'center', vertical: 'middle' }
        summaryHeader.height = 24

        // หาช่วงปีจากอดีต (ปีที่สร้างแรกสุด) จนถึงอนาคต (ปีที่หมดอายุหลังสุด)
        let minYear = currentYear
        let maxYear = currentYear

        warranties.forEach(w => {
            if (w.createdAt) {
                const cYear = new Date(w.createdAt).getFullYear()
                if (cYear < minYear) minYear = cYear
            }
            w.items.forEach(it => {
                if (it.expiryDate) {
                    const eYear = new Date(it.expiryDate).getFullYear()
                    if (eYear > maxYear) maxYear = eYear
                }
            })
        })

        // ให้แสดงเผื่อล่วงหน้าอย่างน้อย 4 ปีถ้ายังไม่มีข้อมูลถึง
        if (maxYear < currentYear + 4) maxYear = currentYear + 4

        let totalCreated = 0
        let totalExpiring = 0

        for (let y = minYear; y <= maxYear; y++) {
            let createdCount = 0
            let expiringCount = 0

            warranties.forEach(w => {
                if (w.createdAt && new Date(w.createdAt).getFullYear() === y) {
                    createdCount++
                }
                w.items.forEach(it => {
                    if (it.expiryDate && new Date(it.expiryDate).getFullYear() === y) {
                        expiringCount++
                    }
                })
            })

            totalCreated += createdCount
            totalExpiring += expiringCount

            summarySheet.addRow({
                yearLabel: `ปี ${y + 543}`,
                created: createdCount,
                expiring: expiringCount
            })
        }

        // Add Total Row
        const totalRow = summarySheet.addRow({
            yearLabel: 'รวมทั้งหมด',
            created: totalCreated,
            expiring: totalExpiring
        })
        totalRow.font = { bold: true }
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } }

        // Align columns center
        summarySheet.getColumn('yearLabel').alignment = { horizontal: 'center' }
        summarySheet.getColumn('created').alignment = { horizontal: 'center' }
        summarySheet.getColumn('expiring').alignment = { horizontal: 'center' }

        // Set Response Headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename=warranty-report-${storeId}-${Date.now()}.xlsx`)

        // Write to response
        await workbook.xlsx.write(res)
        res.end()

    } catch (error) {
        console.error('Export error:', error)
        res.status(500).json({ error: 'Failed to export excel' })
    }
}
