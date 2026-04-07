// PDF.js worker를 public/에 복사 (postinstall에서 호출)
const fs = require('fs');
const src = 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
const dst = 'public/pdf.worker.min.mjs';
if (fs.existsSync(src) && !fs.existsSync(dst)) {
  fs.copyFileSync(src, dst);
  console.log('[postinstall] pdf.worker.min.mjs copied to public/');
} else if (fs.existsSync(dst)) {
  console.log('[postinstall] pdf.worker.min.mjs already exists');
}
