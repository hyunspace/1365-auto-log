// Vercel 빌드 단계: 환경변수 WEBAPP_URL로 config.js를 만든다. (config.js는 커밋하지 않는다)
const fs = require('fs');
const path = require('path');

const url = (process.env.WEBAPP_URL || '').trim();
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
  console.error('WEBAPP_URL 환경변수를 확인해 주세요. (예: https://script.google.com/macros/s/<배포ID>/exec)');
  process.exit(1);
}
fs.writeFileSync(path.join(__dirname, 'config.js'), `window.APP_CONFIG = ${JSON.stringify({ WEBAPP_URL: url })};\n`);
console.log('config.js 생성 완료');
