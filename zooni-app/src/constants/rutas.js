import { getStateFromPath as estadoDesdeRutaBase } from '@react-navigation/native';

export const TITULOS = {
  Home: 'Inicio',
  Login: 'Ingresar',
  RegisterStep1: 'Crear cuenta', RegisterStep2: 'Crear cuenta',
  RegisterStep3: 'Crear cuenta', RegisterStep4: 'Crear cuenta',
  Comunidad: 'Comunidad',
  FichaMedica: 'Ficha médica',
  MisMascotas: 'Mis mascotas',
  Match: 'Match',
  MatchFilters: 'Filtros de Match',
  Calendario: 'Calendario',
  Chat: 'Chat',
  Mensajes: 'Mensajes',
  Eventos: 'Eventos',
  ChatBot: 'ZooniVet', VirtualVet: 'ZooniVet',
  Closet: 'Closet',
  Perfil: 'Perfil',
  Consejos: 'Consejos',
  Tratamientos: 'Tratamientos',
  Vacunas: 'Vacunas',
  Consultas: 'Consultas',
  SOS: 'S.O.S. Veterinario',
  Configuracion: 'Configuración',
  ConfigCuenta: 'Cuenta y seguridad',
  ConfigTema: 'Tema',
  ConfigMedios: 'Medios y calidad',
  ConfigTiempo: 'Tiempo en la app',
  ConfigMascotas: 'Mis mascotas',
  ConfigPrivacidad: 'Privacidad',
  ConfigPermisos: 'Permisos',
  ConfigNotificaciones: 'Notificaciones',
  ConfigSuscripciones: 'Suscripciones',
  ConfigLegal: 'Legal',
  ConfigAyuda: 'Ayuda',
  ConfigEliminarCuenta: 'Eliminar cuenta',
  ConfigCambiarContrasena: 'Cambiar contraseña',
  ConfigSesiones: 'Sesiones',
  AltaMascota: 'Nueva mascota',
  EditarMascota: 'Editar mascota',
  EliminarMascota: 'Eliminar mascota',
  ElegirModo: 'Elegí cómo entrar',
  ProveedorTipo: 'Ofrecer servicios',
  PaseadorLogin: 'Ingresar como paseador',
  PaseadorRegistro: 'Registro de paseador',
  PaseadorApp: 'Paseador',
  PaseadorChat: 'Chat del paseo',
  PaseadorDisponibilidad: 'Disponibilidad',
  PaseadorChats: 'Chats de paseos',
  NegocioLogin: 'Ingresar como negocio',
  NegocioRegistro: 'Registro de negocio',
  NegocioApp: 'Mi negocio',
  NegocioChat: 'Chat',
  NegocioPublico: 'Negocio',
  ReservarTurno: 'Reservar turno',
  MisTurnos: 'Turnos y pedidos',
  SolicitarPaseo: 'Pedir un paseo',
  MisPaseos: 'Mis paseos',
};

export const tituloDePestana = (nombreRuta) =>
  (TITULOS[nombreRuta] ? `${TITULOS[nombreRuta]} · Zooni` : 'Zooni');

const id = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const conMascota = (path) => ({ path, parse: { petId: id } });
const sinAviso = { aviso: () => undefined, enviada: () => undefined };

const PANTALLAS = {
  Home: 'inicio',
  Comunidad: 'comunidad',
  FichaMedica: { path: 'ficha-medica', parse: { mascotaId: id } },
  MisMascotas: 'mis-mascotas',
  Match: 'match',
  MatchFilters: 'match/filtros',
  Calendario: 'calendario',
  Mensajes: 'mensajes',
  Eventos: 'eventos',
  ChatBot: 'zoonivet',
  Closet: conMascota('closet'),
  Perfil: 'perfil',
  Consejos: conMascota('ficha-medica/consejos'),
  Tratamientos: conMascota('ficha-medica/tratamientos'),
  Vacunas: conMascota('ficha-medica/vacunas'),
  Consultas: conMascota('ficha-medica/consultas'),
  SOS: 'sos',
  Configuracion: 'configuracion',
  ConfigCuenta: 'configuracion/cuenta',
  ConfigTema: 'configuracion/tema',
  ConfigMedios: 'configuracion/medios',
  ConfigTiempo: 'configuracion/tiempo',
  ConfigMascotas: 'configuracion/mascotas',
  ConfigPrivacidad: 'configuracion/privacidad',
  ConfigPermisos: 'configuracion/permisos',
  ConfigNotificaciones: 'configuracion/notificaciones',
  ConfigSuscripciones: 'configuracion/suscripciones',
  ConfigLegal: 'configuracion/legal',
  ConfigAyuda: 'configuracion/ayuda',
  ConfigCambiarContrasena: 'configuracion/contrasena',
  ConfigSesiones: 'configuracion/sesiones',
  AltaMascota: 'mis-mascotas/nueva',
  ElegirModo: 'elegir-modo',
  PaseadorApp: {
    path: 'paseador/:tab?',
    stringify: { perfilLocal: () => undefined, desdeRegistro: () => undefined },
  },
  PaseadorChats: 'paseador/chats',
  PaseadorDisponibilidad: 'paseador/disponibilidad',
  NegocioApp: 'negocio',
  MisTurnos: { path: 'turnos/:tab?', stringify: sinAviso },
  MisPaseos: { path: 'mis-paseos', stringify: sinAviso },
};

export function crearLinking(conSesion, rutaInicial) {
  return {
    prefixes: [],
    enabled: true,
    config: { screens: PANTALLAS },
    getStateFromPath(path, opciones) {
      if (!conSesion) return undefined;
      const estado = estadoDesdeRutaBase(path, opciones);
      const nombre = estado?.routes?.[estado.routes.length - 1]?.name;
      if (!nombre || !PANTALLAS[nombre]) return undefined;
      if (nombre === rutaInicial || estado.routes.some((r) => r.name === rutaInicial)) return estado;
      return { ...estado, index: estado.routes.length, routes: [{ name: rutaInicial }, ...estado.routes] };
    },
  };
}
