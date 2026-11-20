/**
 * EventoPublicoCard.jsx — Tarjeta de un evento público (jornada de vacunación,
 * feria, encuentro): foto, cuándo, dónde, quién lo organiza y el botón para
 * sumarlo al calendario de la mascota.
 *
 * No confundir con components/calendario/RecordatorioCard: aquella es un
 * recordatorio del calendario propio; ésta, un evento de la agenda de Zooni.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Image, Linking, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Skeleton from '../ui/Skeleton';
import { colores } from '../../theme';
import { alerta } from '../../utils/dialogo';
import { formatearFecha } from '../../utils/fechaLocal';
import { capitalizar } from '../../utils/texto';
import { horaCorta } from '../../utils/tiempoRelativo';


export default function EventoPublicoCard({
  evento,
  yaAgregado,
  expandido,
  onToggleDescripcion,
  onAgregarAlCalendario,
  procesando,
}) {
  // Animación del botón Agregar → Agregado
  const btnColorAnim = useRef(new Animated.Value(yaAgregado ? 1 : 0)).current;
  // Escala del botón al presionar
  const btnScale = useRef(new Animated.Value(1)).current;
  // Estado de imagen rota
  const [imgError, setImgError] = useState(false);

  // Actualizar color del botón cuando cambia yaAgregado
  useEffect(() => {
    Animated.timing(btnColorAnim, {
      toValue: yaAgregado ? 1 : 0,
      duration: 200,
      useNativeDriver: false, // backgroundColor no admite nativeDriver
    }).start();
  }, [btnColorAnim, yaAgregado]);

  const btnBackground = btnColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colores.verde, colores.verdeBurbuja],
  });

  const fechaFormateada = capitalizar(formatearFecha(evento.fecha_hora, 'diaSemanaCorto') ?? '');
  const horaFormateada = `${horaCorta(evento.fecha_hora)} hs`;

  // ── Handler de ubicación → abre Google Maps ────────────────
  const handleAbrirMapa = useCallback(() => {
    let url;
    if (evento.lat && evento.lng) {
      url = `https://www.google.com/maps/search/?api=1&query=${evento.lat},${evento.lng}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        evento.ubicacion_nombre,
      )}`;
    }
    Linking.openURL(url).catch(() => alerta('No se pudo abrir Google Maps'));
  }, [evento.lat, evento.lng, evento.ubicacion_nombre]);

  // ── Handler del botón Agregar ─────────────────────────────
  const handlePressBtnIn = () => {
    Animated.timing(btnScale, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };
  const handlePressBtnOut = () => {
    Animated.timing(btnScale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  // ── Descripción: truncar a 4 líneas con "Ver más" ─────────
  const DESCRIPCION_MAX_LINES = 4;

  return (
    <View style={styles.card}>
      {/* ── FOTO DEL EVENTO ── */}
      <View style={styles.fotoContainer}>
        {!imgError && evento.imagen_url ? (
          <Image
            source={{ uri: evento.imagen_url }}
            style={styles.fotoEvento}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.fotoPlaceholder}>
            <Ionicons name="image-outline" size={48} color={colores.textoTenue} />
          </View>
        )}

        {/* Pill de categoría (solo si existe) */}
        {evento.categoria_tag ? (
          <View style={styles.pillCategoria}>
            <Text style={styles.pillCategoriaTexto}>
              {evento.categoria_tag.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── CONTENIDO ── */}
      <View style={styles.cardContenido}>
        {/* Título */}
        <Text style={styles.eventoTitulo}>{evento.titulo}</Text>

        {/* Fila fecha + hora */}
        <View style={styles.filaFechaHora}>
          <View style={styles.chip}>
            <Ionicons name="calendar-outline" size={13} color={colores.verde} />
            <Text style={styles.chipTexto}> {fechaFormateada}</Text>
          </View>
          <View style={styles.chip}>
            <Ionicons name="time-outline" size={13} color={colores.verde} />
            <Text style={styles.chipTexto}> {horaFormateada}</Text>
          </View>
        </View>

        {/* Pill de ubicación */}
        <TouchableOpacity
          style={styles.pillUbicacion}
          onPress={handleAbrirMapa}
          activeOpacity={0.75}
          accessibilityLabel={`Ver ${evento.ubicacion_nombre} en Google Maps`}
          accessibilityRole="link"
        >
          <Ionicons name="location-outline" size={14} color={colores.verde} />
          <Text style={styles.pillUbicacionTexto} numberOfLines={2}>
            {evento.ubicacion_nombre}
          </Text>
        </TouchableOpacity>

        {/* Descripción con "Ver más / Ver menos" */}
        {evento.descripcion ? (
          <View style={styles.descripcionContainer}>
            <Text
              style={styles.descripcionTexto}
              numberOfLines={expandido ? undefined : DESCRIPCION_MAX_LINES}
            >
              {evento.descripcion}
            </Text>
            <Text
              style={styles.verMasTexto}
              onPress={() => onToggleDescripcion(evento.id)}
              suppressHighlighting
            >
              {expandido ? 'Ver menos' : 'Ver más'}
            </Text>
          </View>
        ) : null}

        {/* Organizador: todos son perfiles verificados por Zooni */}
        {evento.organizador_nombre ? (
          <View style={styles.pillOrganizador}>
            <Ionicons name="business-outline" size={15} color={colores.textoSecundario} />
            <Text style={styles.pillOrganizadorTexto} numberOfLines={1} ellipsizeMode="tail">
              {evento.organizador_nombre}
            </Text>
            <Ionicons name="checkmark-circle" size={14} color={colores.verde} accessibilityLabel="Organizador verificado" />
          </View>
        ) : null}

        {/* Botón Agregar al calendario */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            disabled={yaAgregado || procesando}
            onPressIn={handlePressBtnIn}
            onPressOut={handlePressBtnOut}
            onPress={() => !yaAgregado && onAgregarAlCalendario(evento)}
            activeOpacity={0.9}
            accessibilityLabel={
              yaAgregado ? 'Evento ya agregado al calendario' : 'Agregar al calendario'
            }
            accessibilityRole="button"
          >
            <Animated.View
              style={[
                styles.btnAgregar,
                { backgroundColor: btnBackground },
                yaAgregado && styles.btnAgregarDeshabilitado,
              ]}
            >
              {procesando ? (
                <ActivityIndicator size="small" color={colores.blanco} />
              ) : (
                <>
                  <Ionicons
                    name={
                      yaAgregado ? 'checkmark-circle-outline' : 'calendar-outline'
                    }
                    size={18}
                    color={colores.blanco}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.btnAgregarTexto}>
                    {yaAgregado ? '✓ Agregado al calendario' : 'Agregar al calendario'}
                  </Text>
                </>
              )}
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

/** Placeholder con la forma de la tarjeta, mientras carga la lista. */
export function EventoPublicoCargando() {
  return (
    <Skeleton style={styles.skeletonCard} min={0.5}>
      <View style={styles.skeletonFoto} />
      <View style={styles.skeletonTitulo} />
      <View style={styles.skeletonFecha} />
      <View style={styles.skeletonDescripcion} />
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  // ── Card de evento ────────────────────────────────────────
  card: {
    backgroundColor: colores.blanco,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden', // CRÍTICO: hace que la foto respete el borderRadius
  },
  // ── Foto ──────────────────────────────────────────────────
  fotoContainer: {
    position: 'relative',
  },
  fotoEvento: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  fotoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: colores.gris200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pill de categoría sobre la foto
  pillCategoria: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colores.verde,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    shadowColor: colores.negro,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  pillCategoriaTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: colores.blanco,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // ── Contenido del card ────────────────────────────────────
  cardContenido: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  // Título del evento
  eventoTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: colores.texto,
    marginBottom: 12,
  },
  // Fila fecha + hora
  filaFechaHora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colores.gris50,
    borderWidth: 1,
    borderColor: colores.gris300,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipTexto: {
    fontSize: 12,
    fontWeight: '500',
    color: colores.texto,
  },
  // Pill de ubicación
  pillUbicacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F8F0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  pillUbicacionTexto: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colores.verde,
  },
  // Descripción
  descripcionContainer: {
    marginBottom: 16,
  },
  descripcionTexto: {
    fontSize: 14,
    fontWeight: '400',
    color: colores.textoSecundario,
    lineHeight: 22,
  },
  verMasTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.verde,
    marginTop: 4,
  },
  // Pill del organizador
  pillOrganizador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colores.gris50,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 14,
    width: '100%',
  },
  pillOrganizadorTexto: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: colores.textoSecundario,
  },
  // Botón Agregar al calendario
  btnAgregar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    height: 48,
    width: '100%',
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  btnAgregarDeshabilitado: {
    shadowOpacity: 0,
    elevation: 0,
  },
  btnAgregarTexto: {
    fontSize: 15,
    fontWeight: '700',
    color: colores.blanco,
  },
  // ── Skeleton ──────────────────────────────────────────────
  skeletonCard: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  skeletonFoto: {
    height: 200,
    backgroundColor: colores.gris300,
  },
  skeletonTitulo: {
    height: 20,
    width: '70%',
    backgroundColor: colores.gris200,
    borderRadius: 6,
    marginTop: 14,
    marginHorizontal: 16,
  },
  skeletonFecha: {
    height: 14,
    width: '50%',
    backgroundColor: colores.gris210,
    borderRadius: 10,
    marginTop: 10,
    marginHorizontal: 16,
  },
  skeletonDescripcion: {
    height: 60,
    backgroundColor: colores.gris210,
    borderRadius: 6,
    marginTop: 12,
    marginHorizontal: 16,
  },
});
