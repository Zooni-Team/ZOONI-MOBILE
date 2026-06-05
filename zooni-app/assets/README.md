# Imágenes de la Home — dónde van

Las imágenes que subís quedan guardadas **acá**, en esta carpeta:

| Archivo | Qué es |
|---------|--------|
| `home_background.png` | Fondo del hero (paisaje verde / bosque) |
| `perro_basico.png` | Ilustración de la mascota (PNG transparente) |

Ruta completa en tu PC:

`C:\Users\49374119\Downloads\ZOONI-MOBILE\zooni-app\assets\`

El código las importa desde `src/constants/homeAssets.js`.

## Instalar desde el chat (recomendado)

```bash
cd zooni-app
npm install -D sharp
npm run setup:home-assets
```

Eso copia el **bosque** y el **perro**, y quita el cuadrado negro del perro.

## Manual

1. Exportá el perro como PNG **con transparencia**.
2. Pegá los archivos en `zooni-app/assets/` con los nombres de la tabla.
3. Reiniciá Expo.

## Origen temporal (solo el script)

Cursor guarda adjuntos en:

`%USERPROFILE%\.cursor\projects\c-Users-49374119-Downloads-ZOONI-MOBILE\assets\`

El script lee de ahí y escribe en `zooni-app/assets/`.
