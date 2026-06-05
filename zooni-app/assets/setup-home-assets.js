/**
 * Copia las imágenes de Home al proyecto.
 * Ejecutar desde zooni-app/:  npm run setup:home-assets
 *
 * Destino (carpeta final en el repo):
 *   zooni-app/assets/home_background.png  ← fondo hero (bosque)
 *   zooni-app/assets/perro_basico.png     ← mascota (sin fondo negro)
 */
const fs = require('fs');
const path = require('path');

const CURSOR_ASSETS = path.join(
  process.env.USERPROFILE || '',
  '.cursor',
  'projects',
  'c-Users-49374119-Downloads-ZOONI-MOBILE',
  'assets',
);

const SOURCES = {
  home_background:
    'c__Users_49374119_AppData_Roaming_Cursor_User_workspaceStorage_bba3665804b75a976902cf9d28a41306_images_bosque-ffe202f5-b982-40a7-8680-6d8a7a8f0561.png',
  perro_basico:
    'c__Users_49374119_AppData_Roaming_Cursor_User_workspaceStorage_bba3665804b75a976902cf9d28a41306_images_perro_basico-8eb5629b-34f1-474a-a8b0-15337e1b5766.png',
};

async function removeDarkBackground(inputPath, outputPath) {
  const sharp = require('sharp');
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 45 && g < 45 && b < 45) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outputPath);
}

async function main() {
  for (const [name, cursorFile] of Object.entries(SOURCES)) {
    const dest = path.join(__dirname, `${name}.png`);
    let src = path.join(CURSOR_ASSETS, cursorFile);

    if (!fs.existsSync(src) && fs.existsSync(dest)) {
      console.log(`↷ ${name}: ya existe en assets/, se reprocesa si es perro`);
      src = dest;
    }
    if (!fs.existsSync(src)) {
      console.warn(`⚠ No encontrado: ${name}`);
      console.warn(`  Guardá el PNG en: ${dest}`);
      continue;
    }

    if (name === 'perro_basico') {
      try {
        await removeDarkBackground(src, dest);
        console.log(`OK ${name} (fondo transparente) → ${dest}`);
      } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
          fs.copyFileSync(src, dest);
          console.warn('⚠ Instalá sharp: npm install -D sharp');
          console.warn('  Luego: npm run setup:home-assets');
        } else {
          throw e;
        }
      }
    } else {
      fs.copyFileSync(src, dest);
      console.log(`OK ${name} → ${dest}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
