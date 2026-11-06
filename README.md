# Zooni

App para personas con mascotas: ficha médica (vacunas, tratamientos, consultas,
peso), calendario de cuidados, Match entre mascotas, chat, Comunidad con mapa
(servicios, carteles de mascotas perdidas, amigos), SOS veterinario, el
asistente ZooniVet y dos "apps" para proveedores: **Zooni Paseadores** y
**Zooni Negocios** (veterinarias, peluquerías y pet shops con turnos y pedidos).

Proyecto escolar — Colegio ORT Argentina, 5to año Informática.
Equipo (según el historial de commits): Ignacio Eskenazi, Lucas Dueñaz,
Santi Dobro, Theo Valentín Trosman, Lior Tanel y Felipe Plat.

---

> **¿Vas a tocar el código?** Empezá por [`CLAUDE.md`](CLAUDE.md) (reglas) y
> [`docs/claude/`](docs/claude/README.md): arquitectura, convenciones, estilos,
> catálogo de componentes y utilidades, servicios, base de datos, seguridad,
> flujos, testing y deuda conocida.

## Arquitectura en una línea

```
zooni-app (Expo / React Native, web + móvil)
   │  supabase-js con la sesión de Supabase Auth (JWT)
   ▼
Supabase ── Postgres con RLS (quién ve qué fila)
        ├── Auth (contraseñas con bcrypt, Google, Facebook)
        ├── Storage (fotos; cada usuario sólo escribe en su carpeta)
        └── Edge Functions (lo que necesita un secreto: Groq, migrar cuentas)
```

No hay backend propio: la app habla directo con Supabase. Por eso **lo que
protege los datos es la base** (políticas RLS y funciones), no la app. La
clave pública que viaja en el bundle no protege nada sola.

## Qué hay en cada carpeta

| Carpeta | Qué es | ¿La usa la app? |
|---|---|---|
| `zooni-app/` | La app (Expo SDK 51, React Native 0.74, web con react-native-web). | Es la app |
| `zooni-app/src/screens` · `components` | Pantallas y componentes. | Sí |
| `zooni-app/src/services` | Única capa que habla con Supabase (un módulo por tema). | Sí |
| `zooni-app/src/domain` | Reglas puras, sin base ni pantalla (hoy: paseos). Se prueban sin conexión. | Sí |
| `zooni-app/src/utils` | Helpers compartidos: fechas, edades, texto, validación, distancias, PDF ([catálogo](docs/claude/utilidades.md)). | Sí |
| `zooni-app/src/theme` | Sistema de diseño: paleta única, sombras, tamaño de texto ([estilos](docs/claude/estilos.md)). | Sí |
| `zooni-app/src/components/ui` | Componentes genéricos (Toast, Skeleton) ([catálogo](docs/claude/componentes.md)). | Sí |
| `zooni-app/tests` | Tests con `node:test` y dobles de Supabase / React Native. | Desarrollo |
| `zooni-app/scripts` | Verificaciones: `verify:pdf` (ficha médica en PDF) y `verify:paseos`. | Desarrollo |
| `zooni-app/wwwroot/img` | Ilustraciones de mascotas por especie/raza (las importa `src/constants`). | Sí |
| `supabase/migrations` | **Esquema completo de la base**, en orden (000 → 063). Única fuente de verdad. | Sí |
| `supabase/schema.sql` | Las migraciones juntas para un proyecto vacío (generado). | Sí |
| `supabase/APLICAR_EN_SUPABASE.sql` | Paquete para el proyecto que ya existe: `051`–`063` en una transacción, con chequeo de prerrequisitos (generado). | Sí |
| `CLAUDE.md` · `docs/claude/` | Documentación para el equipo y para Claude. | Documentación |
| `supabase/functions` | Edge Functions: `zoonivet-chat` (Groq) y `migrar-cuenta`. | Sí |
| `supabase/tests` | Pruebas de RLS y reglas de negocio contra un Postgres local. | Desarrollo |
| `prompts/` | Especificaciones de cada pantalla con las que se diseñó la app (las citan algunos comentarios). | Documentación |
| `Imagenes-Figma/` | Diseños de referencia de cada pantalla. | Documentación |
| `vercel.json` | Despliegue web en Vercel (compila `zooni-app` a `zooni-app/dist`). | Despliegue |

Cómo comprobamos qué se usa: `scripts` aparte, todo módulo de `zooni-app/src`
es alcanzable desde `App.jsx` siguiendo los `import`. Lo que no lo era (un
backend Express sin ninguna pantalla que lo llamara, un backend .NET, un
prototipo de Comunidad, routers de servidor dentro de la app, scripts SQL de
MySQL y SQL Server) se borró; queda en el historial de git.

---

## Levantar el proyecto desde cero

### Lo que hace falta

- Node.js 20 o más y npm.
- Una cuenta de [Supabase](https://supabase.com) (plan gratis alcanza).
- La [CLI de Supabase](https://supabase.com/docs/guides/cli) para desplegar las Edge Functions.
- Opcional: cuenta de [Groq](https://console.groq.com) (ZooniVet), de Google
  Cloud (mapas con Places; sin ella se usa OpenStreetMap) y de Vercel (web).
- Para probar en el teléfono: la app Expo Go.

### 1. Base de datos (Supabase)

1. Crear un proyecto nuevo en Supabase.
2. **SQL Editor** → pegar `supabase/schema.sql` entero → Run.
   Crea tablas, relaciones, índices, funciones, políticas RLS, permisos, los
   buckets de Storage y los catálogos (roles, razas, vacunas, consejos…). Es
   idempotente: se puede volver a correr sin romper nada.
3. **Authentication → Providers → Email**: dejar habilitado.
   *Confirm email*: si está activado, al registrarse Supabase manda un mail y
   la persona tiene que confirmarlo y volver a registrarse con el mismo mail y
   contraseña para terminar (la app lo explica). Desactivarlo simplifica las
   pruebas, pero permite registrarse con un mail ajeno.
4. Opcional, login con Google / Facebook: **Authentication → Providers** y
   agregar la URL de la app en **URL Configuration → Redirect URLs**.

### 2. Edge Functions

```bash
supabase login
supabase link --project-ref <ref-del-proyecto>
supabase secrets set GROQ_API_KEY=gsk_...
supabase functions deploy zoonivet-chat
supabase functions deploy migrar-cuenta --no-verify-jwt
```

Las variables de cada función están en `supabase/functions/.env.example`.
`migrar-cuenta` se despliega sin verificación de JWT porque se llama antes de
tener sesión (ver "Pasar a Supabase Auth").

### 3. App

```bash
cd zooni-app
cp .env.example .env      # completar con la URL y la clave publicable
npm install
npm start                 # Expo: w = web, escanear QR = Expo Go
```

`.env.example` explica cada variable y cuáles son públicas. **Ninguna clave
secreta va en la app.**

### 4. Web en Vercel

`vercel.json` ya está configurado: importar el repo en Vercel y cargar las
mismas `EXPO_PUBLIC_*` en *Settings → Environment Variables*.

### Verificaciones

```bash
cd zooni-app
npm run lint              # ESLint: 0 errores
npm test                  # tests de utilidades y servicios + verify:pdf + verify:paseos
```

Esquema y seguridad (necesita un PostgreSQL local, no toca Supabase):

```bash
PGHOST=localhost PGUSER=postgres node supabase/scripts/probar-esquema.mjs
```

Corre todas las migraciones dos veces sobre una base vacía (desde cero e
idempotencia) y después `supabase/tests/pruebas_rls.sql`: dos usuarios con su
JWT comprueban, entre otras cosas, que uno no puede leer la ficha médica del
otro, que un pedido con total inventado se recalcula, que el último producto
no se vende dos veces y que dos turnos no se superponen.

---

## La base de datos

- **Un solo motor**: PostgreSQL (Supabase). Los scripts viejos de MySQL y SQL
  Server se quitaron.
- **Orden**: el del nombre de archivo en `supabase/migrations`. Para cambiar la
  base se agrega una migración nueva (idempotente: `IF NOT EXISTS`,
  `CREATE OR REPLACE`, `ON CONFLICT`) y se regenera `schema.sql` con
  `node supabase/scripts/armar-esquema.mjs`. Nada se cambia "a mano en el
  dashboard": si se hace, se escribe la migración.
- Migraciones clave:
  - `060_auth_supabase.sql` — la identidad es el JWT de Supabase Auth;
    `usuario_actual()` lo traduce a `Id_User`.
  - `061_rls_por_usuario.sql` — todas las políticas. Datos de salud: sólo el
    dueño de la mascota. `User`: sólo la fila propia; de los demás, la vista
    `perfil_publico` (sin mail, edad en vez de fecha de nacimiento, ubicación
    a ~1 km, teléfono sólo con un paseo/turno/pedido en común).
  - `062_reglas_negocio.sql` — precios, totales, stock, turnos, transiciones de
    paseos y Match se deciden en la base, en la misma transacción que la
    escritura.
  - `063_storage.sql` — buckets con límite de tamaño y tipos; cada usuario
    escribe sólo en su carpeta.
- Al borrar una mascota la app hace **borrado lógico** (`Estado`,
  `EliminadaEn`), así que hoy no se borra ninguna fila hija. Pero si alguien
  borrara la fila de verdad, las relaciones no son parejas:
  `eventos_calendario`, `historial_peso` y `consultas_veterinarias` tienen
  `ON DELETE CASCADE`; `MascotaVacuna`, `Tratamiento`, `HistorialEvento`,
  `Voto` y `Match` no (el borrado falla). Falta decidir una regla única.

## Pasar a Supabase Auth (cuentas existentes)

Antes, la app mandaba `sha256(contraseña)` y guardaba el número de usuario en el
dispositivo como "prueba" de identidad. Ahora el login es
`supabase.auth.signInWithPassword` y cada consulta lleva un JWT.

Las cuentas viejas no tienen que hacer nada: la primera vez que entran, si
Supabase Auth no las conoce, la app llama a `migrar-cuenta`, que comprueba la
contraseña contra el hash viejo, crea el usuario de Auth con esa misma
contraseña (bcrypt) y borra el hash viejo.

**Orden para aplicarlo en el proyecto que ya existe:**

1. Desplegar las Edge Functions (paso 2 de arriba).
2. Pegar **`supabase/APLICAR_EN_SUPABASE.sql`** entero en el SQL Editor → Run.
   Corre en una sola transacción, verifica primero que la base tenga las
   migraciones anteriores y se puede volver a correr.
3. Desplegar la app.
4. Cuando todas las cuentas hayan entrado una vez (`select count(*) from user_credentials` = 0),
   borrar `zooni-app/src/services/authLegado.js` y su uso en `authApi.js`, y el
   respaldo de `perfilesPublicos.js` (`consultaRespaldo`).

Mientras `migrar-cuenta` no esté desplegada, la app entra con el login viejo
(`authLegado.js`, sin guardar la sesión). Después de la `061` ese camino deja
de funcionar a propósito.

## Pendientes conocidos

- Las imágenes de consultas veterinarias están en el bucket público: deberían
  ir a un bucket privado con URLs firmadas.
- Los chats se actualizan consultando cada tanto; Supabase Realtime evitaría
  ese trabajo repetido.
- `zoonivet-chat` no tiene límite de mensajes por usuario (sólo el de Groq).
