# Testing

← [índice](README.md) · qué se prueba: [utilidades](utilidades.md), [servicios](servicios.md), [base-de-datos](base-de-datos.md)

## App (`cd zooni-app`)

```bash
npm run lint   # ESLint: 0 errores
npm test       # node:test (tests/*.test.mjs) + verify:pdf + verify:paseos + verify:colores
```

- `tests/utils.test.mjs` — fechas, edades, texto, validación, geo, sanitizar,
  tiempo relativo, integridad de la paleta.
- `tests/servicios.test.mjs` — servicios contra un **doble de Supabase**:
  login y migración de cuentas, registro, disponibilidad, sesión, Match,
  ZooniVet, precios/envíos/estados de negocios, errores de pedidos y turnos.
- `tests/imports.test.mjs` — cada `import { x } from './modulo'` de `src/`
  existe de verdad (Metro no lo comprueba: un nombre mal escrito llega como
  `undefined` y explota recién al tocar el botón), y ninguna pantalla ni
  componente importa `lib/supabase`.
- `tests/usoApp.test.mjs` — tiempo en la app.
- `tests/limpiarStorage.test.mjs` — `supabase/scripts/limpiar-storage.mjs`
  contra un Supabase simulado: qué borra, qué muda y que en modo prueba no
  toca nada.
- `scripts/verificar-colores.mjs` — ningún color de la paleta escrito a mano.
- `scripts/verificar-ficha-pdf.mjs` — genera el PDF real y lee lo dibujado.
- `scripts/verificar-paseos.mjs` — reglas de `domain/paseos.js` y `utils/geo.js`.

### Cómo funciona el doble
`tests/cargador.mjs` (hooks de módulos de Node) resuelve imports como Metro y
reemplaza `lib/supabase`, React Native, SecureStore y las imágenes por
`tests/dobles/*`. En un test:

```js
import { fake } from './dobles/supabase.mjs';
fake.reiniciar();
fake.rpc('votar_mascota', { data: { match: true } });          // respuesta de una RPC
fake.responder((op) => op.tabla === 'User' ? { data: [] } : {}); // respuesta por consulta
await postMatchLike(20);
assert.deepEqual(fake.de('rpc')[0].params, { ... });             // qué se le pidió a la base
```

Un módulo con JSX no se puede cargar en Node: la lógica que quieras probar va a
`utils/`, `domain/` o `services/` (otra razón para separarla de las pantallas).

## Base de datos

```bash
PGHOST=localhost PGUSER=postgres node supabase/scripts/probar-esquema.mjs
```
Base temporal `zooni_prueba` con `tests/shim_supabase.sql` (roles, `auth.uid()`,
storage): corre la secuencia (`SUPABASE_PEGAR_TODO.sql` + `MIGRACION_064…068`)
**dos veces** y `tests/pruebas_rls.sql` + `pruebas_064…068.sql`
(dos usuarios con su JWT: ficha médica ajena, mail ajeno, pedidos con total
inventado, último producto, turnos superpuestos, paseos, Match, cambio de mail,
cuentas viejas). Una aserción que falla corta con error.

## Prueba de humo en el navegador
No hay una base de Supabase de prueba, así que la app web se prueba contra un
Supabase **simulado**: se exporta (`npx expo export --platform web`) con una
URL falsa y un navegador sin cabeza (Playwright) responde cada pedido a
`/rest/v1` y `/auth/v1` con datos de prueba. Sirve para recorrer las pantallas,
ver errores de consola y qué escribe cada acción. No reemplaza probar contra
la base real (las políticas RLS sólo se prueban con `probar-esquema.mjs`).
