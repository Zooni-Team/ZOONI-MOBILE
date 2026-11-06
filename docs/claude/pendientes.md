# Pendientes conocidos

← [índice](README.md) · Cada ítem dice dónde está. Al resolver uno, borralo de acá
y actualizá el doc que corresponda.

## Código
- **Elegir fotos repetido** en 18 lugares (permiso + galería/cámara):
  `Comunidad/FormularioCartel`, `match/MatchProfileSetup`, `match/PetMatchOnboarding`,
  `negocio/InformeModal`, `negocio/ItemFormModal`, `resenas/CalificarPaseoModal`,
  `Configuracion/AltaMascotaScreen`, `CuentaSeguridadScreen`, `EditarMascotaScreen`,
  `ConsultasScreen`, `MatchScreen`, `Negocio/NegocioRegistroScreen`,
  `Negocio/tabs/GaleriaTab`, `Negocio/tabs/MiNegocioTab`,
  `Paseador/PaseadorRegistroScreen`, `Paseador/tabs/PerfilTab`, `PerfilScreen`,
  `RegisterStep2Screen`. Propuesta: `utils/elegirImagen.js` →
  `elegirImagen({ origen: 'galeria' | 'camara', recorte, aspecto })` que
  devuelve el asset o `null` y lanza `sin_permiso`.
- **Componentes casi iguales**: `CardAplicado`/`CardSugerido` (Vacunas y
  Tratamientos), `EventoCard` (Calendario y Eventos), `Campo` e `InputPassword`
  (registros de Negocio y Paseador), `Estrellas` (3 lugares), `EspecieTile`
  (RegisterStep1 y AltaMascota).
- **7 avisos de `react-hooks/exhaustive-deps`** donde la dependencia faltante es
  una función (`cargarDatos`, `animarHero`, `onChatsSinLeer`, `valueFromX`,
  `updateFromX`): agregarla sin memoizarla genera loops. Hay que envolver esas
  funciones en `useCallback` una por una.
- **`authLegado.js`** y `consultaRespaldo` de `perfilesPublicos.js`: borrar
  cuando todas las cuentas hayan migrado (`select count(*) from user_credentials` = 0).

## Diseño
- Grises `gris50`–`gris600`: valores casi iguales heredados; definir una escala
  corta (ver [estilos.md](estilos.md)).
- Modo oscuro: no existe.

## Base y seguridad
- Imágenes de consultas veterinarias en el bucket público → bucket privado con
  URLs firmadas.
- Cascadas al borrar una mascota no son parejas (`eventos_calendario`,
  `historial_peso`, `consultas_veterinarias` con `CASCADE`; `MascotaVacuna`,
  `Tratamiento`, `HistorialEvento`, `Voto`, `Match` sin).
- Chats por consulta periódica → Supabase Realtime.
- `zoonivet-chat` sin límite de mensajes por usuario.
