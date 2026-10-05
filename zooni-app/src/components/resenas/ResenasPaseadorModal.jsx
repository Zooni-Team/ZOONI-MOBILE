/**
 * ResenasPaseadorModal.jsx — Opiniones de un paseador (estilo Google Maps)
 *
 * Lo abre el dueño desde la ficha del paseador en Comunidad ("Ver opiniones"),
 * y el paseador desde su Perfil ("Ver todas"). Arriba, el resumen: promedio,
 * barras de 5 a 1 estrella, promedio por aspecto, % de "sí" de cada pregunta
 * y todas las fotos/videos. Abajo, cada reseña con su texto, respuestas y
 * adjuntos. Filtro rápido: todas / con fotos o videos / por estrellas.
 *
 * Props: visible · idPaseador · nombre · onCerrar
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Modal, SafeAreaView, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { fetchResenasPaseador, PREGUNTAS_RESENA } from '../../services/paseadorApi';
import { tiempoRelativo } from '../../utils/tiempoRelativo';
import { MiniaturaMedia, VisorMedia } from './MediaResena';

const VERDE = '#2DBD72';
const MENTA = '#E8F5EC';
const AMARILLO = '#F5C842';
const TEXTO = '#2C2C2C';
const TEXTO2 = '#6B6B6B';

const fmt1 = (n) => n.toFixed(1).replace('.', ',');

function Estrellas({ valor, size = 14 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} size={size} color={AMARILLO}
          name={valor >= i ? 'star' : valor >= i - 0.5 ? 'star-half' : 'star-outline'} />
      ))}
    </View>
  );
}

function Resumen({ datos, onVerMedia }) {
  const max = Math.max(...datos.distribucion.map((d) => d.cantidad), 1);
  const aspectos = datos.aspectos.filter((a) => a.promedio != null);
  const preguntas = datos.preguntas.filter((p) => p.porcentaje != null);
  return (
    <View>
      <View style={s.resumen}>
        <View style={s.promedioCol}>
          <Text style={s.promedio}>{datos.promedio != null ? fmt1(datos.promedio) : '–'}</Text>
          <Estrellas valor={datos.promedio ?? 0} size={16} />
          <Text style={s.cantidad}>{datos.cantidad} {datos.cantidad === 1 ? 'opinión' : 'opiniones'}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          {datos.distribucion.map((d) => (
            <View key={d.estrellas} style={s.barraFila}>
              <Text style={s.barraNum}>{d.estrellas}</Text>
              <View style={s.barraFondo}>
                <View style={[s.barra, { width: `${(d.cantidad / max) * 100}%` }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {aspectos.length > 0 && (
        <View style={s.bloque}>
          {aspectos.map((a) => (
            <View key={a.key} style={s.aspecto}>
              <Text style={s.aspectoLabel}>{a.label}</Text>
              <Text style={s.aspectoValor}>{fmt1(a.promedio)}</Text>
              <Ionicons name="star" size={13} color={AMARILLO} />
            </View>
          ))}
        </View>
      )}

      {preguntas.length > 0 && (
        <View style={s.chips}>
          {preguntas.map((p) => (
            <View key={p.key} style={s.chipPct}>
              <Text style={s.chipPctNum}>{p.porcentaje}%</Text>
              <Text style={s.chipPctTxt}>{p.resumen}</Text>
            </View>
          ))}
        </View>
      )}

      {datos.media.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={s.subtitulo}>Fotos y videos de los dueños</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {datos.media.slice(0, 12).map((m, i) => (
              <MiniaturaMedia key={`${m.url}-${i}`} item={m} size={84} onPress={() => onVerMedia(datos.media, i)} />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function TarjetaResena({ r, onVerMedia }) {
  const respuestas = PREGUNTAS_RESENA.filter((p) => typeof r.respuestas[p.key] === 'boolean');
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        {r.dueno.foto
          ? <Image source={{ uri: r.dueno.foto }} style={s.avatar} />
          : <View style={[s.avatar, s.avatarIni]}><Text style={s.avatarIniTxt}>{r.dueno.nombre[0]?.toUpperCase()}</Text></View>}
        <View style={{ flex: 1 }}>
          <Text style={s.cardNombre}>{r.dueno.nombre}</Text>
          <Text style={s.cardSub}>Paseo con {r.mascota.nombre} · {tiempoRelativo(r.fecha)}</Text>
        </View>
      </View>
      <View style={{ marginTop: 8 }}><Estrellas valor={r.rating} /></View>
      {r.resena ? <Text style={s.cardTxt}>{r.resena}</Text> : null}

      {Object.keys(r.aspectos).length > 0 && (
        <Text style={s.cardAspectos}>
          {Object.entries(r.aspectos).map(([k, v]) => {
            const label = { puntualidad: 'Puntualidad', trato: 'Trato', comunicacion: 'Comunicación' }[k] ?? k;
            return `${label}: ${v}/5`;
          }).join('  ·  ')}
        </Text>
      )}
      {respuestas.length > 0 && (
        <View style={[s.chips, { marginTop: 8 }]}>
          {respuestas.map((p) => (
            <View key={p.key} style={[s.chipResp, !r.respuestas[p.key] && s.chipRespNo]}>
              <Ionicons name={r.respuestas[p.key] ? 'checkmark' : 'close'} size={13}
                color={r.respuestas[p.key] ? VERDE : TEXTO2} />
              <Text style={s.chipRespTxt}>{p.pregunta.replace(/^¿|\?$/g, '')}</Text>
            </View>
          ))}
        </View>
      )}
      {r.media.length > 0 && (
        <View style={s.cardMedia}>
          {r.media.map((m, i) => (
            <MiniaturaMedia key={`${m.url}-${i}`} item={m} size={72} onPress={() => onVerMedia(r.media, i)} />
          ))}
        </View>
      )}
    </View>
  );
}

const FILTROS = [
  { key: 'todas', label: 'Todas' },
  { key: 'media', label: 'Con fotos o videos', icono: 'images-outline' },
  { key: 5, label: '5', icono: 'star' },
  { key: 4, label: '4', icono: 'star' },
  { key: 3, label: '3', icono: 'star' },
  { key: 'bajas', label: '1–2', icono: 'star' },
];

export default function ResenasPaseadorModal({ visible, idPaseador, nombre, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState('todas');
  const [visor, setVisor] = useState({ items: [], indice: null });

  useEffect(() => {
    if (!visible || idPaseador == null) return undefined;
    let vivo = true;
    setDatos(null);
    setError(false);
    setFiltro('todas');
    fetchResenasPaseador(idPaseador)
      .then((d) => { if (vivo) setDatos(d); })
      .catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [visible, idPaseador]);

  const lista = useMemo(() => {
    const todas = datos?.resenas ?? [];
    if (filtro === 'media') return todas.filter((r) => r.media.length);
    if (filtro === 'bajas') return todas.filter((r) => r.rating <= 2);
    if (typeof filtro === 'number') return todas.filter((r) => r.rating === filtro);
    return todas;
  }, [datos, filtro]);

  const verMedia = (items, indice) => setVisor({ items, indice });

  const cabecera = datos ? (
    <View>
      <Resumen datos={datos} onVerMedia={verMedia} />
      {datos.cantidad > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 18 }}
          contentContainerStyle={{ gap: 8 }}>
          {FILTROS.map((f) => {
            const on = filtro === f.key;
            return (
              <TouchableOpacity key={String(f.key)} style={[s.filtro, on && s.filtroOn]} onPress={() => setFiltro(f.key)}>
                {f.icono ? <Ionicons name={f.icono} size={13} color={on ? '#FFF' : f.icono === 'star' ? AMARILLO : TEXTO2} /> : null}
                <Text style={[s.filtroTxt, on && { color: '#FFF' }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <View style={{ height: 14 }} />
    </View>
  ) : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCerrar} style={s.volver} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={VERDE} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>Opiniones</Text>
            {nombre ? <Text style={s.sub} numberOfLines={1}>{nombre}</Text> : null}
          </View>
        </View>

        {error ? (
          <Text style={s.vacio}>No se pudieron cargar las opiniones. Probá de nuevo.</Text>
        ) : !datos ? (
          <ActivityIndicator color={VERDE} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={lista}
            keyExtractor={(r) => String(r.id)}
            ListHeaderComponent={cabecera}
            contentContainerStyle={s.lista}
            renderItem={({ item }) => <TarjetaResena r={item} onVerMedia={verMedia} />}
            ListEmptyComponent={
              <Text style={s.vacio}>
                {datos.cantidad ? 'No hay opiniones con ese filtro.' : 'Todavía no tiene opiniones. Aparecen cuando los dueños califican sus paseos.'}
              </Text>
            }
          />
        )}
        <VisorMedia items={visor.items} indice={visor.indice} onCerrar={() => setVisor({ items: [], indice: null })} />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
  },
  volver: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 19, fontWeight: '800', color: TEXTO },
  sub: { fontSize: 12, color: TEXTO2 },
  lista: { padding: 20, paddingBottom: 40 },
  vacio: { fontSize: 14, color: TEXTO2, textAlign: 'center', marginTop: 24, paddingHorizontal: 20 },

  resumen: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  promedioCol: { alignItems: 'center', minWidth: 90 },
  promedio: { fontSize: 46, fontWeight: '900', color: TEXTO },
  cantidad: { fontSize: 12, color: TEXTO2, marginTop: 4 },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barraNum: { width: 10, fontSize: 12, color: TEXTO2, fontWeight: '700' },
  barraFondo: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#EEEEEE', overflow: 'hidden' },
  barra: { height: 8, borderRadius: 4, backgroundColor: AMARILLO },

  bloque: { marginTop: 16, backgroundColor: '#F9F9F9', borderRadius: 14, padding: 12, gap: 6 },
  aspecto: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  aspectoLabel: { flex: 1, fontSize: 14, color: TEXTO, fontWeight: '600' },
  aspectoValor: { fontSize: 14, color: TEXTO, fontWeight: '800' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chipPct: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: MENTA,
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6,
  },
  chipPctNum: { fontSize: 13, fontWeight: '900', color: VERDE },
  chipPctTxt: { fontSize: 13, color: TEXTO, fontWeight: '600' },
  subtitulo: { fontSize: 14, fontWeight: '800', color: TEXTO, marginBottom: 8 },

  filtro: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#DDDDDD',
    borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7,
  },
  filtroOn: { backgroundColor: VERDE, borderColor: VERDE },
  filtroTxt: { fontSize: 13, fontWeight: '700', color: TEXTO },

  card: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: MENTA },
  avatarIni: { alignItems: 'center', justifyContent: 'center' },
  avatarIniTxt: { fontSize: 16, fontWeight: '800', color: VERDE },
  cardNombre: { fontSize: 14, fontWeight: '800', color: TEXTO },
  cardSub: { fontSize: 12, color: TEXTO2, marginTop: 1 },
  cardTxt: { fontSize: 14, color: TEXTO, lineHeight: 20, marginTop: 6 },
  cardAspectos: { fontSize: 12, color: TEXTO2, marginTop: 6, fontWeight: '600' },
  chipResp: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: MENTA,
    borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5,
  },
  chipRespNo: { backgroundColor: '#F1F1F1' },
  chipRespTxt: { fontSize: 12, color: TEXTO, fontWeight: '600' },
  cardMedia: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
});
