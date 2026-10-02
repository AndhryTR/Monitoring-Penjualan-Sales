const fs = require('fs');
let code = fs.readFileSync('src/utils/imageExport.js', 'utf8');

// Colors
code = code.replace(/color:#64748B/g, 'color:#334155');
code = code.replace(/color:#475569/g, 'color:#1E293B');
code = code.replace(/color:#94A3B8/g, 'color:#475569');

// Fonts
code = code.replace(/font-size:10px/g, 'font-size:11.5px');
code = code.replace(/font-size:9\.5px/g, 'font-size:10.5px');
code = code.replace(/font-size:8\.5px/g, 'font-size:9.5px');
code = code.replace(/font-size:11px/g, 'font-size:12.5px');
code = code.replace(/font-size:10\.5px/g, 'font-size:12px');

// Deviasi colors
// Add helper function after pdfAchTextColor
if (!code.includes('pdfDeviasiTextColor')) {
  code = code.replace(
    'function pdfAchTextColor(ach) {',
    'function pdfDeviasiTextColor(dev) {\n  if (dev === null || dev === undefined) return \"#334155\";\n  return dev < 0 ? \"#059669\" : \"#DC2626\";\n}\n\nfunction pdfAchTextColor(ach) {'
  );
}

// Replace hardcoded deviasi colors in buildExcelReportHTML
// Sales deviasi
code = code.replace(
  /color:#DC2626;(.*?)>\\\$\\{fmtDeviasi\\(sm\\.deviasiValue\\)\\}/g,
  'color:\;\>\'
);

// Total depo deviasi
code = code.replace(
  /color:#F87171;(.*?)>\\\$\\{fmtDeviasi\\(totalDeviasiV\\)\\}/g,
  'color:\;\>\'
);

// Replace "* Produk fokus dalam karton"
code = code.replace(
  /\\* Produk fokus dalam karton/g,
  '* Kuantitas produk fokus mengikuti satuan target'
);

fs.writeFileSync('src/utils/imageExport.js', code);
console.log('imageExport.js updated.');
