# excelService Usage Examples

This file shows example usage for `src/lib/excelService.js` helpers.

## 1) Create and download report (frontend)
```javascript
import { createWorkbookBuffer, downloadBufferAsExcel } from './excelService'

async function exportReport(warranties) {
  const headers = ['Warranty ID', 'Product', 'Customer', 'Status']
  const data = warranties.map(w => [w.id, w.productName, w.customerName, w.status])
  const buffer = await createWorkbookBuffer(data, headers)
  downloadBufferAsExcel(buffer, `warranty-report-${Date.now()}.xlsx`)
}
```

## 2) Parse uploaded Excel file (frontend)
```javascript
import { parseExcelFile } from './excelService'

async function handleUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const rows = await parseExcelFile(file)
  // rows: array of arrays (each row values)
  // map rows to objects:
  const mapped = rows.map(r => ({ id: r[0], product: r[1], customer: r[2] }))
  // send to API or process locally
}
```

## 3) Server-side generation (Node) — reuse exceljs directly
```javascript
// In backend use exceljs to build and write to response
import ExcelJS from 'exceljs'

export async function exportWarrantiesToResponse(res, data) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Warranties')
  ws.columns = [ { header: 'Warranty ID', key: 'id' }, { header: 'Product', key: 'product' }, { header: 'Customer', key: 'customer' } ]
  data.forEach(d => ws.addRow({ id: d.id, product: d.productName, customer: d.customerName }))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="warranties.xlsx"')
  await wb.xlsx.write(res)
  res.end()
}
```

Notes:
- `exceljs` may add bundle size if used in the browser; consider performing heavy parsing on the backend.
- The helpers in `excelService.js` are simple and intended as a starting point — adapt to your schema and validations as needed.
