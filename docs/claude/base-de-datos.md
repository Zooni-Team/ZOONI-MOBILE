# Base de datos

← [índice](README.md) · seguridad en [seguridad](seguridad.md) · reglas en [flujos](flujos.md) · pruebas en [testing](testing.md)

## Un solo archivo
**`supabase/SUPABASE_PEGAR_TODO.sql`** es TODA la base (PostgreSQL / Supabase):
tablas, relaciones, índices, funciones, triggers, RLS, permisos, Storage y
catálogos. Se pega entero en Supabase → SQL Editor → Run.
- Idempotente: sirve para un proyecto vacío y para el que ya tiene datos.
- Corre en una transacción: si algo falla, no se aplica nada.
- Está dividido en secciones `000` → `063` (marcadas `>>>> NNN_nombre <<<<`).
- Antes: desplegar las Edge Functions `migrar-cuenta` y `zoonivet-chat`.

### Cambiar la base
1. Agregá una sección nueva **al final** (antes de "Verificación final"),
   idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT`,
   `DROP POLICY IF EXISTS`). Tabla nueva = RLS + políticas en la misma sección.
2. `node supabase/scripts/probar-esquema.mjs` (Postgres local: corre el archivo
   dos veces + `supabase/tests/pruebas_rls.sql`).
3. Pegá en Supabase sólo la sección nueva (o el archivo entero, es idempotente).
   Nada se cambia "a mano en el dashboard" sin escribirlo acá.

## Tablas

| Área | Tablas | Dueño de la fila |
|---|---|---|
| Cuentas | `User` (+ `auth_id` → `auth.users`), `UserRole`, `Role`, `user_credentials` (hashes viejos, se vacía al migrar), `user_settings`, `user_sessions`, `subscriptions`, `deletion_requests`, `data_export_requests`, `app_usage_daily` | `User.Id_User` / `user_id` |
| Mascotas | `Mascota`, `mascota_fotos`, `mascota_estado_historial` | `Mascota.Id_User` |
| Salud | `MascotaVacuna`, `Tratamiento`, `HistorialEvento`, `historial_peso`, `consultas_veterinarias`, `eventos_calendario` | sólo el dueño de la mascota |
| Catálogos (lectura pública) | `Vacuna`, `razas`, `avatares_catalogo`, `consejos_catalogo`, `tratamientos_catalogo`, `emergency_lines`, `veterinary_clinics`, `Clinica`, `Veterinario`, `eventos`, `organizadores_verificados` | — |
| Social | `Publicacion`, `Comentario`, `carteles`, `amistades`, `ubicaciones_usuarios`, `usuarios_bloqueados`, `blocked_users`, `muted_users`, `reportes`, `Notificacion` | el autor / participantes |
| Match | `Voto`, `Match` (lo crea sólo `votar_mascota()`), `Mensaje` (chats de Match y con negocios) | participantes |
| Paseos | `paseador_perfil`, `Paseo`, `PaseoTrack`, `paseo_mensajes`, `paseo_rechazos`, `paseo_pagos`, `paseo_cuenta_config`, `paseador_opiniones`, `paseo_transiciones` | dueño y paseador |
| Negocios | `negocio_perfil`, `negocio_items`, `negocio_turnos`, `negocio_pedidos`, `servicios` (pines del mapa) | cliente y negocio |
| SOS | `sos_events`, `sos_call_logs`, `emergency_contacts` | el usuario |
| Internas | `__MigrationLog`, `zooni_politica_tablas` | nadie desde la app |

Vista **`perfil_publico`**: lo que se ve de otra persona (sin mail, edad en vez
de fecha, ubicación a ~1 km, teléfono sólo con un paseo/turno/pedido en común).

## Funciones y triggers importantes
| Qué | Dónde (sección) |
|---|---|
| `usuario_actual()` — JWT → `Id_User`; base de todas las políticas | 060 |
| `login_social()`, `registrar_social_con_mascota`, `registrar_paseador_social`, `activar_paseador_social`, `registrar_negocio_sesion`, `activar_negocio_sesion` — altas y login con sesión de Auth | 043, 060 |
| `disponibilidad_registro(mail, usuario)` | 060 |
| `_credencial_legada`, `_completar_migracion_cuenta` — para `migrar-cuenta` (sólo service_role) | 060 |
| Helpers RLS: `es_mi_mascota`, `soy_dueno_negocio`, `soy_dueno_servicio`, `participo_en_match`, `participo_en_paseo`, `soy_walker_de_paseo`, `soy_paseador`, `son_amigos`, `tengo_trato_con` | 061 |
| Pedidos: `_pedido_al_crear` (precios, total, reserva de stock con bloqueo), `_pedido_al_actualizar` (transiciones, devuelve stock) | 062 |
| Turnos: `_turno_al_crear` (candado por negocio, superposición, precio válido), `_turno_al_actualizar` | 062 |
| Paseos: `precio_paseo`, `comision_zooni`, `_paseo_al_crear`, `_paseo_al_actualizar`, `aceptar_solicitud_paseo` | 062 |
| Match: `votar_mascota(origen, destino, le_gusta)` | 062 |
| ZooniVet: `get_pet_chat_context(pet_id)` (sólo service_role) | 051, 061 |
| Storage: buckets `public-images` (5 MB) y `resenas` (50 MB), carpeta por usuario | 063 |

## Relaciones a revisar
Borrado de mascotas: la app hace borrado lógico. Las FK hijas no son parejas
(ver [faltaporhacer.md](../../faltaporhacer.md)).
