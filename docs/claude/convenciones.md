# Convenciones

← [índice](README.md) · se aplican en [estilos](estilos.md), [componentes](componentes.md), [utilidades](utilidades.md), [servicios](servicios.md) · se verifican con [testing](testing.md)

## Idioma y nombres
- Código y comentarios en **español rioplatense** (como el resto del repo):
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
- Explican **por qué** (decisión, bug que evitan, regla de negocio), no qué hace
  cada línea.
- Si dicen algo de seguridad o arquitectura, tiene que ser verdad hoy. Si cambia
  el código, se actualiza el comentario y el doc correspondiente.
- Cabecera de archivo: `nombre.js — qué es` + cómo se usa.

## Calidad
- `npm run lint`: **0 errores**. Quedan 7 avisos de dependencias de hooks
  documentados en [faltaporhacer.md](../../faltaporhacer.md).
- `npm test` en verde antes de commitear.
