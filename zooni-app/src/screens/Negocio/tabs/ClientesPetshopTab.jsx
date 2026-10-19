/**
 * ClientesPetshopTab.jsx — Clientes del pet shop
 *
 * Uno por dueño que alguna vez hizo un pedido (fetchClientesPetshop):
 * cuántas compras entregadas, cuánto gastó en total, cuándo fue el último
 * pedido y sus tres productos más comprados (para ofrecerle lo de siempre).
 *
 *   · Buscador por nombre o producto.
 *   · Filtros: Todos · Frecuentes (2 compras o más) · Con pedido en curso.
 *   · Tocar un cliente despliega sus pedidos; el globito abre el chat.
 *   · Arriba, el total de clientes y lo facturado entre todos.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, Card, Stat, Vacio, sombra } from '../../../components/paseador/PaseadorUI';
import { EstadoChip, Etiqueta, Segmento } from '../../../components/negocio/NegocioUI';
import {
  cuandoTexto, diaTexto, fetchClientesPetshop, formatoPlata, unidadesDe,
} from '../../../services/negocioApi';

const normalizar = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const EN_CURSO = ['nuevo', 'preparando', 'listo', 'en_camino'];

export default function ClientesPetshopTab({ negocio, avisar, abrirChat }) {
  const [clientes, setClientes] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [abierto, setAbierto] = useState(null); // idDueno
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setClientes(await fetchClientesPetshop(negocio.id));
    } catch {
      setClientes((c) => c ?? []);
      avisar('No se pudieron cargar los clientes.', 'alert-circle');
    }
  }, [negocio.id, avisar]);

  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const lista = clientes ?? [];
  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return lista.filter((c) => {
      if (filtro === 'frecuentes' && c.compras < 2) return false;
      if (filtro === 'curso' && !c.pedidos.some((p) => EN_CURSO.includes(p.estado))) return false;
      if (!q) return true;
      return normalizar(c.dueno.nombre).includes(q)
        || c.pedidos.some((p) => p.items.some((x) => normalizar(x.nombre).includes(q)));
    });
  }, [lista, busqueda, filtro]);

  if (clientes === null) return <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />;

  const facturado = lista.reduce((a, c) => a + c.comprado, 0);
  const frecuentes = lista.filter((c) => c.compras >= 2).length;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={visibles}
        keyExtractor={(c) => String(c.dueno.id)}
        contentContainerStyle={s.lista}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={C.teal} />}
        ListHeaderComponent={(
          <View style={{ gap: 12, marginBottom: 14 }}>
            <View style={s.stats}>
              <Card style={s.statBox}><Stat valor={String(lista.length)} etiqueta="clientes" icono="people" /></Card>
              <Card style={s.statBox}><Stat valor={String(frecuentes)} etiqueta="frecuentes" icono="repeat" /></Card>
            </View>
            {facturado > 0 ? (
              <Card style={s.total}>
                <Text style={s.totalLabel}>Vendido a tus clientes</Text>
                <Text style={s.totalValor} numberOfLines={1} adjustsFontSizeToFit>{formatoPlata(facturado)}</Text>
              </Card>
            ) : null}
            <View style={s.buscador}>
              <Ionicons name="search" size={18} color={C.texto2} />
              <TextInput style={s.buscadorInput} value={busqueda} onChangeText={setBusqueda}
                placeholder="Buscar cliente o producto" placeholderTextColor={C.gris} />
              {busqueda ? (
                <TouchableOpacity onPress={() => setBusqueda('')} accessibilityLabel="Borrar búsqueda">
                  <Ionicons name="close-circle" size={18} color={C.gris} />
                </TouchableOpacity>
              ) : null}
            </View>
            <Segmento
              opciones={[
                { key: 'todos', label: 'Todos' },
                { key: 'frecuentes', label: 'Frecuentes' },
                { key: 'curso', label: 'Pedido activo' },
              ]}
              valor={filtro}
              onCambio={setFiltro}
            />
          </View>
        )}
        ListEmptyComponent={(
          <Vacio icono="people-outline"
            titulo={busqueda || filtro !== 'todos' ? 'Nadie con ese filtro' : 'Todavía no tenés clientes'}
            texto={busqueda || filtro !== 'todos' ? undefined
              : 'Cada dueño que te haga un pedido aparece acá, con todo lo que te compró.'} />
        )}
        renderItem={({ item: c }) => {
          const abiertoAhora = abierto === c.dueno.id;
          const activo = c.pedidos.find((p) => EN_CURSO.includes(p.estado));
          return (
            <View style={s.card}>
              <TouchableOpacity style={s.fila} onPress={() => setAbierto(abiertoAhora ? null : c.dueno.id)}
                activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ expanded: abiertoAhora }}>
                <Avatar uri={c.dueno.foto} nombre={c.dueno.nombre} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={s.nombre} numberOfLines={1}>{c.dueno.nombre}</Text>
                  <Text style={s.sub} numberOfLines={1}>
                    {c.compras} {c.compras === 1 ? 'compra' : 'compras'} · {formatoPlata(c.comprado)}
                  </Text>
                  <Text style={s.sub} numberOfLines={1}>
                    Último pedido {c.ultimo ? diaTexto(c.ultimo).toLowerCase() : '—'}
                  </Text>
                </View>
                <TouchableOpacity style={s.chat} onPress={() => abrirChat(c.dueno.id, c.dueno.nombre)}
                  accessibilityLabel={`Chat con ${c.dueno.nombre}`}>
                  <Ionicons name="chatbubble-ellipses" size={18} color={C.teal} />
                </TouchableOpacity>
              </TouchableOpacity>

              <View style={s.etiquetas}>
                {c.compras >= 2 ? <Etiqueta texto="Frecuente" icono="repeat" color={C.teal} fondo={C.menta} /> : null}
                {activo ? <EstadoChip estado={activo.estado} tipo="pedido" /> : null}
                {c.favoritos.map((f) => (
                  <Etiqueta key={f} texto={f.length > 22 ? `${f.slice(0, 22)}…` : f} icono="heart" color={C.texto2} fondo="#F1F1F1" />
                ))}
              </View>

              {abiertoAhora && (
                <View style={s.pedidos}>
                  {c.pedidos.map((p) => (
                    <View key={p.id} style={s.pedido}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.pedidoTitulo}>Pedido #{p.id} · {formatoPlata(p.total)}</Text>
                        <Text style={s.sub} numberOfLines={2}>
                          {cuandoTexto(p.creadoEn)} · {unidadesDe(p)} {unidadesDe(p) === 1 ? 'producto' : 'productos'} ·{' '}
                          {p.items.map((x) => `${x.cantidad}× ${x.nombre}`).join(', ')}
                        </Text>
                      </View>
                      <EstadoChip estado={p.estado} tipo="pedido" />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  lista: { padding: 20, paddingBottom: 40 },
  stats: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1 },
  total: { backgroundColor: C.menta },
  totalLabel: { fontSize: 13, fontWeight: '700', color: C.texto },
  totalValor: { fontSize: 30, fontWeight: '900', color: C.texto, marginTop: 2 },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: C.borde, paddingHorizontal: 12,
  },
  buscadorInput: { flex: 1, fontSize: 15, color: C.texto, paddingVertical: 11 },

  card: { backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 10, ...sombra },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nombre: { fontSize: 16, fontWeight: '800', color: C.texto },
  sub: { fontSize: 12, color: C.texto2, marginTop: 1 },
  chat: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.menta, alignItems: 'center', justifyContent: 'center' },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },

  pedidos: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F2F2F2', gap: 10 },
  pedido: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pedidoTitulo: { fontSize: 14, fontWeight: '800', color: C.texto },
});
