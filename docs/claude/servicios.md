# Servicios (`zooni-app/src/services`)

← [índice](README.md) · la base en [base-de-datos](base-de-datos.md) · permisos en [seguridad](seguridad.md) · recorridos en [flujos](flujos.md) · tests en [testing](testing.md)

**Única capa que habla con Supabase.** Las pantallas nunca importan
`lib/supabase`.

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
| `authApi.js` | Login (`iniciarSesionConPassword`, `login`), registro (`crearCuentaConPassword`, `registro`), disponibilidad de mail/usuario, razas |
| `authLegado.js` | **Transición**: login viejo si `migrar-cuenta` no está desplegada. Borrar después ([pendientes](pendientes.md)) |
| `socialAuthApi.js` | Google / Facebook (OAuth con PKCE) |
| `api.js` | Home: usuario, mascota activa, notificaciones, configuración de botones |
| `petsApi.js` | Mascotas: alta, edición, archivo, borrado lógico, fotos |
| `fichaMedicaApi.js` | Vacunas, tratamientos, consultas, peso |
| `calendarioStore.js` | Calendario de cuidados |
| `matchApi.js` | Candidatos, votos (`votar_mascota`), perfil de Match |
| `chatStore.js` | Chats de Match y con negocios |
| `api/comunidad/index.js` | Mapa: servicios, carteles, amigos, ubicación |
| `lugaresApi.js` · `lugaresOsm.js` | Veterinarias/pet shops reales (Google Places u OpenStreetMap) |
| `sosApi.js` | Líneas de emergencia y veterinarias 24 h |
| `paseadorApi.js` | Zooni Paseadores: perfil, solicitudes, paseos, pagos, reseñas, chat de paseo. Lógica pura en `domain/paseos.js` |
| `negocioApi.js` | Zooni Negocios: perfil, catálogo, turnos, pedidos, pacientes, chat |
| `perfilApi.js` | Perfil propio, publicaciones, cambio de mail/contraseña (vía Supabase Auth) |
| `presenciaApi.js` | "Última vez en línea" |
| `moderacionApi.js` | Bloquear y reportar |
| `zoonivetApi.js` | Contexto de la mascota para los chips y pregunta a la Edge Function `zoonivet-chat` |
| `settingsStore.js` | Preferencias del dispositivo (Configuración) |
| `secciones.js` | Catálogo de secciones de Home y el menú |
