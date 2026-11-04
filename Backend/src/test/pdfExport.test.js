import test from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import { generateTransactionsPDF } from '../services/transactionExportService.js';

test('1. Verify PDFKit generates valid PDF buffer with %PDF- header', async () => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true });
  const buffers = [];
  doc.on('data', (c) => buffers.push(c));
  const endPromise = new Promise((resolve) => doc.on('end', resolve));

  doc.rect(36, 36, 770, 54).fill('#0F172A');
  doc.fillColor('#EA580C').font('Helvetica-Bold').fontSize(16).text('SEAFUDZ NG BAYAN', 50, 46);
  doc.end();
  await endPromise;

  const buf = Buffer.concat(buffers);
  assert.ok(buf.length > 500, 'Buffer must be valid');
  assert.equal(buf.toString('latin1', 0, 5), '%PDF-', 'Buffer must begin with %PDF- signature');
});

test('2. Verify generateTransactionsPDF function signature and export', async () => {
  assert.equal(typeof generateTransactionsPDF, 'function', 'generateTransactionsPDF must be an exported async function');
});

test('3. Test PDF layout and multi-page rendering logic', async () => {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 36,
    bufferPages: true,
  });

  const buffers = [];
  doc.on('data', (c) => buffers.push(c));
  const endPromise = new Promise((resolve) => doc.on('end', resolve));

  const margin = 36;
  const contentWidth = 770;

  // Header Banner
  doc.rect(margin, margin, contentWidth, 54).fill('#0F172A');
  doc.fillColor('#EA580C').font('Helvetica-Bold').fontSize(16).text('SEAFUDZ NG BAYAN', margin + 14, margin + 10);
  doc.fillColor('#F8FAFC').font('Helvetica-Bold').fontSize(9).text('HISTORICAL TRANSACTIONS & FINANCIAL AUDIT REPORT', margin + 14, margin + 32);

  // Add 40 rows to force page break
  let currentY = 120;
  for (let i = 0; i < 40; i++) {
    if (currentY + 20 > 535) {
      doc.addPage();
      currentY = margin;
    }
    doc.fillColor('#1E293B').font('Helvetica').fontSize(8).text(`Row #${i + 1} - Order SFB-TEST-${i + 1}`, margin, currentY);
    currentY += 20;
  }

  // Check buffered pages
  const range = doc.bufferedPageRange();
  assert.ok(range.count >= 2, 'Should span at least 2 pages');

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#64748B').fontSize(7.5).text(`Page ${i + 1} of ${range.count}`, margin + contentWidth - 100, 566);
  }

  doc.end();
  await endPromise;
  const finalPdf = Buffer.concat(buffers);
  assert.ok(finalPdf.length > 3000, 'Rendered multi-page PDF must be > 3000 bytes');
  assert.equal(finalPdf.toString('latin1', 0, 5), '%PDF-', 'Must start with %PDF-');
});
