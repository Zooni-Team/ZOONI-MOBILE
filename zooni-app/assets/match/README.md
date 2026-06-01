# Imágenes Match

1. Agregá tu foto vertical: **`pet-placeholder.png`** (recomendado ~390×520 px).
2. En `src/constants/matchAssets.js`, descomentá:
   ```js
   export const MATCH_PET_PLACEHOLDER = require('../../assets/match/pet-placeholder.png');
   ```
   y en `resolvePetPhotoSource` devolvé `MATCH_PET_PLACEHOLDER` cuando no haya URL.

Sin ese archivo, la app muestra un placeholder verde con ícono de huella.
