/**
 * @deprecated Usá: npm run setup:home-assets
 */
const fs = require('fs');
const path = require('path');

const src = path.join(
  process.env.USERPROFILE || '',
  '.cursor',
  'projects',
  'c-Users-49374119-Downloads-ZOONI-MOBILE',
  'assets',
  'c__Users_49374119_AppData_Roaming_Cursor_User_workspaceStorage_bba3665804b75a976902cf9d28a41306_images_perro_basico-8eb5629b-34f1-474a-a8b0-15337e1b5766.png',
);

const dst = path.join(__dirname, 'perro_basico.png');

if (!fs.existsSync(src)) {
  console.error('No se encontró la imagen origen:', src);
  console.error('Copiá manualmente perro_basico.png a zooni-app/assets/');
  process.exit(1);
}

fs.copyFileSync(src, dst);
const size = fs.statSync(dst).size;
console.log('OK →', dst, '(' + size + ' bytes)');
try {
  fs.writeFileSync(path.join(__dirname, '..', '..', 'copy-perro.ok.txt'), String(size));
} catch { /* opcional */ }
