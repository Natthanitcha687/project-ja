import { describe, it, expect } from 'vitest'
import { createWorkbookBuffer, parseExcelFile } from '../excelService'
import ExcelJS from 'exceljs'

describe('excelService', () => {
  it('createWorkbookBuffer returns buffer that can be read by exceljs', async () => {
    const headers = ['ID', 'Product', 'Customer']
    const data = [ ['W-001','Widget A','Alice'], ['W-002','Widget B','Bob'] ]
    const buf = await createWorkbookBuffer(data, headers)
    // ExcelJS can read from buffer
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.worksheets[0]
    const headerRow = ws.getRow(1).values.slice(1)
    expect(headerRow).toEqual(headers)
    const firstData = ws.getRow(2).values.slice(1)
    expect(firstData).toEqual(data[0])
  })

  it('parseExcelFile parses a File object (browser) correctly', async () => {
    // create a workbook buffer first
    const headers = ['ID','Product']
    const data = [['W-101','Gadget X'], ['W-102','Gadget Y']]
    const buf = await createWorkbookBuffer(data, headers)
    // create a File object (Vitest uses jsdom)
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const file = new File([blob], 'test.xlsx')
    const rows = await parseExcelFile(file)
    // rows are arrays of cell values
    expect(rows.length).toBe(2)
    expect(rows[0][0]).toBe('W-101')
    expect(rows[0][1]).toBe('Gadget X')
  })
})
