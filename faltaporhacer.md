# Falta por hacer

Estado al cortar la refactorización. Ordenado por prioridad.

## 1. Para que lo hecho funcione (hacerlo YA, en este orden)
1. **Desplegar las Edge Functions** (si no, las cuentas viejas no pueden entrar
   después del paso 2):
   ```bash
   supabase login
   supabase link --project-ref <ref-del-proyecto>
   supabase functions deploy migrar-cuenta --no-verify-jwt
   supabase secrets set GROQ_API_KEY=gsk_...
   supabase functions deploy zoonivet-chat
   ```
2. **Pegar `supabase/SUPABASE_PEGAR_TODO.sql` entero** en Supabase → SQL Editor → Run.
3. Authentication → Providers → Email: habilitado (decidir "Confirm email", ver README).
4. Cargar en Vercel las variables de `zooni-app/.env.example` y redesplegar.
5. Probar en la app real: login con cuenta vieja, registro, Match (like
   recíproco), pedido en pet shop, turno, paseo completo, ZooniVet, subir foto.
   Nada de esto se probó contra la base real (sólo contra Postgres local y
   dobles de prueba).
6. Cuando `select count(*) from user_credentials` dé 0: borrar
   `zooni-app/src/services/authLegado.js`, su uso en `authApi.js` y
   `consultaRespaldo` en `services/perfilesPublicos.js`.

## 2. Refactor pendiente (código)
- **Elegir fotos repetido en 18 archivos** (permiso + galería/cámara). Crear
  `utils/elegirImagen.js` y reemplazar en: `Comunidad/FormularioCartel`,
  `match/MatchProfileSetup`, `match/PetMatchOnboarding`, `negocio/InformeModal`,
  `negocio/ItemFormModal`, `resenas/CalificarPaseoModal`,
  `Configuracion/AltaMascotaScreen`, `CuentaSeguridadScreen`,
  `EditarMascotaScreen`, `ConsultasScreen`, `MatchScreen`,
  `Negocio/NegocioRegistroScreen`, `Negocio/tabs/GaleriaTab`,
  `Negocio/tabs/MiNegocioTab`, `Paseador/PaseadorRegistroScreen`,
  `Paseador/tabs/PerfilTab`, `PerfilScreen`, `RegisterStep2Screen`.
- **Componentes casi iguales a unificar**: `CardAplicado`/`CardSugerido`
  (Vacunas y Tratamientos), `EventoCard` (Calendario y Eventos), `Campo` e
  `InputPassword` (registros de Negocio y Paseador), `Estrellas` (3 lugares),
  `EspecieTile` (RegisterStep1 y AltaMascota), `PetIllustration` (Home y Ficha).
- **7 avisos de ESLint** (`react-hooks/exhaustive-deps`): envolver en
  `useCallback` `cargarDatos` (Closet, Eventos), `animarHero` (Consultas,
  Tratamientos), `onChatsSinLeer` (PaseadorHeader), `valueFromX`/`updateFromX`
  (sliders de Match).
- Smoke test en el navegador: se probó login y registro paso 1–2 (FechaPicker);
  falta recorrer el resto de pantallas con una base real.
- Pantallas gigantes (SRP): `EventosScreen`, `CalendarioScreen`, `HomeScreen`,
  `TratamientosScreen`, `VacunasScreen` (800–1000 líneas): separar
  subcomponentes en archivos y la carga de datos en hooks.
- `services/paseadorApi.js` (~1.500 líneas) y `negocioApi.js` (~1.200): partir
  por tema (perfil, solicitudes, pagos, reseñas, chat / catálogo, turnos, pedidos).

## 3. Diseño
- Grises `gris50`–`gris600` en `src/theme/colores.js`: definir una escala corta.
- Modo oscuro: no existe.

## 4. Base y seguridad
- Imágenes de consultas veterinarias en bucket público → bucket privado con URLs firmadas.
- Cascadas al borrar mascota no son parejas (`eventos_calendario`,
  `historial_peso`, `consultas_veterinarias` con CASCADE; `MascotaVacuna`,
  `Tratamiento`, `HistorialEvento`, `Voto`, `Match` sin).
- Chats por consulta periódica → Supabase Realtime.
- Límite de mensajes por usuario en `zoonivet-chat`.

## 5. Defensa oral
Repasar `docs/claude/flujos.md` (responde las preguntas del PDF) y la sección
060–062 de `SUPABASE_PEGAR_TODO.sql`.
