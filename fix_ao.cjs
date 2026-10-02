const fs = require('fs');
let code = fs.readFileSync('src/utils/imageExport.js', 'utf8');

code = code.replace(
  '${fmtNum(sm.deviasiAo)}',
  '${fmtDeviasiAo(sm.deviasiAo)}'
);

code = code.replace(
  '${fmtNum(g.deviasiAo)}',
  '${fmtDeviasiAo(g.deviasiAo)}'
);

code = code.replace(
  '${fmtNum(totalDeviasiAo)}',
  '${fmtDeviasiAo(totalDeviasiAo)}'
);

fs.writeFileSync('src/utils/imageExport.js', code);
