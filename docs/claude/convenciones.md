# Convenciones

← [índice](README.md) · se aplican en [estilos](estilos.md), [componentes](componentes.md), [utilidades](utilidades.md), [servicios](servicios.md) · se verifican con [testing](testing.md)

## Idioma y nombres
- Código en **español rioplatense** (como el resto del repo):
  `fetchMisTurnos`, `crearPedido`, `colores.verde`.
- Componentes en `PascalCase.jsx`; módulos de lógica en `camelCase.js`.
- Booleanos que se leen como pregunta: `esEmailValido`, `haySesion`, `soyPaseador`.

## Imports
- Sin extensión dentro de la app (`'../utils/geo'`), **salvo** en módulos que
  también carga Node puro desde scripts (`utils/calcularEdad.js`,
  `utils/fichaPdf.js`): ahí `'./fechaLocal.js'`.
- Lógica sin UI (services, utils, constants, hooks) importa colores de
  `theme/colores`, no de `theme` (que trae el `ThemeProvider` con JSX).
- Orden: React/RN → librerías → módulos propios.

## Antes de escribir una función
Buscá en [utilidades.md](utilidades.md) y [componentes.md](componentes.md). Si
ya hay una parecida, extendela con un parámetro en vez de copiarla. Si la vas a
usar en dos lugares, va al módulo central desde el primer día.

## Errores
- Toda consulta revisa su `error`: `if (error) throw errorApp('codigo', error);`
  (`services/comun.js`). El código es lo que la pantalla traduce a un mensaje;
  `e.detalle` guarda el mensaje real de Supabase para el log.
- Nunca reemplazar un error por datos inventados ("modo demo").
- Las notificaciones (`notificar`) sí son "best effort": no rompen el flujo.

## Comentarios
- **No se escriben comentarios** en el código: ni en JS/JSX/TS, ni en SQL, ni
  en el HTML/JS armado como texto (mapas, PDF). Los nombres tienen que alcanzar
  para entender qué hace cada cosa.
- El **porqué** (decisión, bug que evitan, regla de negocio, seguridad) va en
  el doc del tema en `docs/claude/` y en el mensaje del commit.
- Tampoco directivas `eslint-disable`: los avisos de dependencias de hooks que
  quedan son conocidos (ver Calidad).

## Calidad
- `npm run lint`: **0 errores**. Quedan 17 avisos de dependencias de hooks
  (`react-hooks/exhaustive-deps`) que antes estaban silenciados con
  `eslint-disable`. Son omisiones a propósito: agregar la dependencia cambia
  cuándo corre el efecto, así que se revisan de a una, probando la pantalla.
- `npm test` en verde antes de commitear.
