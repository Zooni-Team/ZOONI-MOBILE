-- =============================================================================
-- Migración 001: Tablas del módulo Comunidad
-- Base de datos: MySQL con soporte espacial (MySQL 5.7+ o MySQL 8.0+)
-- Requiere: motor InnoDB con soporte para tipos SPATIAL y SPATIAL INDEX
--
-- Tablas creadas:
--   - carteles           : publicaciones geolocalizadas comunitarias
--   - servicios          : establecimientos y profesionales para mascotas
--   - amistades          : relaciones de amistad entre usuarios
--   - ubicaciones_usuarios: posición geográfica actual de cada usuario
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabla: carteles
-- Publicaciones geolocalizadas (mascotas perdidas, en adopción, avisos, etc.)
-- SPATIAL INDEX en `ubicacion` para queries por bounding box eficientes
-- -----------------------------------------------------------------------------
CREATE TABLE carteles (
  id                CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  usuario_id        CHAR(36)     NOT NULL,
  mascota_id        CHAR(36)     NULL,
  tipo              ENUM('perdida','encontrada','adopcion','aviso_general') NOT NULL,
  descripcion       TEXT         NULL,
  telefono_contacto VARCHAR(30)  NOT NULL,
  foto_url          VARCHAR(500) NULL,
  ubicacion         POINT        NOT NULL,
  activo            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  SPATIAL INDEX idx_ubicacion (ubicacion),
  INDEX idx_usuario (usuario_id),
  INDEX idx_activo (activo)
);

-- -----------------------------------------------------------------------------
-- Tabla: servicios
-- Establecimientos y profesionales de servicios para mascotas
-- SPATIAL INDEX en `ubicacion` para queries por bounding box eficientes
-- -----------------------------------------------------------------------------
CREATE TABLE servicios (
  id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  tipo            ENUM('veterinaria','paseador','petshop','peluqueria') NOT NULL,
  nombre          VARCHAR(200) NOT NULL,
  direccion       VARCHAR(300) NOT NULL,
  telefono        VARCHAR(30)  NULL,
  descripcion     TEXT         NULL,
  ubicacion       POINT        NOT NULL,
  google_maps_url VARCHAR(500) NULL,
  verified        BOOLEAN      NOT NULL DEFAULT FALSE,
  SPATIAL INDEX idx_ubicacion (ubicacion)
);

-- -----------------------------------------------------------------------------
-- Tabla: amistades
-- Relaciones de amistad entre usuarios (pendiente / aceptada / rechazada)
-- UNIQUE KEY para evitar duplicados en ambas direcciones
-- -----------------------------------------------------------------------------
CREATE TABLE amistades (
  id            CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  usuario_a_id  CHAR(36)     NOT NULL,
  usuario_b_id  CHAR(36)     NOT NULL,
  estado        ENUM('pendiente','aceptada','rechazada') NOT NULL DEFAULT 'pendiente',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_amistad (usuario_a_id, usuario_b_id),
  INDEX idx_usuario_b (usuario_b_id),
  INDEX idx_estado (estado)
);

-- -----------------------------------------------------------------------------
-- Tabla: ubicaciones_usuarios
-- Posición geográfica actual de cada usuario (actualizada periódicamente)
-- SPATIAL INDEX en `ubicacion` para filtrar amigos cercanos en el mapa
-- -----------------------------------------------------------------------------
CREATE TABLE ubicaciones_usuarios (
  usuario_id          CHAR(36)  PRIMARY KEY,
  ubicacion           POINT     NOT NULL,
  compartir_ubicacion BOOLEAN   NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  SPATIAL INDEX idx_ubicacion (ubicacion)
);
