# Base de datos

← [índice](README.md) · seguridad en [seguridad](seguridad.md) · reglas en [flujos](flujos.md) · pruebas en [testing](testing.md)

## Una secuencia, en orden
La base completa (PostgreSQL / Supabase) es:

1. **`supabase/SUPABASE_PEGAR_TODO.sql`** — base `000` → `063`: tablas,
   relaciones, índices, funciones, triggers, RLS, permisos, Storage y
   catálogos (secciones marcadas `>>>> NNN_nombre <<<<`).
2. **`supabase/MIGRACION_064_*.sql` … `MIGRACION_068_*.sql`**, por número.
3. **`supabase/MIGRACION_070_ENDURECIMIENTO_SEGURIDAD.sql`** — la auditoría de
   nov-2026 (150 hallazgos, `INFORME_SEGURIDAD_ZOONI.md`). En vez de reescribir
   las secciones viejas, corrige "encima" con `CREATE OR REPLACE` /
   `DROP POLICY IF EXISTS` + `CREATE POLICY` / `REVOKE`+`GRANT`. Va **última**
   a propósito: endurece varias políticas que la 066 restituye permisivas, y la
   que corre al final es la que queda.
4. **`supabase/MIGRACION_071_INTEGRIDAD.sql`** — después de la 070: el
   anti-trampa del paseo con ancla fija (el margen ya no se acumula update a
   update), el límite de 10 mascotas activas en la base,
   `marcar_mascota_principal()` en una transacción y la fecha de cada mensaje
   puesta por la base. La app funciona con o sin ella (marcar principal cae
   al camino viejo si la RPC no existe).
5. **`supabase/MIGRACION_072_BAJA_DE_CUENTA.sql`** — después de la 071:
   "Eliminar mi cuenta" de verdad (`solicitar_eliminacion_cuenta`, la cuenta
   se oculta 30 días, `login_social` la recupera, `purgar_cuentas_eliminadas`
   anonimiza; corre dentro de `_purgar_datos_antiguos`), la contraseña débil
   de una cuenta migrada marcada en `"User".DebeCambiarContrasena` hasta que
   se cambie, la vista `mascota_de_cliente` (peso y nacimiento para el
   paseador o negocio que atiende a la mascota) y `search_path` fijo en las
   funciones viejas que no lo tenían. Sin ella, la baja de cuenta muestra
   "falta la migración 072"; lo demás sigue andando.

Cada archivo se pega **entero** en Supabase → SQL Editor → Run. Cada uno:
- corre en una transacción (si algo falla, no se aplica nada);
- empieza comprobando que esté el anterior y termina verificando lo que hizo
  (si la verificación falla, ROLLBACK);
- es idempotente: la secuencia entera se puede volver a correr.

⚠ Nunca volver a pegar sólo `SUPABASE_PEGAR_TODO.sql` en una base que ya tiene
las migraciones: reabriría lo que ellas cierran. Siempre la secuencia.

### Cambiar la base
1. Creá `supabase/MIGRACION_0NN_QUE_HACE.sql` con el mismo formato (chequeo
   del anterior, `BEGIN`…`COMMIT`, verificación al final), idempotente
   (`IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT`, `DROP … IF EXISTS`).
   Tabla nueva = RLS + políticas en la misma migración. Función `SECURITY
   DEFINER` nueva = `REVOKE … FROM public, anon, authenticated` explícito y,
   si la llama la app, agregarla a la lista blanca de la 067.
2. Sus pruebas en `supabase/tests/pruebas_0NN.sql` y sumarlas a
   `supabase/scripts/probar-esquema.mjs`.
3. `node supabase/scripts/probar-esquema.mjs` (Postgres local: secuencia
   completa dos veces + todas las pruebas).
4. Pegarla en Supabase. Nada se cambia "a mano en el dashboard".

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
| Helpers RLS: `es_mi_mascota`, `soy_dueno_negocio`, `soy_dueno_servicio`, `participo_en_match`, `participo_en_paseo`, `soy_walker_de_paseo`, `soy_paseador`, `son_amigos`, `tengo_trato_con` | 061 |
| Pedidos: `_pedido_al_crear` (precios, total, reserva de stock con bloqueo), `_pedido_al_actualizar` (transiciones, devuelve stock) | 062 |
| Turnos: `_turno_al_crear` (candado por negocio, superposición, precio válido), `_turno_al_actualizar` | 062 |
| Paseos: `precio_paseo`, `comision_zooni`, `_paseo_al_crear`, `_paseo_al_actualizar`, `aceptar_solicitud_paseo` | 062 |
| Match: `votar_mascota(origen, destino, le_gusta)` | 062 |
| ZooniVet: `get_pet_chat_context(pet_id)` (sólo service_role) | 051, 061 |
| Storage: buckets `public-images` (5 MB) y `resenas` (50 MB), carpeta por usuario | 063 |
| Storage privado: `consultas-privadas` (10 MB, URLs firmadas); `consultas_veterinarias.imagen_path` | 064 |
| `purgar_mascotas_eliminadas()` — borra las `deleted` vencidas (sólo service_role / pg_cron) | 064 |
| ZooniVet: `zoonivet_consumir_cupo(id_user, limite)` + tabla `zoonivet_uso` (sólo service_role) | 064 |
| Realtime: `Mensaje` y `paseo_mensajes` en la publicación `supabase_realtime` | 064 |
| `migrar_cuenta_legada(mail, contraseña)` — cuenta vieja (sha256) → Supabase Auth, la llama el login sin sesión (anon) | 065 |
| Paseos: estado `vencido`, `vencer_paseos()` (app + pg_cron cada 15 min), `_paseo_validar_alta` (no en el pasado, con dirección, sin superponer la misma mascota), `_paseo_validar_cambio` (un vencido no se acepta ni inicia) | 066 |
| `_mascota_registrar_peso`: todo cambio de `Mascota.Peso` deja su punto en `historial_peso` | 066 |
| `paseador_opiniones`: nadie opina de sí mismo (política) | 066 |
| Sin veterinarias de ejemplo en `veterinary_clinics` (desactivadas) | 066 |
| Funciones SECURITY DEFINER cerradas por lista blanca; `migracion_intentos` (5 fallos / 15 min); `_sin_autoverificarse` | 067 |
| `archivos_por_borrar` + triggers en `Mascota`, `mascota_fotos`, `consultas_veterinarias`; `archivos_para_borrar()`, `consultas_a_privatizar()`, `privatizar_imagen_consulta()` (sólo service_role, los usa `supabase/scripts/limpiar-storage.mjs`). Se borran las RPC del login con hash | 068 |

**Si una base muestra datos ajenos** (pasó en producción: una política
`USING (true)` creada a mano sobrevivía, y como las políticas se suman con OR,
anulaba las de 061): pegar `supabase/MIGRACION_066_RLS_REAPLICAR.sql`. Borra
TODAS las políticas de `public`, las vuelve a crear y verifica con la sesión
de un usuario real que `User` devuelve 1 fila. Nunca crear políticas desde el
dashboard: sólo en el SQL del repo.

## Borrado de mascotas
La app hace borrado lógico (`Estado = 'deleted'`, `PurgarDespues` = +30 días) y
`purgar_mascotas_eliminadas()` borra la fila después. Regla única para toda FK
hacia `Mascota` (064): columna NOT NULL → `ON DELETE CASCADE`; columna que
admite NULL → `ON DELETE SET NULL`. `Paseo.Id_Mascota` admite NULL a propósito
(el paseo guarda lo que cobró el paseador) y `_paseo_al_actualizar` acepta ese
NULL sólo si la mascota ya no existe. Los mensajes de un `Match` se van con él.
Los archivos de Storage de la mascota quedan anotados (068) y los borra
`supabase/scripts/limpiar-storage.mjs`.
