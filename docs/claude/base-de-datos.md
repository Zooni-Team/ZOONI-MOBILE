# Base de datos (`supabase/`)

← [índice](README.md) · seguridad en [seguridad](seguridad.md) · reglas en [flujos](flujos.md) · pruebas en [testing](testing.md)

## Fuente de verdad
- `supabase/migrations/` — **todo** el esquema, en orden de nombre
  (`000` → `063`). PostgreSQL / Supabase únicamente.
- `supabase/schema.sql` — las migraciones juntas para un proyecto **vacío**
  (generado: `node supabase/scripts/armar-esquema.mjs`).
- `supabase/APLICAR_EN_SUPABASE.sql` — el paquete para el proyecto **que ya
  existe**: `051`–`063` + chequeo de prerrequisitos, en una transacción
  (generado: `node supabase/scripts/armar-paquete-supabase.mjs`).

## Cambiar la base
1. Nueva migración `NNN_que_hace.sql` (siguiente número). Idempotente:
   `IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT`, `DROP POLICY IF EXISTS`.
2. Si crea una tabla: RLS + políticas en el mismo archivo (sin política, nadie accede).
3. `node supabase/scripts/probar-esquema.mjs` (Postgres local): corre todo dos
   veces y las pruebas de `tests/pruebas_rls.sql`. Agregá una prueba.
4. Regenerá `schema.sql` y el paquete. Nada se cambia "a mano en el dashboard".

## Migraciones clave
| Archivo | Qué hace |
|---|---|
| `060_auth_supabase.sql` | `User.auth_id`, `usuario_actual()` (JWT → Id_User), `disponibilidad_registro`, soporte de `migrar-cuenta`, sincronización del mail con Auth |
| `061_rls_por_usuario.sql` | Todas las políticas RLS, vista `perfil_publico`, permisos por columna de `User` |
| `062_reglas_negocio.sql` | Triggers de pedidos (total, stock con bloqueo), turnos (candado, superposición, precio), paseos (precio, transiciones por rol en `paseo_transiciones`), `votar_mascota()` |
| `063_storage.sql` | Buckets con tamaño y tipos permitidos; cada usuario escribe en su carpeta |

## Funciones auxiliares de RLS
`usuario_actual()`, `es_mi_mascota(id)`, `soy_dueno_negocio(id)`,
`soy_dueno_servicio(id)`, `participo_en_match(id)`, `participo_en_paseo(id)`,
`soy_walker_de_paseo(id)`, `soy_paseador()`, `son_amigos(id)`,
`tengo_trato_con(id)`. Todas `SECURITY DEFINER` (no disparan RLS dentro de RLS).

## Relaciones a revisar
Borrado de mascotas: la app hace borrado lógico. Las FK hijas no son parejas
(algunas con `ON DELETE CASCADE`, otras no): ver [pendientes.md](pendientes.md).
