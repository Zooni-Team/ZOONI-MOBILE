# Estilos (`zooni-app/src/theme`)

← [índice](README.md) · reglas en [convenciones](convenciones.md) · los usan los [componentes](componentes.md)

```js
import { colores, sombras } from '../theme';          // pantallas y componentes
import { colores } from '../theme/colores';           // lógica sin UI

const s = StyleSheet.create({
  card: { backgroundColor: colores.blanco, borderRadius: 18, ...sombras.tarjeta },
  titulo: { color: colores.texto },
});
```

## Paleta (`theme/colores.js`)
Nombres semánticos para **todos** los colores que se repetían. Se migró con un
codemod sobre el AST: ~2.500 literales en 125 archivos, sin cambiar ningún valor.

| Grupo | Nombres |
|---|---|
| Marca | `verde` (principal), `verdeOscuro`, `verdeExito`, `verdeBurbuja`, `menta`, `mentaSuave`, `mentaFondo`, `mentaTarjeta`, `mentaClara`, `mentaGris`, `mentaBorde`, `verdeGrisaceo`, `turquesa` |
| Acentos | `amarillo` (CTA), `ambar`, `ambarFondo`, `ambarOscuro`, `marron`, `violeta`, `azul`, `azulFondo` |
| Error | `rojo`, `rojoOscuro`, `rojoFondo`, `rojoBorde` |
| Texto | `texto`, `textoSecundario`, `textoTenue`, `textoDeshabilitado`, `textoGris` |
| Neutros | `blanco`, `negro`, `gris50` · `gris100` · `gris200` · `gris300` (bordes de inputs) · `gris400` |

- **Cambiar el color de marca = una línea** (`verde`).
- Un color nuevo que se use en más de un lugar → se agrega acá con nombre.
  Un color usado una sola vez puede quedar local.
- **Grises: cinco.** Eran once (`#F2F2F2`, `#F1F1F1`, `#EFEFEF`…) que se
  diferenciaban en 1 a 3 niveles de 255, imposibles de distinguir. Se
  unificaron al más cercano.
- `npm test` corre `scripts/verificar-colores.mjs`: falla si un hex de la
  paleta (o uno de los grises viejos) aparece escrito a mano fuera de
  `colores.js`. En HTML armado como texto (mapas de Leaflet, PDF) se interpola:
  `` `background:${colores.verde}` ``. Los comentarios pueden nombrar hex.

## Sombras (`theme/sombras.js`)
| Sombra | Para |
|---|---|
| `sombras.tarjeta` | tarjetas de listas (`PaseadorUI` la re-exporta como `sombra`) |
| `sombras.suave` | botones chicos y chips |
| `sombras.sutil` | tarjetas con borde dentro de una hoja blanca |
| `sombras.modal` | ventanas modales centradas |

## Tamaño de texto y accesibilidad (`theme/ThemeProvider.js`)
`ThemeProvider` (en `App.jsx`) escala toda la tipografía según Configuración ›
Tema. `useTheme()` expone `fontScale`, `reduceMotion` y `highContrast`.
El modo oscuro no existe todavía (se resuelve como claro).

## Kits de UI por "app"
- `components/paseador/PaseadorUI.jsx`: `C` (tokens del modo proveedor),
  `PillButton`, `Card`, `Chip`, `Avatar`, `Stat`, `Seccion`, `Vacio`… Lo usan
  también las pantallas de Negocios.
- `components/negocio/NegocioUI.jsx`: `EstadoChip`, `Etiqueta`, `Segmento`,
  `TurnoCard`, `PedidoCard`, `MotivoModal`.
- `components/settings/SettingsKit.jsx`: filas y secciones de Configuración.
