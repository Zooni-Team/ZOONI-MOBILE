# Arquitectura

← [índice](README.md) · reglas en [convenciones](convenciones.md) · datos en [servicios](servicios.md) y [base de datos](base-de-datos.md)

## Capas

```
screens/  ──►  components/ (ui/, por módulo)        presentación
   │             │
   │             └──► theme/  (colores, sombras)     estilos → estilos.md
   ▼
hooks/   ──►  services/  ──►  lib/supabase.js  ──►  Supabase (Postgres + RLS,
   │             │                                    Auth, Storage, Edge Functions)
   ▼             ▼
utils/  ·  domain/  ·  constants/                    lógica pura → utilidades.md
```

- **screens/**: una carpeta por "app" (dueño en la raíz, `Paseador/`, `Negocio/`,
  `Configuracion/`, `Comunidad/`). Arman la pantalla con componentes y llaman
  servicios. No importan `lib/supabase` directamente.
- **components/**: `ui/` son piezas genéricas (Toast, Skeleton); el resto está
  agrupado por módulo (`match/`, `paseador/`, `negocio/`…). Catálogo:
  [componentes.md](componentes.md).
- **services/**: única capa que habla con Supabase. Un archivo por dominio.
  Comparten `comun.js` (errores, notificaciones) y `perfilesPublicos.js`
  (datos de otras personas). Ver [servicios.md](servicios.md).
- **domain/**: reglas de negocio puras (sin base ni UI), probables sin conexión.
  Hoy: `paseos.js`.
- **utils/**: helpers puros compartidos. **constants/**: catálogos fijos.
  **hooks/**: estado reutilizable entre pantallas.
- **theme/**: sistema de diseño ([estilos.md](estilos.md)).
- **config/session.js**: el `Id_User` de la sesión de Supabase Auth.

## De la pantalla a la base (ejemplo: pedir un turno)

1. `ReservarTurnoScreen` arma los datos y llama `negocioApi.crearTurno(...)`.
2. `crearTurno` revisa disponibilidad (para avisar rápido) e inserta en
   `negocio_turnos` con el cliente de `lib/supabase.js`, que agrega el **JWT**.
3. Postgres aplica **RLS** (`turnos_pedir`: sólo podés pedir turnos a tu nombre
   y para tus mascotas) y el **trigger** `_turno_al_crear` (candado por negocio,
   superposición, precio válido). Ver [flujos.md](flujos.md#turnos).
4. Si algo falla, el trigger lanza `horario_ocupado` / `precio_invalido` y el
   servicio lo traduce con `errorApp` para que la pantalla muestre el mensaje.

## Carpetas del repositorio

| Carpeta | Qué es |
|---|---|
| `zooni-app/` | La app. `src/` (código), `tests/`, `scripts/` (verificaciones), `wwwroot/img` (ilustraciones) |
| `supabase/migrations/` | Esquema completo, en orden. Única fuente de verdad de la base |
| `supabase/functions/` | Edge Functions: `zoonivet-chat`, `migrar-cuenta` |
| `supabase/scripts/` · `tests/` | Armar `schema.sql`, el paquete para Supabase y probar todo en Postgres local |
| `docs/claude/` | Esta documentación |
| `prompts/` · `Imagenes-Figma/` | Especificaciones y diseños originales de cada pantalla |
