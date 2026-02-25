import ExcelJS from 'exceljs'

// Browser-friendly helpers for reading/writing Excel files using exceljs
export async function parseExcelFile(file) {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)
  const sheet = workbook.worksheets[0]
  const rows = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // skip header
    rows.push(row.values.filter((_, i) => i > 0)) // row.values is 1-based
  })
  return rows
}

export async function createWorkbookBuffer(data = [], headers = []) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Report')
  if (headers && headers.length) ws.addRow(headers)
  for (const r of data) ws.addRow(r)
  const buf = await wb.xlsx.writeBuffer()
  return buf
}

export function downloadBufferAsExcel(buffer, filename = 'report.xlsx') {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
