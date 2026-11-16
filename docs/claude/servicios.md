# Servicios (`zooni-app/src/services`)

← [índice](README.md) · la base en [base-de-datos](base-de-datos.md) · permisos en [seguridad](seguridad.md) · recorridos en [flujos](flujos.md) · tests en [testing](testing.md)

**Única capa que habla con Supabase.** Las pantallas y los componentes nunca
importan `lib/supabase` (lo comprueba `tests/imports.test.mjs`).

## Cómo se escribe una función de servicio

```js
import { supabase } from '../lib/supabase';
import { errorApp } from './comun';

export async function fetchMisTurnos() {
  const { data, error } = await supabase.from('negocio_turnos')
    .select('id, fecha, estado')            // sólo las columnas que se usan
    .eq('id_dueno', getCurrentUserId());    // filtro para la consulta; la
                                            // garantía es RLS (061)
  if (error) throw errorApp('error_base', error);
  return data.map(mapTurno);
}
```

- Columnas explícitas, no `select('*')` en datos de otras personas.
- Datos de **otras personas** → `perfilesPublicos.perfilesPorId(ids, columnas)`.
- Reglas que mueven plata o estado → las decide la base; el servicio traduce
  sus errores (`horario_ocupado`, `sin_stock`, `transicion_invalida`…).
- Avisar a alguien → `notificar(idUser, titulo, mensaje, { tipo, destino })`.

## Catálogo

| Servicio | Responsabilidad |
|---|---|
| `comun.js` | `errorApp`, `errorBase`, `esEsquemaFaltante`, `esFuncionInexistente`, `esSinPermiso`, `notificar`, `resumir` |
| `perfilesPublicos.js` | Lectura de otras personas vía la vista `perfil_publico` |
| `authApi.js` | Login (`iniciarSesionConPassword`, `login`; las cuentas viejas se migran con `migrar_cuenta_legada`, 065), registro (`crearCuentaConPassword`, `registro`), `mailDeLaSesion`, disponibilidad de mail/usuario, razas |
| `socialAuthApi.js` | Google / Facebook (OAuth con PKCE) |
| `api.js` | Home: usuario, mascota activa, notificaciones, configuración de botones |
| `petsApi.js` | Mascotas: alta, edición, archivo, borrado lógico, fotos |
| `fichaMedicaApi.js` | Vacunas, tratamientos, consultas, peso |
| `calendarioStore.js` | Calendario de cuidados |
| `matchApi.js` | Candidatos, votos (`votar_mascota`), perfil de Match |
| `chatStore.js` | Chats de Match y con negocios |
| `comunidadApi.js` | Mapa: servicios, carteles, amigos, ubicación |
| `geocodificacion.js` | Texto ↔ coordenadas con Nominatim (`buscarLugares`, `ubicarDireccion`, `barrioDe`, `direccionDe`) |
| `imagenStorage.js` | Subir a Storage: `subirImagenPublica`, `subirArchivoPublico`, `subirImagenPrivada` (clínico) y `urlsFirmadas` |
| `usoApp.js` | Tiempo de uso por día (`app_usage_daily`) y avisos de bienestar (límite, descanso, resumen) |
| `lugaresApi.js` · `lugaresOsm.js` | Veterinarias/pet shops reales (Google Places u OpenStreetMap) |
| `sosApi.js` | Líneas de emergencia y veterinarias 24 h |
| `paseadorApi.js` → `paseador/*` | Zooni Paseadores. `paseadorApi.js` sólo reexporta; el código está partido por tema: `cuenta` (login, altas, roles), `perfil`, `paseos` (solicitudes y estados), `pagos` (cuenta corriente, ganancias), `resenas`, `chat` (mensajes e inbox), `notificaciones`, `ladoDueno` (buscar paseadores, pedir y cancelar), `avisos`. Lógica pura en `domain/paseos.js` |
| `negocioApi.js` → `negocio/*` | Zooni Negocios. Reexporta `negocio/`: `cuenta`, `perfil` (y pin del mapa, ficha pública), `catalogo`, `turnos` (y pacientes), `pedidos` (y clientes), `resumen`, `chat`, `enriquecer`, `avisos`. Lógica pura (horarios, turnos libres, precios, envío, pasos de un turno o pedido) en `domain/negocios.js` |
| `perfilApi.js` | Perfil propio, publicaciones, cambio de mail/contraseña (vía Supabase Auth) |
| `presenciaApi.js` | "Última vez en línea" |
| `moderacionApi.js` | Bloquear y reportar |
| `zoonivetApi.js` | Contexto de la mascota para los chips y pregunta a la Edge Function `zoonivet-chat` |
| `settingsStore.js` | Preferencias del dispositivo (Configuración) |
| `secciones.js` | Catálogo de secciones de Home y el menú |

## Puertas de entrada y lógica pura

`paseadorApi.js` y `negocioApi.js` son "barriles": las pantallas importan de
ahí y no les importa en qué archivo vive cada función. Las funciones **puras**
(formatos, precios, horarios) no se importan del barril sino de `domain/`:
son las que se prueban sin conexión (`npm run verify:paseos`,
`tests/servicios.test.mjs`). Para responder "¿cómo calcularías el precio de un
paseo sin Supabase?": `domain/paseos.js → precioPara`.
