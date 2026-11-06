# Testing

← [índice](README.md) · qué se prueba: [utilidades](utilidades.md), [servicios](servicios.md), [base-de-datos](base-de-datos.md)

## App (`cd zooni-app`)

```bash
npm run lint   # ESLint: 0 errores
npm test       # node:test (tests/*.test.mjs) + verify:pdf + verify:paseos
```

- `tests/utils.test.mjs` — fechas, edades, texto, validación, geo, sanitizar,
  tiempo relativo, integridad de la paleta.
- `tests/servicios.test.mjs` — servicios contra un **doble de Supabase**:
  login y migración de cuentas, registro, disponibilidad, sesión, Match,
  ZooniVet, precios/envíos/estados de negocios, errores de pedidos y turnos.
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
storage): corre todas las migraciones **dos veces** y `tests/pruebas_rls.sql`
(dos usuarios con su JWT: ficha médica ajena, mail ajeno, pedidos con total
inventado, último producto, turnos superpuestos, paseos, Match, cambio de mail,
cuentas viejas). Una aserción que falla corta con error.
