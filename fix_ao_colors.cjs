const fs = require('fs');
let code = fs.readFileSync('src/utils/imageExport.js', 'utf8');

code = code.replace(
  'color:#334155;font-weight:700;border:1px solid #E2E8F0;background:${rowBg};">${fmtDeviasiAo(sm.deviasiAo)}</td>',
  'color:${pdfDeviasiTextColor(sm.deviasiAo)};font-weight:700;border:1px solid #E2E8F0;background:${rowBg};">${fmtDeviasiAo(sm.deviasiAo)}</td>'
);

code = code.replace(
  'color:#334155;border:1px solid #E2E8F0;background:${rowBg};">${fmtDeviasiAo(g.deviasiAo)}</td>',
  'color:${pdfDeviasiTextColor(g.deviasiAo)};border:1px solid #E2E8F0;background:${rowBg};">${fmtDeviasiAo(g.deviasiAo)}</td>'
);

code = code.replace(
  'text-align:center;border:1px solid #334155;">${fmtDeviasiAo(totalDeviasiAo)}</td>',
  'text-align:center;color:${pdfDeviasiTextColor(totalDeviasiAo)};border:1px solid #334155;">${fmtDeviasiAo(totalDeviasiAo)}</td>'
);

fs.writeFileSync('src/utils/imageExport.js', code);
