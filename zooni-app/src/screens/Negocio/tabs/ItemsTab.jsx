/**
 * ItemsTab.jsx — "Servicios y precios" (veterinaria / peluquería) o
 *                "Catálogo" (pet shop)
 *
 *   · Agrupado por categoría, con buscador y filtro por categoría.
 *   · Servicios: precio (o "desde $X" si depende del tamaño) y duración.
 *     Si todavía no cargó ninguno, se ofrecen los SUGERIDOS del tipo para
 *     agregarlos de una (con precios de referencia que después ajusta).
 *   · Productos: foto, precio y stock con +/− rápido; avisos de "sin stock".
 *   · Tocar uno lo edita (ItemFormModal); los ocultos se ven atenuados.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, RefreshControl, ScrollView, SectionList, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C, Card, PillButton, Vacio, sombra } from '../../../components/paseador/PaseadorUI';
import { Etiqueta } from '../../../components/negocio/NegocioUI';
import ItemFormModal from '../../../components/negocio/ItemFormModal';
import {
  agregarSugeridos, ajustarStock, borrarItem, fetchItems, formatoPlata, guardarItem, textoPrecioItem,
} from '../../../services/negocioApi';

const normalizar = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function precioSugerido(x) {
  if (x.precios) return `desde ${formatoPlata(Math.min(...Object.values(x.precios)))}`;
  return formatoPlata(x.precio);
}

export default function ItemsTab({ negocio, cfg, tipo, avisar }) {
  const esProducto = cfg.clase === 'producto';
  const [items, setItems] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [form, setForm] = useState(undefined); // undefined cerrado · null nuevo · item
  const [elegidos, setElegidos] = useState(() => new Set(cfg.sugeridos.map((x) => x.nombre)));
  const [verSugeridos, setVerSugeridos] = useState(false);
  const [agregando, setAgregando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setItems(await fetchItems(negocio.id));
    } catch {
      setItems((x) => x ?? []);
      avisar('No se pudo cargar. Deslizá hacia abajo para reintentar.', 'alert-circle');
    }
  }, [negocio.id, avisar]);

  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const secciones = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const filtrados = (items ?? []).filter((it) => (!categoria || it.categoria === categoria)
      && (!q || normalizar(it.nombre).includes(q) || normalizar(it.descripcion).includes(q)));
    const grupos = new Map();
    filtrados.forEach((it) => {
      if (!grupos.has(it.categoria)) grupos.set(it.categoria, []);
      grupos.get(it.categoria).push(it);
    });
    const orden = [...cfg.categorias, ...[...grupos.keys()].filter((k) => !cfg.categorias.includes(k))];
    return orden.filter((k) => grupos.has(k)).map((k) => ({ title: k, data: grupos.get(k) }));
  }, [items, busqueda, categoria, cfg.categorias]);

  const guardar = async (item) => {
    await guardarItem(negocio, item);
    setForm(undefined);
    avisar(item.id ? 'Cambios guardados' : `${esProducto ? 'Producto' : 'Servicio'} agregado`);
    await cargar();
  };

  const borrar = async () => {
    try {
      await borrarItem(negocio, form.id);
      setForm(undefined);
      avisar('Borrado');
      await cargar();
    } catch {
      avisar('No se pudo borrar. Probá de nuevo.', 'alert-circle');
    }
  };

  const stock = async (item, delta) => {
    try {
      const nuevo = await ajustarStock(negocio, item, delta);
      setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, stock: nuevo } : x)));
    } catch {
      avisar('No se pudo cambiar el stock.', 'alert-circle');
    }
  };

  const sumarSugeridos = async () => {
    const lista = cfg.sugeridos.filter((x) => elegidos.has(x.nombre));
    if (!lista.length) return;
    setAgregando(true);
    try {
      const n = await agregarSugeridos(negocio, lista, items ?? []);
      avisar(n ? `${n} ${n === 1 ? 'servicio agregado' : 'servicios agregados'}: revisá los precios` : 'Ya los tenías cargados');
      setVerSugeridos(false);
      await cargar();
    } catch {
      avisar('No se pudieron agregar. Probá de nuevo.', 'alert-circle');
    } finally {
      setAgregando(false);
    }
  };

  if (items === null) return <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />;

  const tieneNombre = new Set(items.map((i) => normalizar(i.nombre)));
  const sugeridosDisponibles = cfg.sugeridos.filter((x) => !tieneNombre.has(normalizar(x.nombre)));
  const mostrarSugeridos = sugeridosDisponibles.length > 0 && (items.length === 0 || verSugeridos);
  const sinStock = items.filter((i) => i.activo && i.stock === 0).length;

  const cabecera = (
    <View>
      {mostrarSugeridos && (
        <Card style={s.sugeridos}>
          <Text style={s.sugTitulo}>{items.length ? 'Servicios sugeridos' : 'Empezá rápido'}</Text>
          <Text style={s.sugTxt}>
            Elegí los que ofrecés y los cargamos con precios de referencia. Después los ajustás tocándolos.
          </Text>
          {sugeridosDisponibles.map((x) => {
            const on = elegidos.has(x.nombre);
            return (
              <TouchableOpacity key={x.nombre} style={s.sugFila} activeOpacity={0.8}
                onPress={() => setElegidos((set) => {
                  const n = new Set(set);
                  if (n.has(x.nombre)) n.delete(x.nombre); else n.add(x.nombre);
                  return n;
                })}
                accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? C.teal : C.gris} />
                <View style={{ flex: 1 }}>
                  <Text style={s.sugNombre}>{x.nombre}</Text>
                  <Text style={s.sugDet}>{x.categoria} · {x.duracion} min</Text>
                </View>
                <Text style={s.sugPrecio}>{precioSugerido(x)}</Text>
              </TouchableOpacity>
            );
          })}
          <PillButton titulo={`Agregar ${sugeridosDisponibles.filter((x) => elegidos.has(x.nombre)).length} servicios`}
            chico cargando={agregando} onPress={sumarSugeridos} style={{ marginTop: 12 }}
            disabled={!sugeridosDisponibles.some((x) => elegidos.has(x.nombre))} />
        </Card>
      )}

      {items.length > 0 && (
        <>
          {esProducto && (
            <View style={s.buscador}>
              <Ionicons name="search" size={18} color={C.texto2} />
              <TextInput style={s.buscadorInput} value={busqueda} onChangeText={setBusqueda}
                placeholder="Buscar producto" placeholderTextColor={C.gris} />
            </View>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cats}>
            {[null, ...cfg.categorias.filter((c) => items.some((i) => i.categoria === c))].map((c) => {
              const on = categoria === c;
              return (
                <TouchableOpacity key={c ?? 'todas'} style={[s.cat, on && s.catOn]} onPress={() => setCategoria(c)}>
                  <Text style={[s.catTxt, on && { color: '#FFF' }]}>{c ?? `Todas (${items.length})`}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {esProducto && sinStock > 0 && (
            <View style={s.aviso}>
              <Ionicons name="alert-circle" size={16} color={C.rojo} />
              <Text style={s.avisoTxt}>
                {sinStock} {sinStock === 1 ? 'producto sin stock: no se puede pedir' : 'productos sin stock: no se pueden pedir'}
              </Text>
            </View>
          )}
          {!esProducto && sugeridosDisponibles.length > 0 && !verSugeridos && (
            <TouchableOpacity style={s.verSug} onPress={() => setVerSugeridos(true)}>
              <Ionicons name="sparkles-outline" size={15} color={C.teal} />
              <Text style={s.verSugTxt}>Ver servicios sugeridos</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={secciones}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={s.lista}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={C.teal} />}
        ListHeaderComponent={cabecera}
        ListEmptyComponent={items.length && !mostrarSugeridos ? (
          <Text style={s.vacioTxt}>Nada con ese filtro.</Text>
        ) : !mostrarSugeridos ? (
          <Vacio icono={esProducto ? 'cube-outline' : 'pricetags-outline'}
            titulo={esProducto ? 'Tu catálogo está vacío' : 'Todavía no cargaste servicios'}
            texto={esProducto ? 'Cargá tus productos con precio y stock para recibir pedidos.' : undefined} />
        ) : null}
        renderSectionHeader={({ section }) => <Text style={s.seccion}>{section.title}</Text>}
        renderItem={({ item: it }) => (
          <TouchableOpacity style={[s.item, !it.activo && { opacity: 0.55 }]} onPress={() => setForm(it)} activeOpacity={0.85}>
            {esProducto ? (
              it.foto
                ? <Image source={{ uri: it.foto }} style={s.foto} />
                : <View style={[s.foto, s.fotoVacia]}><Ionicons name="cube-outline" size={22} color={C.teal} /></View>
            ) : (
              <View style={[s.icono, { backgroundColor: cfg.fondoIcono }]}>
                <Ionicons name={cfg.icono} size={20} color={cfg.color} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.nombre} numberOfLines={2}>{it.nombre}</Text>
              <View style={s.etiquetas}>
                {!esProducto && it.duracionMin ? (
                  <Etiqueta texto={`${it.duracionMin} min`} icono="time-outline" color={C.texto2} fondo="#F1F1F1" />
                ) : null}
                {esProducto && it.stock != null ? (
                  <Etiqueta texto={it.stock === 0 ? 'Sin stock' : `Stock ${it.stock}`}
                    color={it.stock === 0 ? C.rojo : it.stock <= 3 ? '#B07A00' : C.texto2}
                    fondo={it.stock === 0 ? '#FDECEE' : it.stock <= 3 ? '#FFF1DC' : '#F1F1F1'} />
                ) : null}
                {!it.activo ? <Etiqueta texto="Oculto" icono="eye-off" color={C.texto2} fondo="#F1F1F1" /> : null}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={s.precio}>{textoPrecioItem(it)}</Text>
              {esProducto && it.stock != null ? (
                <View style={s.stockBtns}>
                  <TouchableOpacity style={s.stockBtn} onPress={() => stock(it, -1)} disabled={it.stock === 0}
                    accessibilityLabel="Uno menos de stock">
                    <Ionicons name="remove" size={16} color={C.teal} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.stockBtn} onPress={() => stock(it, 1)} accessibilityLabel="Uno más de stock">
                    <Ionicons name="add" size={16} color={C.teal} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={s.fab} onPress={() => setForm(null)} activeOpacity={0.9}
        accessibilityLabel={esProducto ? 'Agregar producto' : 'Agregar servicio'}>
        <Ionicons name="add" size={24} color={C.texto} />
        <Text style={s.fabTxt}>{esProducto ? 'Producto' : 'Servicio'}</Text>
      </TouchableOpacity>

      <ItemFormModal
        visible={form !== undefined}
        tipo={tipo}
        item={form ?? null}
        onGuardar={guardar}
        onBorrar={borrar}
        onCerrar={() => setForm(undefined)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  lista: { padding: 20, paddingBottom: 100 },
  sugeridos: { marginBottom: 8 },
  sugTitulo: { fontSize: 17, fontWeight: '900', color: C.texto },
  sugTxt: { fontSize: 13, color: C.texto2, marginTop: 4, marginBottom: 8, lineHeight: 18 },
  sugFila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  sugNombre: { fontSize: 14, fontWeight: '800', color: C.texto },
  sugDet: { fontSize: 12, color: C.texto2 },
  sugPrecio: { fontSize: 13, fontWeight: '800', color: C.texto },

  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: C.borde, paddingHorizontal: 12, marginBottom: 10,
  },
  buscadorInput: { flex: 1, fontSize: 15, color: C.texto, paddingVertical: 11 },
  cats: { gap: 8, paddingBottom: 4 },
  cat: { borderRadius: 18, borderWidth: 1.5, borderColor: C.menta, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFF' },
  catOn: { backgroundColor: C.teal, borderColor: C.teal },
  catTxt: { fontSize: 13, fontWeight: '700', color: C.texto },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FDECEE', borderRadius: 12, padding: 10, marginTop: 10 },
  avisoTxt: { flex: 1, fontSize: 12, fontWeight: '700', color: C.texto },
  verSug: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, minHeight: 32 },
  verSugTxt: { fontSize: 13, fontWeight: '800', color: C.teal },

  seccion: { fontSize: 15, fontWeight: '900', color: C.texto, marginTop: 18, marginBottom: 8 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16,
    padding: 12, marginBottom: 8, ...sombra,
  },
  icono: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  foto: { width: 52, height: 52, borderRadius: 12 },
  fotoVacia: { backgroundColor: C.menta, alignItems: 'center', justifyContent: 'center' },
  nombre: { fontSize: 15, fontWeight: '800', color: C.texto },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  precio: { fontSize: 15, fontWeight: '900', color: C.texto },
  stockBtns: { flexDirection: 'row', gap: 6 },
  stockBtn: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.menta,
    alignItems: 'center', justifyContent: 'center',
  },
  vacioTxt: { fontSize: 14, color: C.texto2, textAlign: 'center', marginTop: 20 },

  fab: {
    position: 'absolute', right: 20, bottom: 20, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.amarillo, borderRadius: 28, paddingHorizontal: 18, height: 52, ...sombra,
  },
  fabTxt: { fontSize: 15, fontWeight: '800', color: C.texto },
});
