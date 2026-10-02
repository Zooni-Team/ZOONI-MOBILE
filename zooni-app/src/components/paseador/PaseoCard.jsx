/**
 * PaseoCard.jsx — Card de solicitud / paseo
 *
 * Siempre el mismo orden (spec de diseño): foto de la mascota → nombre →
 * horario → precio. Lo que cambia según el uso son los chips y las acciones
 * (que entran como children).
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, Card, Chip } from './PaseadorUI';
import { cuandoDe, formatoPlata } from '../../services/paseadorApi';

const DIEZ_MIN = 10 * 60 * 1000;

export default function PaseoCard({ paseo, onChat, mostrarNotas = true, compacto = false, children, style }) {
  const nueva = paseo.estado === 'pendiente' && paseo.creadoEn
    && Date.now() - new Date(paseo.creadoEn).getTime() < DIEZ_MIN;
  const paraVos = paseo.estado === 'pendiente' && !paseo.abierta;

  return (
    <Card style={[{ marginBottom: 12 }, style]}>
      <View style={s.fila}>
        <Avatar fuente={paseo.mascota.visual} nombre={paseo.mascota.nombre} size={compacto ? 48 : 58} />
        <View style={s.info}>
          <View style={s.nombreRow}>
            <Text style={s.nombre} numberOfLines={1}>{paseo.mascota.nombre}</Text>
            {nueva && <Chip texto="Nueva" fondo="#FFF1DC" color={C.ambar} />}
            {paraVos && <Chip texto="Para vos" icono="star" />}
          </View>
          <Text style={s.raza} numberOfLines={1}>
            {[paseo.mascota.raza, paseo.mascota.peso ? `${paseo.mascota.peso} kg` : null].filter(Boolean).join(' · ')}
          </Text>
          <View style={s.horaRow}>
            <Ionicons name="time-outline" size={14} color={C.teal} />
            <Text style={s.hora}>{cuandoDe(paseo.fecha)} · {paseo.duracionMin} minutos</Text>
          </View>
        </View>
        <View style={s.precioCol}>
          <Text style={s.precio}>{formatoPlata(paseo.precio)}</Text>
          {onChat ? (
            <TouchableOpacity onPress={onChat} style={s.chatBtn} accessibilityLabel={`Chatear con ${paseo.dueno.nombre}`}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={C.teal} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {!compacto && (
        <View style={s.detalle}>
          <View style={s.detalleFila}>
            <Ionicons name="person-outline" size={15} color={C.texto2} />
            <Text style={s.detalleTxt} numberOfLines={1}>{paseo.dueno.nombre}</Text>
          </View>
          {paseo.direccion ? (
            <View style={s.detalleFila}>
              <Ionicons name="location-outline" size={15} color={C.texto2} />
              <Text style={s.detalleTxt} numberOfLines={1}>{paseo.direccion}</Text>
            </View>
          ) : null}
          {mostrarNotas && paseo.notas ? (
            <View style={s.notas}>
              <Text style={s.notasTxt}>“{paseo.notas}”</Text>
            </View>
          ) : null}
        </View>
      )}

      {children ? <View style={s.acciones}>{children}</View> : null}
    </Card>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, minWidth: 0 },
  nombreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  nombre: { fontSize: 17, fontWeight: '800', color: C.texto, flexShrink: 1 },
  raza: { fontSize: 13, color: C.texto2, marginTop: 1 },
  horaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  hora: { fontSize: 13, fontWeight: '700', color: C.teal },
  precioCol: { alignItems: 'flex-end', gap: 6 },
  precio: { fontSize: 20, fontWeight: '900', color: C.texto },
  chatBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.menta,
    alignItems: 'center', justifyContent: 'center',
  },
  detalle: { marginTop: 12, gap: 6 },
  detalleFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detalleTxt: { flex: 1, fontSize: 13, color: C.texto2 },
  notas: { backgroundColor: C.fondo, borderRadius: 12, padding: 10, marginTop: 2, borderLeftWidth: 3, borderLeftColor: C.menta },
  notasTxt: { fontSize: 13, color: C.texto, fontStyle: 'italic' },
  acciones: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
