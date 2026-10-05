/**
 * GananciasTab.jsx — Tab 4 de Zooni Paseadores
 *
 *   · Filtro Semana / Mes / Todo
 *   · Total cobrado como número protagonista ("Cobraste $X esta semana")
 *   · Barras de lo cobrado por día (semana), por semana (mes) o por mes (todo)
 *   · Historial: UNA fila por perro (paseos, último paseo y cobrado en el
 *     período). Tocarlo abre todos sus paseos con vos (HistorialPerroModal).
 *
 * Gráfico: una sola serie → un solo color (teal), sin leyenda; tocar una barra
 * muestra su valor. El teal tiene poco contraste contra el blanco, por eso el
 * valor seleccionado y las etiquetas van siempre visibles en texto.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, Card, Seccion, Stat, Vacio } from '../../../components/paseador/PaseadorUI';
import HistorialPerroModal from '../../../components/paseador/HistorialPerroModal';
import {
  fetchGanancias, formatoDistancia, formatoPlata, inicioDePeriodo,
} from '../../../services/paseadorApi';

const PERIODOS = [
  { key: 'semana', label: 'Semana', frase: 'esta semana' },
  { key: 'mes', label: 'Mes', frase: 'este mes' },
  { key: 'todo', label: 'Todo', frase: 'en total' },
];
const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ALTO_GRAFICO = 120;

/** Agrupa lo cobrado en barras según el período. */
function armarBarras(paseos, periodo) {
  if (periodo === 'semana') {
    const lunes = inicioDePeriodo('semana');
    const barras = DIAS_CORTOS.map((label, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return { label, detalle: `${d.getDate()}/${d.getMonth() + 1}`, total: 0 };
    });
    paseos.forEach((p) => {
      const i = (new Date(p.fecha).getDay() + 6) % 7;
      barras[i].total += p.precio;
    });
    return barras;
  }
  if (periodo === 'mes') {
    const barras = [1, 2, 3, 4, 5].map((n) => ({ label: `S${n}`, detalle: `Semana ${n}`, total: 0 }));
    paseos.forEach((p) => {
      const i = Math.min(4, Math.floor((new Date(p.fecha).getDate() - 1) / 7));
      barras[i].total += p.precio;
    });
    return barras;
  }
  // todo → últimos 6 meses
  const hoy = new Date();
  const barras = [];
  for (let k = 5; k >= 0; k -= 1) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - k, 1);
    barras.push({ label: MESES_CORTOS[d.getMonth()], detalle: `${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`, anio: d.getFullYear(), mes: d.getMonth(), total: 0 });
  }
  paseos.forEach((p) => {
    const d = new Date(p.fecha);
    const b = barras.find((x) => x.anio === d.getFullYear() && x.mes === d.getMonth());
    if (b) b.total += p.precio;
  });
  return barras;
}

/** Un grupo por perro, del paseado más recientemente al más viejo. */
function agruparPorPerro(paseos) {
  const grupos = new Map();
  paseos.forEach((p) => {
    const key = String(p.mascota.id ?? p.mascota.nombre);
    if (!grupos.has(key)) grupos.set(key, { key, mascota: p.mascota, dueno: p.dueno, paseos: [], total: 0, ultimo: p.fecha });
    const g = grupos.get(key);
    g.paseos.push(p);
    g.total += p.precio;
    if (new Date(p.fecha) > new Date(g.ultimo)) g.ultimo = p.fecha;
  });
  return [...grupos.values()].sort((a, b) => new Date(b.ultimo) - new Date(a.ultimo));
}

function GraficoBarras({ barras }) {
  const max = Math.max(...barras.map((b) => b.total), 1);
  const iMax = barras.findIndex((b) => b.total === max);
  const [sel, setSel] = useState(iMax);
  useEffect(() => { setSel(iMax); }, [iMax, barras.length]);
  const actual = barras[sel] ?? barras[0];

  return (
    <View>
      <View style={g.tooltip}>
        <Text style={g.tooltipValor}>{formatoPlata(actual.total)}</Text>
        <Text style={g.tooltipLabel}>{actual.detalle}</Text>
      </View>
      <View style={g.area} accessibilityLabel="Cobrado por período">
        {barras.map((b, i) => {
          const alto = b.total > 0 ? Math.max(6, (b.total / max) * ALTO_GRAFICO) : 2;
          const on = i === sel;
          return (
            <Pressable
              key={`${b.label}-${i}`}
              style={g.col}
              onPress={() => setSel(i)}
              onHoverIn={() => setSel(i)}
              accessibilityRole="button"
              accessibilityLabel={`${b.detalle}: ${formatoPlata(b.total)}`}
            >
              <View style={[
                g.barra,
                { height: alto },
                b.total === 0 ? g.barraVacia : on ? g.barraOn : g.barraOff,
              ]} />
            </Pressable>
          );
        })}
      </View>
      <View style={g.base} />
      <View style={g.labels}>
        {barras.map((b, i) => (
          <Text key={`${b.label}-l-${i}`} style={[g.label, i === sel && g.labelOn]}>{b.label}</Text>
        ))}
      </View>
    </View>
  );
}

export default function GananciasTab() {
  const [periodo, setPeriodo] = useState('semana');
  const [paseos, setPaseos] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [perroSel, setPerroSel] = useState(null); // grupo cuyo historial completo se ve

  const cargar = useCallback(async () => {
    try {
      setPaseos(await fetchGanancias(periodo));
    } catch {
      setPaseos((p) => p ?? []);
    }
  }, [periodo]);

  useEffect(() => { setPaseos(null); cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const resumen = useMemo(() => {
    const lista = paseos ?? [];
    const total = lista.reduce((a, p) => a + p.precio, 0);
    const segundos = lista.reduce((a, p) => a + (p.segundosAcumulados || p.duracionMin * 60), 0);
    const metros = lista.reduce((a, p) => a + (p.distanciaMetros ?? 0), 0);
    return {
      total,
      cantidad: lista.length,
      horas: segundos / 3600,
      metros,
      promedio: lista.length ? total / lista.length : 0,
      barras: armarBarras(lista, periodo),
      perros: agruparPorPerro(lista),
    };
  }, [paseos, periodo]);

  const frase = PERIODOS.find((p) => p.key === periodo).frase;

  const cabecera = (
    <View>
      <View style={s.segmento}>
        {PERIODOS.map((p) => {
          const on = periodo === p.key;
          return (
            <TouchableOpacity key={p.key} style={[s.segBtn, on && s.segBtnOn]} onPress={() => setPeriodo(p.key)}
              accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={[s.segTxt, on && s.segTxtOn]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.hero}>
        <Text style={s.heroLabel}>Cobraste {frase}</Text>
        <Text style={s.heroValor} numberOfLines={1} adjustsFontSizeToFit>{formatoPlata(resumen.total)}</Text>
        <View style={s.heroStats}>
          <Stat valor={String(resumen.cantidad)} etiqueta={resumen.cantidad === 1 ? 'paseo' : 'paseos'} />
          <Stat valor={`${resumen.horas.toFixed(1).replace('.', ',')} h`} etiqueta="caminando" />
          <Stat valor={formatoDistancia(resumen.metros)} etiqueta="recorridos" />
        </View>
      </View>

      {resumen.cantidad > 0 && (
        <Card style={{ marginTop: 14 }}>
          <View style={s.graficoHeader}>
            <Text style={s.graficoTitulo}>
              {periodo === 'semana' ? 'Por día' : periodo === 'mes' ? 'Por semana' : 'Últimos 6 meses'}
            </Text>
            <Text style={s.promedio}>Promedio {formatoPlata(resumen.promedio)} / paseo</Text>
          </View>
          <GraficoBarras barras={resumen.barras} />
        </Card>
      )}

      {resumen.cantidad > 0 && <Seccion titulo="Historial" />}
    </View>
  );

  if (paseos === null) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ padding: 20 }}>{cabecera}</View>
        <ActivityIndicator color={C.teal} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={resumen.perros}
        keyExtractor={(g) => g.key}
        ListHeaderComponent={cabecera}
        contentContainerStyle={s.lista}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={C.teal} />}
        ListEmptyComponent={
          <Vacio icono="wallet-outline" titulo={`Sin paseos ${frase}`}
            texto="Cuando finalices un paseo, lo que cobraste aparece acá." />
        }
        renderItem={({ item }) => {
          const d = new Date(item.ultimo);
          const n = item.paseos.length;
          return (
            <TouchableOpacity style={s.fila} onPress={() => setPerroSel(item)} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel={`Ver todos los paseos de ${item.mascota.nombre}`}>
              <Avatar fuente={item.mascota.visual} nombre={item.mascota.nombre} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={s.filaNombre}>{item.mascota.nombre}</Text>
                <Text style={s.filaSub}>
                  {n} {n === 1 ? 'paseo' : 'paseos'} · último {d.getDate()}/{d.getMonth() + 1}
                </Text>
              </View>
              <Text style={s.filaPrecio}>{formatoPlata(item.total)}</Text>
              <Ionicons name="chevron-forward" size={18} color={C.gris} />
            </TouchableOpacity>
          );
        }}
      />
      <HistorialPerroModal
        visible={!!perroSel}
        mascota={perroSel?.mascota}
        dueno={perroSel?.dueno}
        onCerrar={() => setPerroSel(null)}
      />
    </>
  );
}

const g = StyleSheet.create({
  tooltip: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  tooltipValor: { fontSize: 20, fontWeight: '900', color: C.texto },
  tooltipLabel: { fontSize: 13, color: C.texto2, fontWeight: '600' },
  area: { height: ALTO_GRAFICO, flexDirection: 'row', alignItems: 'flex-end' },
  // Cada columna es más ancha que la barra: área de toque generosa y 2px+ de aire entre barras
  col: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barra: { width: '58%', maxWidth: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barraOn: { backgroundColor: C.teal },
  barraOff: { backgroundColor: C.teal, opacity: 0.45 },
  barraVacia: { backgroundColor: '#E8E8E8' },
  base: { height: 1, backgroundColor: '#E6E6E6' },
  labels: { flexDirection: 'row', marginTop: 6 },
  label: { flex: 1, textAlign: 'center', fontSize: 12, color: C.texto2, fontWeight: '600' },
  labelOn: { color: C.texto, fontWeight: '800' },
});

const s = StyleSheet.create({
  lista: { padding: 20, paddingBottom: 32 },

  segmento: {
    flexDirection: 'row', padding: 4, backgroundColor: '#FFFFFF', borderRadius: 30,
    borderWidth: 1, borderColor: C.borde,
  },
  segBtn: { flex: 1, height: 40, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  segBtnOn: { backgroundColor: C.teal },
  segTxt: { fontSize: 14, fontWeight: '700', color: C.texto2 },
  segTxtOn: { color: '#FFFFFF', fontWeight: '800' },

  hero: { backgroundColor: C.menta, borderRadius: 20, padding: 20, marginTop: 16 },
  heroLabel: { fontSize: 14, fontWeight: '700', color: C.texto },
  heroValor: { fontSize: 46, fontWeight: '900', color: C.texto, marginTop: 2 },
  heroStats: { flexDirection: 'row', marginTop: 14 },

  graficoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  graficoTitulo: { fontSize: 15, fontWeight: '800', color: C.texto },
  promedio: { fontSize: 12, color: C.texto2, fontWeight: '600' },

  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card,
    borderRadius: 16, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  filaNombre: { fontSize: 15, fontWeight: '800', color: C.texto },
  filaSub: { fontSize: 12, color: C.texto2, marginTop: 2 },
  filaPrecio: { fontSize: 17, fontWeight: '900', color: C.texto },
});
