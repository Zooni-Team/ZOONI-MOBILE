/**
 * HistorialPerroModal.jsx — Todos los paseos de UN perro con este paseador
 *
 * Se abre al tocar un perro en el Historial (Ganancias). Muestra la historia
 * completa con vos, no sólo la del período elegido arriba: cuántas veces lo
 * paseaste, cuánto cobraste y cada paseo con fecha, duración, distancia,
 * precio y la calificación del dueño.
 *
 * Props: visible · mascota { id, nombre, raza, visual } · dueno { nombre } · onCerrar
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, Stat, Vacio } from './PaseadorUI';
import { fetchMisPaseos, formatoDistancia, formatoPlata } from '../../services/paseadorApi';

const minutosDe = (p) => Math.round((p.segundosAcumulados || p.duracionMin * 60) / 60);
const fechaLarga = (iso) => new Date(iso).toLocaleDateString('es-AR', {
  weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
});

export default function HistorialPerroModal({ visible, mascota, dueno, onCerrar }) {
  const [paseos, setPaseos] = useState(null);

  useEffect(() => {
    if (!visible || !mascota) return undefined;
    let vivo = true;
    setPaseos(null);
    fetchMisPaseos(['finalizado'])
      .then((lista) => {
        if (!vivo) return;
        setPaseos(lista
          .filter((p) => p.mascota.id === mascota.id)
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
      })
      .catch(() => { if (vivo) setPaseos([]); });
    return () => { vivo = false; };
  }, [visible, mascota]);

  const lista = paseos ?? [];
  const total = lista.reduce((a, p) => a + p.precio, 0);
  const metros = lista.reduce((a, p) => a + (p.distanciaMetros ?? 0), 0);

  const cabecera = mascota ? (
    <View>
      <View style={s.perfil}>
        <Avatar fuente={mascota.visual} nombre={mascota.nombre} size={72} borde />
        <View style={{ flex: 1 }}>
          <Text style={s.nombre}>{mascota.nombre}</Text>
          {mascota.raza ? <Text style={s.sub}>{mascota.raza}</Text> : null}
          {dueno?.nombre ? <Text style={s.sub}>Dueño: {dueno.nombre}</Text> : null}
        </View>
      </View>
      {lista.length > 0 && (
        <>
          <View style={s.stats}>
            <Stat valor={String(lista.length)} etiqueta={lista.length === 1 ? 'paseo' : 'paseos'} />
            <Stat valor={formatoPlata(total)} etiqueta="cobrado" />
            <Stat valor={formatoDistancia(metros)} etiqueta="caminados" />
          </View>
          <Text style={s.desde}>Primer paseo juntos: {fechaLarga(lista[lista.length - 1].fecha)}</Text>
        </>
      )}
    </View>
  ) : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCerrar} style={s.volver} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={C.teal} />
          </TouchableOpacity>
          <Text style={s.titulo} numberOfLines={1}>Historial de {mascota?.nombre ?? ''}</Text>
        </View>

        {paseos === null ? (
          <View style={{ padding: 20 }}>
            {cabecera}
            <ActivityIndicator color={C.teal} style={{ marginTop: 24 }} />
          </View>
        ) : (
          <FlatList
            data={lista}
            keyExtractor={(p) => String(p.id)}
            ListHeaderComponent={cabecera}
            contentContainerStyle={s.lista}
            ListEmptyComponent={<Vacio icono="paw-outline" titulo="Sin paseos todavía" />}
            renderItem={({ item, index }) => (
              <View style={s.paseo}>
                <View style={s.paseoTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.paseoNum}>Paseo {lista.length - index}</Text>
                    <Text style={s.paseoFecha}>{fechaLarga(item.fecha)}</Text>
                  </View>
                  <Text style={s.paseoPrecio}>{formatoPlata(item.precio)}</Text>
                </View>
                <View style={s.paseoDatos}>
                  <View style={s.dato}>
                    <Ionicons name="time-outline" size={14} color={C.teal} />
                    <Text style={s.datoTxt}>{minutosDe(item)} minutos</Text>
                  </View>
                  <View style={s.dato}>
                    <Ionicons name="footsteps-outline" size={14} color={C.teal} />
                    <Text style={s.datoTxt}>{formatoDistancia(item.distanciaMetros)}</Text>
                  </View>
                  {item.rating != null && (
                    <View style={s.dato}>
                      <Ionicons name="star" size={14} color={C.ambar} />
                      <Text style={s.datoTxt}>{item.rating}/5</Text>
                    </View>
                  )}
                </View>
                {item.resena ? <Text style={s.resena}>“{item.resena}”</Text> : null}
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fondo },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF',
    paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  volver: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { flex: 1, fontSize: 19, fontWeight: '800', color: C.texto },
  lista: { padding: 20, paddingBottom: 32 },

  perfil: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nombre: { fontSize: 24, fontWeight: '900', color: C.texto },
  sub: { fontSize: 13, color: C.texto2, marginTop: 2, fontWeight: '600' },
  stats: { flexDirection: 'row', backgroundColor: C.menta, borderRadius: 18, padding: 16, marginTop: 16 },
  desde: { fontSize: 12, color: C.texto2, marginTop: 10, marginBottom: 14, textAlign: 'center' },

  paseo: {
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  paseoTop: { flexDirection: 'row', alignItems: 'center' },
  paseoNum: { fontSize: 12, fontWeight: '800', color: C.teal },
  paseoFecha: { fontSize: 15, fontWeight: '800', color: C.texto, marginTop: 1 },
  paseoPrecio: { fontSize: 18, fontWeight: '900', color: C.texto },
  paseoDatos: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  datoTxt: { fontSize: 13, color: C.texto2, fontWeight: '600' },
  resena: { fontSize: 13, color: C.texto, fontStyle: 'italic', marginTop: 8, lineHeight: 18 },
});
