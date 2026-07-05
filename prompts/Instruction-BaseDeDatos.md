=== ZOONI — BASE DE DATOS (SUPABASE / POSTGRESQL) ===

Estado actual de la base de datos de Zooni y cómo dejarla al día. La app mobile
(zooni-app) habla DIRECTO con Supabase usando supabase-js — no hay backend
propio corriendo (la carpeta zooni-api quedó como referencia histórica).

──────────────────────────────────────
CONEXIÓN
──────────────────────────────────────

  · Cliente:     zooni-app/src/lib/supabase.js  (URL del proyecto + anon key)
  · Sesión:      zooni-app/src/config/session.js — guarda el Id_User logueado en
                 SecureStore (clave 'zooni_user_id'); todos los servicios llaman
                 getCurrentUserId() al armar sus queries. Sin login usa el
                 usuario demo (id 1) para que las pantallas muestren datos.

──────────────────────────────────────
MIGRACIÓN ÚNICA A EJECUTAR
──────────────────────────────────────

Todo el schema vivo está consolidado en UN archivo idempotente (se puede correr
más de una vez sin romper nada: usa IF NOT EXISTS y los seeds solo insertan si
la tabla está vacía):

  zooni-app/src/database/migrations/010_supabase_live_setup.sql

Cómo ejecutarlo:
  1. Entrar a https://supabase.com/dashboard → proyecto Zooni.
  2. SQL Editor → New query.
  3. Pegar el contenido completo del archivo 010 y Run.

Los archivos 001–009 son historia previa (algunos incluso en dialecto MySQL);
NO hace falta correrlos: el 010 ya incluye todo lo que la app usa hoy.

──────────────────────────────────────
AUTENTICACIÓN (LOGIN / REGISTRO)
──────────────────────────────────────

Servicio: zooni-app/src/services/authApi.js

CÓMO FUNCIONA HOY (interim, sin Supabase Auth):
  · Login: busca el mail en la tabla "User" (case-insensitive) y compara
    "Contrasena" contra el hash SHA-256 de lo tipeado (expo-crypto).
    Fallback a texto plano para los usuarios demo sembrados por SQL.
  · Registro (Paso 4 del flujo): inserta User + Mascota (activa) + UserRole
    (rol OWNER, id 1). supabase-js no permite transacciones desde el cliente,
    así que si falla la mascota se hace rollback manual (DELETE del usuario
    recién creado) para no dejar cuentas huérfanas.
  · El registro NO inicia sesión: vuelve al Login con el banner de éxito y el
    usuario entra manualmente.

COLUMNAS QUE EL 010 AGREGA PARA ESTE FLUJO:

  "User":
    Pais            VARCHAR(100)   ← Registro Paso 4
    PaisCodigo      VARCHAR(5)     ← ISO del país (ej: 'AR')
    Provincia       VARCHAR(100)
    Ciudad          VARCHAR(100)
    CodigoTelefono  VARCHAR(10)    ← ej: '+54' (autocompletado por el país)
    (Ubicacion se sigue llenando con "Ciudad, Provincia" para las pantallas viejas)

  "Mascota":
    Sexo            VARCHAR(10)    ← 'Macho' / 'Hembra' (Registro Paso 2)
    ImagenAsset     VARCHAR(100)   ← key de petImages.js (ej: 'perro_default')
    EsActiva        BOOLEAN        ← la mascota del registro nace activa

PENDIENTE (cuando haya tiempo):
  · Migrar a Supabase Auth (bcrypt + JWT manejado por Supabase). authApi.js y
    session.js ya están escritos para que ese cambio no toque las pantallas.
  · Subir la foto de la mascota del registro a Supabase Storage (hoy la foto
    elegida queda solo en el dispositivo).

──────────────────────────────────────
CATÁLOGO DE RAZAS (REGISTRO PASO 2)
──────────────────────────────────────

Tabla nueva creada por el 010 (sección "5-bis"):

  razas (
    id       SERIAL PRIMARY KEY,
    especie  VARCHAR(50)  NOT NULL,  -- 'perro','gato','conejo','ave','reptil','pez','hamster','raton'
    nombre   VARCHAR(100) NOT NULL,
    activo   BOOLEAN DEFAULT TRUE,
    orden    INTEGER DEFAULT 0
  )  + índice idx_razas_especie

  · Seeds incluidos: 21 razas de perro, 7 de gato y las principales de conejo,
    ave, reptil, pez, hamster y ratón. Cada especie cierra con una opción
    "Mestizo / Sin raza definida" (orden 99).
  · El dropdown del Paso 2 las lee con fetchRazas(especie) de authApi.js:
    SELECT id, nombre FROM razas WHERE especie = X AND activo = TRUE ORDER BY orden.
  · Para AGREGAR una raza no hace falta deploy: INSERT directo en Supabase.
      INSERT INTO razas (especie, nombre, orden) VALUES ('perro', 'Akita', 21);
  · Para OCULTAR una raza sin borrarla:  UPDATE razas SET activo = FALSE WHERE id = X;
  · La mascota guarda el NOMBRE de la raza (Mascota.Raza es texto), no el id —
    igual que el resto de la app que ya leía Raza como string.

──────────────────────────────────────
VERIFICACIÓN RÁPIDA (correr en el SQL Editor)
──────────────────────────────────────

  -- ¿Existe el catálogo y tiene datos?
  SELECT especie, COUNT(*) FROM razas GROUP BY especie ORDER BY especie;

  -- ¿"User" tiene las columnas nuevas del registro?
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'User'
    AND column_name IN ('Pais','PaisCodigo','Provincia','Ciudad','CodigoTelefono');

  -- ¿"Mascota" tiene Sexo / ImagenAsset / EsActiva?
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'Mascota'
    AND column_name IN ('Sexo','ImagenAsset','EsActiva');

  -- Probar un registro de punta a punta desde la app y verlo:
  SELECT u."Id_User", u."Mail", u."Pais", m."Nombre", m."Especie", m."Raza", m."EsActiva"
  FROM "User" u JOIN "Mascota" m ON m."Id_User" = u."Id_User"
  ORDER BY u."Id_User" DESC LIMIT 5;

──────────────────────────────────────
RESTO DEL SCHEMA QUE MANEJA EL 010
──────────────────────────────────────

  · Ajustes a tablas existentes: "User" (Lat/Lng, Genero, FechaNacimiento,
    Intereses), "Vacuna" (Especie, FrecuenciaDescripcion), "MascotaVacuna"
    (NombreLibre, Tipo, Descripcion).
  · Catálogos: consejos_catalogo, tratamientos_catalogo, razas + seeds.
  · Módulo Comunidad: carteles, servicios, amistades, ubicaciones_usuarios.
  · RLS: deshabilitado en las tablas nuevas (la app usa la anon key). Cuando se
    migre a Supabase Auth hay que definir políticas RLS por usuario.
