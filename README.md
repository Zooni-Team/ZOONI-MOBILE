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
        └── Edge Functions (lo que necesita un secreto: Groq)
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
| `zooni-app/src/domain` | Reglas puras, sin base ni pantalla (paseos y negocios). Se prueban sin conexión. | Sí |
| `zooni-app/src/hooks` | Carga de datos de las pantallas grandes (Inicio, Calendario, Eventos, salud) y piezas reutilizables. | Sí |
| `zooni-app/src/utils` | Helpers compartidos: fechas, edades, texto, validación, distancias, PDF ([catálogo](docs/claude/utilidades.md)). | Sí |
| `zooni-app/src/theme` | Sistema de diseño: paleta única, sombras, tamaño de texto ([estilos](docs/claude/estilos.md)). | Sí |
| `zooni-app/src/components/ui` · `salud` · … | Componentes compartidos por tema ([catálogo](docs/claude/componentes.md)). | Sí |
| `zooni-app/tests` | Tests con `node:test` y dobles de Supabase / React Native. | Desarrollo |
| `zooni-app/scripts` | Verificaciones: `verify:pdf` (ficha médica en PDF), `verify:paseos` y `verify:colores`. | Desarrollo |
| `zooni-app/wwwroot/img` | Ilustraciones de mascotas por especie/raza (las importa `src/constants`). | Sí |
| `supabase/SUPABASE_PEGAR_TODO.sql` | **Esquema base** de la base (secciones 000 → 063). | Sí |
| `supabase/MIGRACION_064…072_*.sql` | Lo que vino después, **en orden** (064 → 068, 070 → 072; no hay 069). Base + estas = la base completa. | Sí |
| `supabase/scripts` | `probar-esquema.mjs` (reconstruye la base en un Postgres local y prueba la seguridad) y `limpiar-storage.mjs` (borra archivos huérfanos y muda imágenes clínicas viejas al bucket privado). | Desarrollo / mantenimiento |
| `CLAUDE.md` · `docs/claude/` | Documentación para el equipo y para Claude. | Documentación |
| `supabase/functions` | Edge Function `zoonivet-chat` (ZooniVet: Groq con la clave del lado del servidor). | Sí |
| `supabase/tests` | Pruebas de RLS y reglas de negocio contra un Postgres local. | Desarrollo |
| `prompts/` | Especificaciones de cada pantalla con las que se diseñó la app (las citan algunos comentarios). | Documentación |
| `Imagenes-Figma/` | Diseños de referencia de cada pantalla. | Documentación |
| `api/lugares.js` | Función de Vercel para el mapa de Servicios (OpenStreetMap con caché en el CDN). | Sí |
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
- La [CLI de Supabase](https://supabase.com/docs/guides/cli) para desplegar la Edge Function de ZooniVet.
- Opcional: cuenta de [Groq](https://console.groq.com) (ZooniVet), de Google
  Cloud (mapas con Places; sin ella se usa OpenStreetMap) y de Vercel (web).
- Para probar en el teléfono: la app Expo Go.

### 1. Base de datos (Supabase)

1. Crear un proyecto nuevo en Supabase.
2. **SQL Editor** → pegar cada archivo entero y Run, **en este orden**:
   1. `supabase/SUPABASE_PEGAR_TODO.sql` (tablas, relaciones, índices,
      funciones, RLS, permisos, buckets y catálogos: roles, razas, vacunas…)
   2. `supabase/MIGRACION_064_SOBRE_063.sql`
   3. `supabase/MIGRACION_065_LOGIN_CUENTAS_VIEJAS.sql`
   4. `supabase/MIGRACION_066_RLS_REAPLICAR.sql`
   5. `supabase/MIGRACION_067_CERRAR_FUNCIONES.sql`
   6. `supabase/MIGRACION_068_ARCHIVOS_HUERFANOS.sql`
   7. `supabase/MIGRACION_070_ENDURECIMIENTO_SEGURIDAD.sql` (no hay 069).
      **Obligatoria**: la app lee las mascotas ajenas por la vista
      `mascota_publica` que crea esta migración; sin ella, Match y Comunidad
      quedan vacíos.
   8. `supabase/MIGRACION_071_INTEGRIDAD.sql`
   9. `supabase/MIGRACION_072_BAJA_DE_CUENTA.sql`

   Cada uno corre en una transacción y verifica lo que hizo al final (si algo
   no queda bien, no cambia nada). Toda la secuencia es idempotente: se puede
   volver a correr entera. Lo que **no** hay que hacer es volver a pegar sólo
   el primero sobre una base que ya tiene los demás.
3. **Authentication → Providers → Email**: dejar habilitado.
   *Confirm email*: si está activado, al registrarse Supabase manda un mail y
   la persona tiene que confirmarlo y volver a registrarse con el mismo mail y
   contraseña para terminar (la app lo explica). Desactivarlo simplifica las
   pruebas, pero permite registrarse con un mail ajeno.
4. Opcional, login con Google / Facebook: **Authentication → Providers** y
   agregar la URL de la app en **URL Configuration → Redirect URLs**.

### 2. Edge Function (ZooniVet)

```bash
supabase login
supabase link --project-ref <ref-del-proyecto>
supabase secrets set GROQ_API_KEY=gsk_...
supabase secrets set ALLOWED_ORIGINS=https://tu-dominio.vercel.app   # sin esto, la web no puede llamarla
supabase functions deploy zoonivet-chat
```

Las variables de la función están en `supabase/functions/.env.example`. Sin
este paso la app funciona igual; sólo ZooniVet avisa que no está disponible.

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
npm test                  # tests + verify:pdf + verify:paseos + verify:colores
```

Esquema y seguridad (necesita un PostgreSQL local, no toca Supabase):

```bash
PGHOST=localhost PGUSER=postgres node supabase/scripts/probar-esquema.mjs
```

Corre la secuencia completa (base + `MIGRACION_064…072`) dos veces sobre una
base vacía (desde cero e idempotencia) y después `supabase/tests/*.sql`: dos
usuarios con su JWT comprueban, entre otras cosas, que uno no puede leer la ficha médica del
otro, que un pedido con total inventado se recalcula, que el último producto
no se vende dos veces y que dos turnos no se superponen.

---

## La base de datos

- **Un solo motor**: PostgreSQL (Supabase). Los scripts viejos de MySQL y SQL
  Server se quitaron.
- **Orden**: `SUPABASE_PEGAR_TODO.sql` y después `MIGRACION_0NN_*.sql` por
  número. Para cambiar la base se agrega la siguiente `MIGRACION_0NN_*.sql`
  (idempotente: `IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT`; con su
  verificación al final y su `supabase/tests/pruebas_0NN.sql`). Nada se
  cambia "a mano en el dashboard": si se hace, se escribe la migración.
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
  - `064` — cascadas parejas al borrar una mascota, purga de eliminadas,
    bucket privado de consultas, chats por Realtime y cupo de ZooniVet.
  - `066` — paseos vencidos / superpuestos / en el pasado, historial de peso
    por trigger, nadie opina de sí mismo, sin veterinarias inventadas.
    `MIGRACION_066_RLS_REAPLICAR.sql` además rehace todas las políticas RLS.
  - `067` — funciones `SECURITY DEFINER` cerradas por lista blanca, límite de
    intentos en el login de cuentas viejas, nadie se marca "verificado".
  - `068` — archivos de Storage que quedan sin uso (mascota, foto o consulta
    borradas) quedan anotados para `supabase/scripts/limpiar-storage.mjs`, que
    además muda las imágenes clínicas viejas al bucket privado. Se borran las
    RPC del login viejo con hash.
  - `070` — auditoría de seguridad: `"Mascota"` sólo devuelve las filas
    propias (lo ajeno, por `mascota_publica`), notificaciones sólo por RPC,
    anti-trampa del progreso de un paseo. Va después de la 066 a propósito.
  - `071` — el anti-trampa del paseo con un margen que no se acumula, límite
    de 10 mascotas activas, mascota principal en una transacción y fecha de
    los mensajes puesta por la base.
  - `072` — eliminar la cuenta (30 días de gracia; después se borra lo
    personal y la fila queda anonimizada), contraseña débil heredada pedida
    en cada login hasta cambiarla, peso y nacimiento para el paseador o
    negocio que atiende a la mascota, `search_path` en las funciones viejas.
- **Mapa de Servicios**: los locales de OpenStreetMap pasan por la función de
  Vercel `api/lugares.js` (Overpass con User-Agent propio; si está saturado,
  Nominatim), cacheada un día en el CDN.
- Al borrar una mascota la app hace **borrado lógico** (`Estado = 'deleted'`,
  `PurgarDespues` = +30 días). `purgar_mascotas_eliminadas()` (064) la borra de
  verdad pasado ese plazo; si `pg_cron` está habilitado corre sola cada noche.
  Regla única de FKs hacia `Mascota`: columna NOT NULL → `CASCADE` (salud,
  votos, matches, fotos); columna que admite NULL → `SET NULL` (publicaciones,
  carteles, SOS, turnos). `Paseo` queda con `SET NULL` para no perder lo que
  cobró el paseador.

## Pasar a Supabase Auth (cuentas existentes)

Antes, la app mandaba `sha256(contraseña)` y guardaba el número de usuario en el
dispositivo como "prueba" de identidad. Ahora el login es
`supabase.auth.signInWithPassword` y cada consulta lleva un JWT.

Las cuentas viejas no tienen que hacer nada: la primera vez que entran, si
Supabase Auth no las conoce, la app llama a la función de la base
`migrar_cuenta_legada` (065), que comprueba la contraseña contra el hash
viejo, crea el usuario de Auth con esa misma contraseña (bcrypt) y borra el
hash viejo. Tiene límite de 5 intentos fallidos cada 15 minutos por mail (067).
No hace falta desplegar nada: la Edge Function `migrar-cuenta` que se usaba
antes se eliminó.

## Pendientes conocidos

Ver [faltaporhacer.md](faltaporhacer.md).
