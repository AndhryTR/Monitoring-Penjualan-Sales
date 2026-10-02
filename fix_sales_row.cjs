const fs = require('fs');
let code = fs.readFileSync('src/utils/imageExport.js', 'utf8');

// replace buildSalesRowHtml
code = code.replace(
  'color: i === achIndex ? c.achColor : undefined',
  'color: c.color || (i === achIndex ? c.achColor : undefined)'
);
// replace buildGroupRowHtml
code = code.replace(
  'color: i === achIndex ? c.achColor : undefined',
  'color: c.color || (i === achIndex ? c.achColor : undefined)'
);

// also let's pass color for deviasi in buildSalesRowHtml and buildGroupRowHtml
// Section 2: s.deviasiValue
code = code.replace(
  /content: s\.deviasiValue !== null \? fmtDeviasi\(s\.deviasiValue\) : "-", align: "right" \}/g,
  'content: s.deviasiValue !== null ? fmtDeviasi(s.deviasiValue) : "-", align: "right", color: pdfDeviasiTextColor(s.deviasiValue) }'
);
// Section 2: g.deviasiValue
code = code.replace(
  /content: g\.deviasiValue !== null \? fmtDeviasi\(g\.deviasiValue\) : "-", align: "right" \}/g,
  'content: g.deviasiValue !== null ? fmtDeviasi(g.deviasiValue) : "-", align: "right", color: pdfDeviasiTextColor(g.deviasiValue) }'
);

fs.writeFileSync('src/utils/imageExport.js', code);
