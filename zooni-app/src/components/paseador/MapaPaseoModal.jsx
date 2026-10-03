/**
 * MapaPaseoModal.jsx — El mapa del paseo, a pantalla completa
 *
 * El mini mapa de "Próximo paseo" mide 150 px y va con interactivo={false}:
 * alcanza para ubicarse, pero no para ver POR DÓNDE se llega ni qué hay
 * alrededor. Tocarlo no hacía nada.
 *
 * Esto lo abre en grande —igual que el mapa de Comunidad—, ya con zoom y
 * arrastre, y con la dirección y un botón para abrirla en la app de mapas del
 * teléfono, que es lo que uno termina necesitando para ir a buscar al perro.
 */

import { Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import MapaPaseo from './MapaPaseo';
import { C, sombra } from './PaseadorUI';

export default function MapaPaseoModal({ visible, onCerrar, destino, direccion, mascota }) {
  if (!destino) return null;

  // Abre la dirección en Google Maps (navegador o app, según el dispositivo).
  const comoLlegar = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${destino.lat},${destino.lng}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}>
      <View style={s.contenedor}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCerrar} style={s.cerrar} accessibilityLabel="Cerrar el mapa"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={C.texto} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo} numberOfLines={1}>
              {mascota ? `Dónde buscar a ${mascota}` : 'Ubicación del paseo'}
            </Text>
            {!!direccion && <Text style={s.sub} numberOfLines={1}>{direccion}</Text>}
          </View>
        </View>

        {/* interactivo: acá sí se puede mover y hacer zoom */}
        <MapaPaseo destino={destino} centro={destino} interactivo style={{ flex: 1 }} />

        <View style={s.pie}>
          <View style={s.leyenda}>
            <View style={s.pinCasa}>
              <Ionicons name="home" size={13} color="#FFFFFF" />
            </View>
            <Text style={s.leyendaTxt}>
              Acá te espera {mascota ?? 'la mascota'}
            </Text>
          </View>
          <TouchableOpacity style={s.btnComoLlegar} onPress={comoLlegar}
            accessibilityRole="button" accessibilityLabel="Cómo llegar">
            <Ionicons name="navigate" size={17} color="#FFFFFF" />
            <Text style={s.btnComoLlegarTxt}>Cómo llegar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: C.card },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  cerrar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 17, fontWeight: '800', color: C.texto },
  sub: { fontSize: 13, color: C.texto2, marginTop: 2 },

  pie: {
    padding: 14, gap: 12,
    borderTopWidth: 1, borderTopColor: C.borde, backgroundColor: C.card, ...sombra,
  },
  // Misma pastilla ámbar que el marcador, para que se entienda qué es
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinCasa: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#F5A623',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  leyendaTxt: { flex: 1, fontSize: 13, color: C.texto2 },
  btnComoLlegar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 24, backgroundColor: C.teal,
  },
  btnComoLlegarTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
