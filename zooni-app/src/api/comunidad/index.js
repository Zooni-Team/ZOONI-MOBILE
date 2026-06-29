// Datos hardcodeados — Díaz Vélez y Jerónimo Salguero, CABA
const AMIGOS_MOCK = [
  { usuario_id: 2, nombre: 'Martina García',   mascota_nombre: 'Luna',  distancia_km: 0.2, online: true,  lat: -34.6082, lng: -58.4320 },
  { usuario_id: 3, nombre: 'Diego Fernández',  mascota_nombre: 'Rocky', distancia_km: 0.5, online: true,  lat: -34.6105, lng: -58.4355 },
  { usuario_id: 4, nombre: 'Valentina López',  mascota_nombre: 'Milo',  distancia_km: 1.1, online: false, lat: -34.6065, lng: -58.4298 },
];

const SERVICIOS_MOCK = [
  { id: 1, nombre: 'Veterinaria San Martín',        tipo: 'veterinaria', direccion: 'Av. Díaz Vélez 3820',     telefono: '011 4855-2290', descripcion: 'Atención general y urgencias las 24 hs.',      lat: -34.6075, lng: -58.4305 },
  { id: 2, nombre: 'Paseadores Crespo',              tipo: 'paseador',    direccion: 'Jerónimo Salguero 2145',  telefono: '11 6234-5678',  descripcion: 'Paseos grupales e individuales en Caballito.', lat: -34.6100, lng: -58.4350 },
  { id: 3, nombre: 'Pet Shop El Hueso',              tipo: 'petshop',     direccion: 'Av. Díaz Vélez 3650',     telefono: '011 4854-9900', descripcion: 'Alimentos, accesorios y ropa para mascotas.', lat: -34.6060, lng: -58.4340 },
  { id: 4, nombre: 'Peluquería Canina Mimados',      tipo: 'peluqueria',  direccion: 'Jerónimo Salguero 2230',  telefono: '11 5567-4321',  descripcion: 'Baño, corte y estética canina.',               lat: -34.6110, lng: -58.4300 },
  { id: 5, nombre: 'Clínica Veterinaria del Parque', tipo: 'veterinaria', direccion: 'Av. Rivadavia 4855',      telefono: '011 4901-1122', descripcion: 'Especialistas en dermatología y oncología.',   lat: -34.6050, lng: -58.4318 },
];

const CARTELES_MOCK = [
  {
    id: 1, tipo: 'perdida',
    mascota_nombre: 'Toto', mascota_especie: 'Perro', mascota_raza: 'Poodle blanco',
    descripcion: 'Se busca Poodle blanco llamado Toto. Desapareció el sábado cerca del Parque Rivadavia. Muy manso, tiene collar azul con chapita.',
    telefono_contacto: '11 5566-7788', publicado_por: 'Carla M.',
    created_at: '2026-06-27T18:30:00Z', usuario_id: 99,
    lat: -34.6085, lng: -58.4315,
  },
  {
    id: 2, tipo: 'aviso_general',
    descripcion: 'Se encontró gata gris con collar rojo en Pringles al 200. Está en buen estado esperando a su dueño. Llamar para coordinar rescate.',
    telefono_contacto: '11 4455-6677', publicado_por: 'Vecino de Pringles',
    created_at: '2026-06-28T10:15:00Z', usuario_id: 88,
    lat: -34.6095, lng: -58.4325,
  },
];

const SOLICITUDES_MOCK = [
  { id: 101, nombre: 'Carlos Beni' },
];

export const fetchMapaData = () =>
  Promise.resolve({ servicios: SERVICIOS_MOCK, carteles: CARTELES_MOCK, amigos: AMIGOS_MOCK });

export const fetchServicios = (_bbox, tipo) => {
  const lista = tipo && tipo !== 'todos'
    ? SERVICIOS_MOCK.filter(s => s.tipo === tipo)
    : SERVICIOS_MOCK;
  return Promise.resolve({ servicios: lista });
};

export const fetchAmigos        = ()       => Promise.resolve({ amigos: AMIGOS_MOCK });
export const fetchSolicitudes   = ()       => Promise.resolve({ solicitudes: SOLICITUDES_MOCK });
export const enviarSolicitud    = ()       => Promise.resolve({ ok: true });
export const responderSolicitud = ()       => Promise.resolve({ ok: true });
export const crearCartel        = ()       => Promise.resolve({ cartel: { id: Date.now() } });
export const eliminarCartel     = ()       => Promise.resolve({ ok: true });
export const actualizarUbicacion = ()     => Promise.resolve({ ok: true });

export const buscarUsuarios = (q) => {
  const todos = [
    { usuario_id: 10, nombre: 'Ana Rodríguez' },
    { usuario_id: 11, nombre: 'Pablo Méndez' },
    { usuario_id: 12, nombre: 'Laura Castillo' },
  ];
  const lista = q
    ? todos.filter(u => u.nombre.toLowerCase().includes(q.toLowerCase()))
    : todos;
  return Promise.resolve({ usuarios: lista });
};
