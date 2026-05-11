/**
 * src/types/comunidad.js
 *
 * Constantes y PropTypes shapes para la pantalla Comunidad de Zooni.
 * Usar estos shapes en los componentes para validación de props en desarrollo.
 */

import PropTypes from 'prop-types';

// ---------------------------------------------------------------------------
// Constantes de tipos
// ---------------------------------------------------------------------------

/** Tipos válidos de cartel comunitario */
export const TIPOS_CARTEL = [
  { value: 'perdida',        label: 'Mascota Perdida' },
  { value: 'encontrada',     label: 'Mascota Encontrada' },
  { value: 'adopcion',       label: 'En Adopción' },
  { value: 'aviso_general',  label: 'Aviso General' },
];

/** Tipos válidos de servicio para mascotas */
export const TIPOS_SERVICIO = [
  { value: 'veterinaria',  label: 'Veterinaria' },
  { value: 'paseador',     label: 'Paseador' },
  { value: 'petshop',      label: 'Pet Shop' },
  { value: 'peluqueria',   label: 'Peluquería' },
];

// ---------------------------------------------------------------------------
// PropTypes shapes
// ---------------------------------------------------------------------------

/**
 * CartelShape — publicación geolocalizada de mascota o aviso comunitario.
 */
export const CartelShape = PropTypes.shape({
  /** UUID del cartel */
  id: PropTypes.string.isRequired,
  /** UUID del usuario que publicó el cartel */
  usuario_id: PropTypes.string.isRequired,
  /** UUID de la mascota asociada (puede ser null) */
  mascota_id: PropTypes.string,
  /** Tipo de cartel */
  tipo: PropTypes.oneOf(['perdida', 'encontrada', 'adopcion', 'aviso_general']).isRequired,
  /** Descripción libre del cartel (máx 300 chars) */
  descripcion: PropTypes.string,
  /** Teléfono de contacto del publicador */
  telefono_contacto: PropTypes.string.isRequired,
  /** URL de la foto adjunta al cartel */
  foto_url: PropTypes.string,
  /** Latitud de la ubicación del cartel */
  lat: PropTypes.number.isRequired,
  /** Longitud de la ubicación del cartel */
  lng: PropTypes.number.isRequired,
  /** Si el cartel está activo (no eliminado) */
  activo: PropTypes.bool.isRequired,
  /** Timestamp ISO de creación */
  created_at: PropTypes.string.isRequired,
  /** Datos del publicador */
  publicador: PropTypes.shape({
    nombre: PropTypes.string.isRequired,
  }).isRequired,
});

/**
 * ServicioShape — establecimiento o profesional de servicios para mascotas.
 */
export const ServicioShape = PropTypes.shape({
  /** UUID del servicio */
  id: PropTypes.string.isRequired,
  /** Tipo de servicio */
  tipo: PropTypes.oneOf(['veterinaria', 'paseador', 'petshop', 'peluqueria']).isRequired,
  /** Nombre del establecimiento o profesional */
  nombre: PropTypes.string.isRequired,
  /** Dirección física */
  direccion: PropTypes.string.isRequired,
  /** Teléfono de contacto */
  telefono: PropTypes.string,
  /** Descripción del servicio */
  descripcion: PropTypes.string,
  /** Latitud de la ubicación */
  lat: PropTypes.number.isRequired,
  /** Longitud de la ubicación */
  lng: PropTypes.number.isRequired,
  /** URL de Google Maps para abrir en navegador externo */
  google_maps_url: PropTypes.string,
  /** Distancia aproximada al usuario en km */
  distancia: PropTypes.number,
});

/**
 * AmigoShape — amigo confirmado del usuario con datos de ubicación.
 */
export const AmigoShape = PropTypes.shape({
  /** UUID del usuario amigo */
  usuario_id: PropTypes.string.isRequired,
  /** Nombre del amigo */
  nombre: PropTypes.string.isRequired,
  /** URL del avatar del amigo */
  foto_perfil_url: PropTypes.string,
  /** Nombre de la mascota principal del amigo */
  mascota_nombre: PropTypes.string,
  /** Distancia aproximada al usuario en km */
  distancia: PropTypes.number,
  /** Si el amigo está actualmente online */
  online: PropTypes.bool.isRequired,
  /** Latitud de la ubicación del amigo */
  lat: PropTypes.number,
  /** Longitud de la ubicación del amigo */
  lng: PropTypes.number,
});

/**
 * BoundingBoxShape — rectángulo de coordenadas que delimita el área visible del mapa.
 */
export const BoundingBoxShape = PropTypes.shape({
  /** Latitud mínima (sur) */
  lat_min: PropTypes.number.isRequired,
  /** Latitud máxima (norte) */
  lat_max: PropTypes.number.isRequired,
  /** Longitud mínima (oeste) */
  lng_min: PropTypes.number.isRequired,
  /** Longitud máxima (este) */
  lng_max: PropTypes.number.isRequired,
});

/**
 * MapaDataShape — conjunto de markers devueltos por GET /api/v1/comunidad/mapa.
 */
export const MapaDataShape = PropTypes.shape({
  /** Lista de servicios visibles en el área del mapa */
  servicios: PropTypes.arrayOf(ServicioShape).isRequired,
  /** Lista de carteles activos visibles en el área del mapa */
  carteles: PropTypes.arrayOf(CartelShape).isRequired,
  /** Lista de amigos confirmados con ubicación compartida */
  amigos: PropTypes.arrayOf(AmigoShape).isRequired,
});

/**
 * PopupDataShape — datos del popup activo sobre el mapa al tocar un marker.
 */
export const PopupDataShape = PropTypes.shape({
  /** Tipo de marker que originó el popup */
  tipo: PropTypes.oneOf(['servicio', 'cartel']).isRequired,
  /** Datos del servicio o cartel según el tipo */
  data: PropTypes.oneOfType([ServicioShape, CartelShape]).isRequired,
});
