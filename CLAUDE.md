# Zooni — guía para Claude (y para cualquiera que toque el código)

App para personas con mascotas (Expo / React Native + web) sobre Supabase, sin
backend propio. Antes de escribir código, leé esto y el documento del tema que
vas a tocar. **Si algo ya existe, se reutiliza; si no existe y se va a usar en
más de un lugar, se crea en el lugar central y se documenta acá.**

## Mapa de la documentación

Todo vive en [`docs/claude/`](docs/claude/README.md). Cada documento enlaza a
los que dependen de él.

| Si vas a… | Leé |
|---|---|
| Entender cómo encaja todo | [arquitectura.md](docs/claude/arquitectura.md) |
| Escribir cualquier código (nombres, imports, errores, comentarios) | [convenciones.md](docs/claude/convenciones.md) |
| Usar un color, una sombra o el tamaño de texto | [estilos.md](docs/claude/estilos.md) |
| Mostrar un aviso, un loading, elegir una fecha/hora/opción | [componentes.md](docs/claude/componentes.md) |
| Formatear fechas, edades, buscar texto, validar, medir distancias | [utilidades.md](docs/claude/utilidades.md) |
| Leer o escribir en la base | [servicios.md](docs/claude/servicios.md) |
| Cambiar la base (tablas, RLS, funciones) | [base-de-datos.md](docs/claude/base-de-datos.md) |
| Login, permisos, secretos, archivos | [seguridad.md](docs/claude/seguridad.md) |
| Seguir un flujo de punta a punta (pedido, paseo, match…) | [flujos.md](docs/claude/flujos.md) |
| Probar lo que hiciste | [testing.md](docs/claude/testing.md) |
| Saber qué deuda conocida queda | [faltaporhacer.md](faltaporhacer.md) |

## Las 10 reglas

1. **Una sola fuente por cosa.** Colores → `src/theme`. Fechas → `utils/fechaLocal`.
   Edades → `utils/calcularEdad`. Distancias → `utils/geo`. Texto → `utils/texto`.
   Avisos → `ui/Toast` + `useToast`. Loading → `ui/Skeleton`. Fechas a elegir →
   `FechaPicker`. Fotos a elegir → `utils/elegirImagen`. Estrellas → `ui/Estrellas`.
   Campos de formulario → `ui/CampoFormulario`. Chats en vivo → `useRecargaEnVivo`.
   Si escribís una función que ya existe, borrala y usá la central.
2. **Sólo `src/services/*` habla con Supabase.** Las pantallas llaman servicios.
3. **La base decide lo que importa.** Identidad (JWT), permisos (RLS), precios,
   totales, stock y transiciones de estado se validan en Postgres
   (`supabase/SUPABASE_PEGAR_TODO.sql`, secciones 060–066). La app valida para avisar rápido, nunca
   como garantía.
4. **Nada de colores hex sueltos** si el color está en la paleta: `colores.verde`.
5. **Nada de `new Date('YYYY-MM-DD')`**: corre el día en Argentina. Usá
   `parseFechaLocal` / `formatearFecha`.
6. **De otras personas, sólo `perfil_publico`** (vía `services/perfilesPublicos`),
   pidiendo las columnas que se muestran.
7. **Ninguna clave secreta en la app.** Todo `EXPO_PUBLIC_*` es público.
8. **Los errores no se tragan**: `if (error) throw errorApp('codigo', error)`
   (`services/comun.js`). Nada de datos inventados ("modo demo") cuando falla algo.
9. **Comentarios que explican el porqué**, y que sigan siendo verdad. Si cambiás
   el comportamiento, actualizá el comentario y el doc.
10. **Antes de commitear:** `cd zooni-app && npm run lint && npm test`. Si tocaste
    la base: `node supabase/scripts/probar-esquema.mjs`.

## Comandos

```bash
cd zooni-app
npm start                 # Expo
npm run lint              # ESLint (0 errores)
npm test                  # tests + verify:pdf + verify:paseos
```

```bash
node supabase/scripts/probar-esquema.mjs          # esquema desde cero + RLS (Postgres local)
```
