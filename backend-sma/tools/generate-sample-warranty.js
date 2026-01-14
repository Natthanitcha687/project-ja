import fs from 'fs';
import PDFDocument from 'pdfkit';
import { drawWarrantyPage } from '../src/pdf/warrantyTemplate_v2.js';

async function gen() {
  const out = fs.createWriteStream('sample-warranty.pdf');
  const doc = new PDFDocument({ autoFirstPage: false });
  doc.addPage({ size: 'A4', margin: 0 });

  const base = {
    cardNo: 'WR001',
    invoiceNo: 'INV-2568-00123',
    customerName: 'นายภูมิ อภิธรรม',
    customerTel: '094-746-8751',
    customerEmail: 'phum.akt@gmail.com',
    customerAddress: '99/1 หมู่บ้านพฤกษา ถนนรามอินทรา แขวงมีนบุรี เขตมีนบุรี กรุงเทพฯ 10510',
    dealerName: 'เสี่ยลูกกนบยนต์',
    warrantyPeriod: '1 ปี',
    purchaseDate: '2025-10-19',
    expiryDate: '2026-10-19',
    warrantyTerms: 'รับประกันตัวเครื่อง 1 ปี ครอบคลุมความเสียหายจากการผลิต การทำงานผิดปกติของอุปกรณ์ และปัญหาด้านซอฟต์แวร์ที่มาจากโรงงาน ไม่รวมความเสียหายจากการใช้งานผิดวิธี',
    exclusions: ['ความเสียหายจากน้ำ ของเหลว หรือความชื้น', 'ความเสียหายจากอุบัติเหตุ กระแทก หรือชนิดเหตุ', 'การแกะ ดัดแปลง หรือซ่อมโดยบุคคลที่ไม่ได้รับอนุญาต'],
    storeName: 'เสี่ยลูกกนบยนต์',
    storeTel: '094-746-8751',
    storeEmail: 'nookcar@gmail.com',
    storeAddress: 'kmitl กรุงเทพฯ',
    footerNote: 'โปรดนำใบรับประกันฉบับนี้มาแสดงเป็นหลักฐานทุกครั้งเมื่อใช้บริการ',
    company: { name: 'Phumcar', address: 'kmitl กรุงเทพฯ', tel: '094-746-8751' },
  };

  const item = {
    productName: 'iPhone 16 Pro',
    model: 'A3106',
    serialNumber: 'SN0012345678',
    purchaseDate: '2025-10-19',
  };

  doc.pipe(out);
  drawWarrantyPage(doc, base, item);
  doc.end();

  await new Promise((res) => out.on('finish', res));
  console.log('Wrote sample-warranty.pdf');
}

gen().catch((e) => { console.error(e); process.exit(1); });
