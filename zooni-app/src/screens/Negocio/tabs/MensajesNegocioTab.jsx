/**
 * MensajesNegocioTab.jsx — Bandeja de chats del negocio
 *
 * Una conversación por dueño que le escribió (fetchConversacionesNegocio):
 * el último mensaje ("Vos: …" si lo mandó el negocio), hace cuánto y cuántos
 * sin leer. Arriba las que tienen mensajes sin leer. Buscador por nombre.
 * Se refresca sola cada POLL_MS mientras está abierta. Tocar una abre el chat
 * (NegocioChat), con las respuestas rápidas del tipo de negocio.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Avatar, C, Vacio, sombra } from '../../../components/paseador/PaseadorUI';
import { fetchConversacionesNegocio } from '../../../services/negocioApi';
import { tiempoRelativoCorto } from '../../../utils/tiempoRelativo';

const POLL_MS = 15000;
const normalizar = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function MensajesNegocioTab({ negocio, cfg, abrirChat, refrescarBadges }) {
  const [conversaciones, setConversaciones] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setConversaciones(await fetchConversacionesNegocio(negocio.idServicio));
    } catch {
      setConversaciones((c) => c ?? []);
    }
  }, [negocio.idServicio]);

  // Al volver de un chat, la lista y el badge del menú se actualizan
  useFocusEffect(useCallback(() => {
    cargar();
    refrescarBadges?.();
  }, [cargar])); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(cargar, POLL_MS);
    return () => clearInterval(t);
  }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await Promise.all([cargar(), refrescarBadges?.()]);
    setRefrescando(false);
  };

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return (conversaciones ?? [])
      .filter((c) => !q || normalizar(c.dueno.nombre).includes(q))
      .sort((a, b) => ((b.sinLeer > 0) - (a.sinLeer > 0)) || (new Date(b.fecha) - new Date(a.fecha)));
  }, [conversaciones, busqueda]);

  if (!negocio.idServicio) {
    return (
      <Vacio icono="chatbubbles-outline" titulo="Todavía no podés recibir mensajes"
        texto="Tu negocio no tiene su pin en el mapa de Comunidad. Revisá la dirección y el punto en el mapa en «Mi negocio» y guardá los cambios." />
    );
  }
  if (conversaciones === null) return <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />;

  const sinLeer = (conversaciones ?? []).reduce((a, c) => a + c.sinLeer, 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.top}>
        <View style={s.buscador}>
          <Ionicons name="search" size={18} color={C.texto2} />
          <TextInput style={s.buscadorInput} value={busqueda} onChangeText={setBusqueda}
            placeholder="Buscar cliente" placeholderTextColor={C.gris} />
          {busqueda ? (
            <TouchableOpacity onPress={() => setBusqueda('')} accessibilityLabel="Borrar búsqueda">
              <Ionicons name="close-circle" size={18} color={C.gris} />
            </TouchableOpacity>
          ) : null}
        </View>
        {sinLeer > 0 ? (
          <Text style={s.resumen}>{sinLeer} {sinLeer === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}</Text>
        ) : null}
      </View>

      <FlatList
        data={visibles}
        keyExtractor={(c) => String(c.idDueno)}
        contentContainerStyle={s.lista}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={C.teal} />}
        ListEmptyComponent={(
          <Vacio icono="chatbubbles-outline"
            titulo={busqueda ? 'Nadie con ese nombre' : 'Todavía no te escribió nadie'}
            texto={busqueda ? undefined
              : `Cuando un dueño te escriba desde tu ficha o desde Comunidad, la conversación aparece acá. Tenés respuestas rápidas pensadas para tu ${cfg.label.toLowerCase()}.`} />
        )}
        renderItem={({ item: c }) => (
          <TouchableOpacity style={[s.fila, c.sinLeer > 0 && s.filaSinLeer]} onPress={() => abrirChat(c.idDueno, c.dueno.nombre)}
            activeOpacity={0.85} accessibilityRole="button"
            accessibilityLabel={`Chat con ${c.dueno.nombre}${c.sinLeer ? `, ${c.sinLeer} sin leer` : ''}`}>
            <Avatar uri={c.dueno.foto} nombre={c.dueno.nombre} size={50} />
            <View style={{ flex: 1 }}>
              <Text style={[s.nombre, c.sinLeer > 0 && { fontWeight: '900' }]} numberOfLines={1}>{c.dueno.nombre}</Text>
              <Text style={[s.preview, c.sinLeer > 0 && s.previewSinLeer]} numberOfLines={1}>
                {c.ultimoMio ? 'Vos: ' : ''}{c.ultimoTexto}
              </Text>
            </View>
            <View style={s.derecha}>
              <Text style={[s.hora, c.sinLeer > 0 && { color: C.teal, fontWeight: '800' }]}>{tiempoRelativoCorto(c.fecha)}</Text>
              {c.sinLeer > 0 ? (
                <View style={s.badge}><Text style={s.badgeTxt}>{c.sinLeer > 99 ? '99+' : c.sinLeer}</Text></View>
              ) : <View style={{ height: 20 }} />}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: C.borde, paddingHorizontal: 12,
  },
  buscadorInput: { flex: 1, fontSize: 15, color: C.texto, paddingVertical: 11 },
  resumen: { fontSize: 13, fontWeight: '700', color: C.teal },
  lista: { padding: 20, paddingBottom: 40 },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 18,
    padding: 12, marginBottom: 10, ...sombra,
  },
  filaSinLeer: { borderWidth: 1.5, borderColor: C.menta },
  nombre: { fontSize: 16, fontWeight: '800', color: C.texto },
  preview: { fontSize: 13, color: C.texto2, marginTop: 2 },
  previewSinLeer: { color: C.texto, fontWeight: '700' },
  derecha: { alignItems: 'flex-end', gap: 6 },
  hora: { fontSize: 12, color: C.gris },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeTxt: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', lineHeight: 20 },
});
