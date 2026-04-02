const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function run() {
  console.log('Loading pdf...');
  // Create a minimal dummy PDF to test
  const pdfOutput = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n199\n%%EOF',
    'utf-8'
  );

  const parser = new PDFParse({ data: pdfOutput });
  try {
    const res = await parser.getText({ first: 12 });
    console.log('Success!', typeof res.text);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
run();
