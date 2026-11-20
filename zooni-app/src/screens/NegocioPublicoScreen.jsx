/**
 * NegocioPublicoScreen.jsx — La ficha de un negocio que ve el dueño
 *
 * Se llega desde el pin del negocio en Comunidad, desde "Turnos y pedidos" o
 * desde el chat. El negocio mismo la abre con { vistaPrevia: true } ("Ver mi
 * ficha como cliente"): se ve igual pero no se puede pedir ni comprar.
 *
 * Arriba, igual para los tres: logo, nombre, si está abierto ahora, cuántos
 * turnos atendió / pedidos entregó en Zooni, y los botones Chat · Llamar ·
 * Cómo llegar. Después cambia según el tipo:
 *
 *   Veterinaria  urgencias 24 h (llamar a la guardia / turno urgente),
 *                especialidades, matrícula, a domicilio, y los servicios con
 *                "Pedir turno" (→ ReservarTurno).
 *   Peluquería   sellos (busca y lleva, hipoalergénicos), tamaños que atiende,
 *                galería de trabajos y servicios con precio por tamaño.
 *   Pet shop     envíos (costo, gratis desde, demora), pedido mínimo, medios
 *                de pago y el catálogo con buscador, categorías y carrito. El
 *                pedido se arma en una hoja (retiro o envío, pago, notas).
 *
 * Al final, los horarios de toda la semana con el día de hoy marcado.
 *
 * Params: { idNegocio, vistaPrevia? }
 */

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { getCurrentUserId } from '../config/session';
import {
  DIA_DE_JS,
  DIAS_SEMANA, MEDIOS_PAGO_NEGOCIO, TAMANOS, configNegocio,
} from '../constants/negocios';

import { abiertoAhora, horarioDelDia, textoPrecioItem } from '../domain/negocios';
import { fetchNegocioPublico } from '../services/negocioApi';
import { formatoPlata } from '../domain/paseos';

import { alerta } from '../utils/dialogo';
import { colores, sombras } from '../theme';
import { normalizarBusqueda } from '../utils/texto';
import { HojaPedido, Stepper } from '../components/negocio/HojaPedido';
import { proximaApertura, Sello, sellosDeNegocio, Titulo } from '../components/negocio/FichaNegocioUI';

// ─── Hoja del pedido (pet shop) ─────────────────────────────────────────────

// ─── Pantalla ───────────────────────────────────────────────────────────────

export default function NegocioPublicoScreen() {
  const navigation = useNavigation();
  const { idNegocio, vistaPrevia = false } = useRoute().params ?? {};

  const [negocio, setNegocio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [carrito, setCarrito] = useState({}); // idItem → cantidad
  const [verPedido, setVerPedido] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState(null);
  const [foto, setFoto] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setNegocio(await fetchNegocioPublico(idNegocio));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, [idNegocio]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const cfg = configNegocio(negocio?.tipo);
  const d = negocio?.datos ?? {};
  const soloVista = vistaPrevia || (negocio && negocio.idUser === getCurrentUserId());

  const items = useMemo(() => negocio?.items ?? [], [negocio]);
  const categorias = useMemo(() => [...new Set(items.map((i) => i.categoria))], [items]);
  const visibles = useMemo(() => {
    const q = normalizarBusqueda(busqueda.trim());
    return items.filter((i) => (!categoria || i.categoria === categoria)
      && (!q || normalizarBusqueda(i.nombre).includes(q) || normalizarBusqueda(i.descripcion).includes(q)));
  }, [items, busqueda, categoria]);

  const lineas = items.filter((i) => carrito[i.id] > 0).map((item) => ({ item, cantidad: carrito[item.id] }));
  const unidades = lineas.reduce((a, x) => a + x.cantidad, 0);
  const subtotal = lineas.reduce((a, x) => a + x.item.precio * x.cantidad, 0);

  const ponerCantidad = (item, n) => {
    const tope = item.stock == null ? 99 : item.stock;
    setCarrito((c) => {
      const nuevo = { ...c, [item.id]: Math.max(0, Math.min(tope, n)) };
      if (!nuevo[item.id]) delete nuevo[item.id];
      return nuevo;
    });
  };

  const soloVer = () => alerta('Vista previa', 'Así te ven tus clientes. Desde acá no se puede pedir ni comprar.');

  const chat = () => {
    if (soloVista) { soloVer(); return; }
    if (!negocio.idServicio) { alerta('Sin chat', 'Este negocio todavía no puede recibir mensajes.'); return; }
    navigation.navigate('Chat', { servicioId: negocio.idServicio, nombre: negocio.nombre, tipoServicio: cfg.label });
  };
  const llamar = (tel) => Linking.openURL(`tel:${String(tel).replace(/[^+\d]/g, '')}`).catch(() => {});
  const comoLlegar = () => Linking.openURL(negocio.lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${negocio.lat},${negocio.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(negocio.direccion)}`).catch(() => {});

  const pedirTurno = (item, urgente = false) => {
    if (soloVista) { soloVer(); return; }
    if (!negocio.abierto) {
      alerta('Sin turnos por ahora', `${negocio.nombre} no está tomando turnos nuevos. Escribile por chat para consultar.`);
      return;
    }
    navigation.navigate('ReservarTurno', { idNegocio: negocio.id, idItem: item?.id ?? null, urgente });
  };

  if (cargando) return <View style={[s.safe, s.centro]}><ActivityIndicator size="large" color={colores.verde} /></View>;
  if (error || !negocio) {
    return (
      <SafeAreaView style={[s.safe, s.centro]}>
        <Ionicons name={error ? 'cloud-offline-outline' : 'storefront-outline'} size={44} color={colores.textoSecundario} />
        <Text style={s.vacioTxt}>{error ? 'No se pudo cargar. Revisá tu conexión.' : 'Este negocio ya no está en Zooni.'}</Text>
        <TouchableOpacity style={[s.btn, { alignSelf: 'stretch', marginHorizontal: 24 }]}
          onPress={() => (error ? (setCargando(true), cargar()) : navigation.goBack())}>
          <Text style={s.btnTxt}>{error ? 'Reintentar' : 'Volver'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const abiertoYa = abiertoAhora(negocio.horarios);
  const hoy = horarioDelDia(negocio.horarios, new Date());
  const keyHoy = DIA_DE_JS[new Date().getDay()];
  const realizadosTxt = negocio.realizados
    ? `${negocio.realizados} ${cfg.usaPedidos ? (negocio.realizados === 1 ? 'pedido entregado' : 'pedidos entregados') : (negocio.realizados === 1 ? 'turno atendido' : 'turnos atendidos')} en Zooni`
    : 'Nuevo en Zooni';

  const sellos = sellosDeNegocio(negocio);

  const porCategoria = categorias
    .map((c) => ({ categoria: c, items: visibles.filter((i) => i.categoria === c) }))
    .filter((g) => g.items.length);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colores.menta} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colores.texto} />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>{cfg.label}</Text>
        <View style={{ width: 24 }} />
      </View>

      {soloVista ? (
        <View style={s.vista}>
          <Ionicons name="eye-outline" size={16} color={colores.azul} />
          <Text style={s.vistaTxt}>Vista previa: así ven tu ficha los clientes.</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={[s.scroll, lineas.length && { paddingBottom: 110 }]}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Cabecera */}
        <View style={s.card}>
          <View style={s.heroFila}>
            {negocio.logo
              ? <Image source={{ uri: negocio.logo }} style={s.logo} />
              : <View style={[s.logo, { backgroundColor: cfg.fondoIcono, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name={cfg.icono} size={32} color={cfg.color} />
              </View>}
            <View style={{ flex: 1 }}>
              <Text style={s.nombre}>{negocio.nombre}</Text>
              <View style={[s.tipoChip, { backgroundColor: cfg.fondoIcono }]}>
                <Ionicons name={cfg.icono} size={12} color={cfg.color} />
                <Text style={[s.tipoChipTxt, { color: cfg.color }]}>{cfg.label}{negocio.barrio ? ` · ${negocio.barrio}` : ''}</Text>
              </View>
              <View style={s.estadoFila}>
                <View style={[s.punto, { backgroundColor: abiertoYa ? colores.verde : colores.rojo }]} />
                <Text style={[s.estadoTxt, { color: abiertoYa ? colores.verde : colores.rojo }]}>
                  {abiertoYa ? `Abierto · hasta las ${hoy.hasta}` : 'Cerrado'}
                </Text>
                {!abiertoYa && proximaApertura(negocio.horarios)
                  ? <Text style={s.estadoSub}> · {proximaApertura(negocio.horarios)}</Text> : null}
              </View>
            </View>
          </View>
          <Text style={s.realizados}>
            <Ionicons name="ribbon-outline" size={13} color={colores.textoSecundario} /> {realizadosTxt}
          </Text>
          {negocio.descripcion ? <Text style={s.descripcion}>{negocio.descripcion}</Text> : null}
          {sellos.length ? (
            <View style={s.sellos}>{sellos.map((x) => <Sello key={x.texto} {...x} />)}</View>
          ) : null}
          <View style={s.direccion}>
            <Ionicons name="location-outline" size={16} color={colores.textoSecundario} />
            <Text style={s.direccionTxt}>{negocio.direccion}</Text>
          </View>

          <View style={s.acciones}>
            <TouchableOpacity style={s.accion} onPress={chat} accessibilityLabel="Chatear">
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colores.verde} />
              <Text style={s.accionTxt}>Chat</Text>
            </TouchableOpacity>
            {negocio.telefono ? (
              <TouchableOpacity style={s.accion} onPress={() => llamar(negocio.telefono)} accessibilityLabel="Llamar">
                <Ionicons name="call-outline" size={20} color={colores.verde} />
                <Text style={s.accionTxt}>Llamar</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={s.accion} onPress={comoLlegar} accessibilityLabel="Cómo llegar">
              <Ionicons name="navigate-outline" size={20} color={colores.verde} />
              <Text style={s.accionTxt}>Cómo llegar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!negocio.abierto && (
          <View style={s.cerrado}>
            <Ionicons name="pause-circle" size={20} color={colores.ambar} />
            <Text style={s.cerradoTxt}>
              {cfg.usaPedidos ? 'No está tomando pedidos' : 'No está tomando turnos'} por ahora. Podés escribirle por chat.
            </Text>
          </View>
        )}

        {/* ── Veterinaria ── */}
        {negocio.tipo === 'veterinaria' && d.urgencias24h && (
          <View style={s.urgencia}>
            <View style={s.urgenciaTop}>
              <Ionicons name="alert-circle" size={26} color={colores.rojo} />
              <View style={{ flex: 1 }}>
                <Text style={s.urgenciaTitulo}>Urgencias las 24 horas</Text>
                <Text style={s.urgenciaTxt}>Si tu mascota está mal, llamá a la guardia o pedí un turno urgente: le llega destacado.</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {d.telefonoUrgencias || negocio.telefono ? (
                <TouchableOpacity style={[s.btnChico, { backgroundColor: colores.rojo }]} onPress={() => llamar(d.telefonoUrgencias || negocio.telefono)}>
                  <Ionicons name="call" size={16} color={colores.blanco} />
                  <Text style={[s.btnChicoTxt, { color: colores.blanco }]}>Llamar a la guardia</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[s.btnChico, { borderWidth: 2, borderColor: colores.rojo, backgroundColor: colores.blanco }]}
                onPress={() => pedirTurno(items[0], true)}>
                <Text style={[s.btnChicoTxt, { color: colores.rojo }]}>Turno urgente</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {negocio.tipo === 'veterinaria' && (d.especialidades?.length || d.matricula) ? (
          <>
            <Titulo>Especialidades</Titulo>
            <View style={s.card}>
              <View style={s.sellos}>
                {(d.especialidades ?? []).map((e) => <Sello key={e} icono="medical-outline" texto={e} />)}
              </View>
              {d.matricula ? <Text style={s.matricula}>Matrícula {d.matricula}</Text> : null}
            </View>
          </>
        ) : null}

        {/* ── Peluquería: trabajos ── */}
        {negocio.tipo === 'peluqueria' && d.galeria?.length > 0 && (
          <>
            <Titulo>Trabajos</Titulo>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {d.galeria.map((g) => (
                <TouchableOpacity key={g.url} onPress={() => setFoto(g)} activeOpacity={0.85}>
                  <Image source={{ uri: g.url }} style={s.trabajo} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Servicios (veterinaria / peluquería) ── */}
        {cfg.usaTurnos && (
          <>
            <Titulo>{negocio.tipo === 'veterinaria' ? 'Consultas y servicios' : 'Servicios y precios'}</Titulo>
            {negocio.tipo === 'peluqueria' && items.some((i) => i.precios) ? (
              <Text style={s.ayudaSeccion}>El precio depende del tamaño: chico hasta 10 kg, mediano 10–25 kg, grande +25 kg.</Text>
            ) : null}
            {!items.length ? (
              <View style={s.card}><Text style={s.vacioTxt}>Todavía no cargó sus servicios. Escribile por chat para consultar.</Text></View>
            ) : porCategoria.map((g) => (
              <View key={g.categoria} style={[s.card, { marginBottom: 12, paddingVertical: 6 }]}>
                <Text style={s.categoria}>{g.categoria}</Text>
                {g.items.map((it, i) => (
                  <View key={it.id} style={[s.servicio, i > 0 && s.servicioBorde]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.servicioNombre}>{it.nombre}</Text>
                      {it.descripcion ? <Text style={s.servicioDesc} numberOfLines={2}>{it.descripcion}</Text> : null}
                      <Text style={s.servicioDesc}>
                        <Ionicons name="time-outline" size={12} color={colores.textoSecundario} /> {it.duracionMin} min
                      </Text>
                      {it.precios ? (
                        <Text style={s.porTamano}>
                          {TAMANOS.filter((t) => Number(it.precios[t.key]) > 0)
                            .map((t) => `${t.label} ${formatoPlata(it.precios[t.key])}`).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <Text style={s.servicioPrecio}>{textoPrecioItem(it)}</Text>
                      <TouchableOpacity style={s.btnTurno} onPress={() => pedirTurno(it)} accessibilityLabel={`Pedir turno para ${it.nombre}`}>
                        <Text style={s.btnTurnoTxt}>Pedir turno</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* ── Catálogo (pet shop) ── */}
        {cfg.usaPedidos && (
          <>
            <Titulo extra={<Text style={s.tituloExtra}>{items.length} productos</Text>}>Catálogo</Titulo>
            {(d.mediosPago ?? []).length ? (
              <Text style={s.ayudaSeccion}>
                Pagás con {MEDIOS_PAGO_NEGOCIO.filter((m) => d.mediosPago.includes(m.key)).map((m) => m.label.toLowerCase()).join(', ')}.
              </Text>
            ) : null}
            {items.length > 0 && (
              <>
                <View style={s.buscador}>
                  <Ionicons name="search" size={18} color={colores.textoSecundario} />
                  <TextInput style={s.buscadorInput} value={busqueda} onChangeText={setBusqueda}
                    placeholder="Buscar alimento, juguete…" placeholderTextColor={colores.textoTenue} />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categorias}>
                  {[null, ...categorias].map((c) => {
                    const on = categoria === c;
                    return (
                      <TouchableOpacity key={c ?? 'todas'} style={[s.chip, on && s.chipOn]} onPress={() => setCategoria(c)}>
                        <Text style={[s.chipTxt, on && { color: colores.blanco }]}>{c ?? 'Todo'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
            {!items.length ? (
              <View style={s.card}><Text style={s.vacioTxt}>Todavía no cargó productos. Escribile por chat para consultar.</Text></View>
            ) : !visibles.length ? (
              <Text style={s.vacioTxt}>No hay productos con esa búsqueda.</Text>
            ) : visibles.map((it) => {
              const cant = carrito[it.id] ?? 0;
              const agotado = it.stock === 0;
              return (
                <View key={it.id} style={[s.producto, agotado && { opacity: 0.55 }]}>
                  {it.foto
                    ? <Image source={{ uri: it.foto }} style={s.productoFoto} />
                    : <View style={[s.productoFoto, s.productoSinFoto]}><Ionicons name="cube-outline" size={26} color={colores.ambar} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={s.servicioNombre} numberOfLines={2}>{it.nombre}</Text>
                    {it.descripcion ? <Text style={s.servicioDesc} numberOfLines={2}>{it.descripcion}</Text> : null}
                    <Text style={s.servicioPrecio}>{formatoPlata(it.precio)}</Text>
                    {agotado ? <Text style={[s.stock, { color: colores.rojo }]}>Sin stock</Text>
                      : it.stock != null && it.stock <= 3 ? <Text style={s.stock}>¡Quedan {it.stock}!</Text> : null}
                  </View>
                  {agotado ? null : cant > 0 ? (
                    <Stepper cantidad={cant} max={it.stock} onCambio={(n) => ponerCantidad(it, n)} />
                  ) : (
                    <TouchableOpacity style={s.agregar} onPress={() => (soloVista ? soloVer() : ponerCantidad(it, 1))}
                      accessibilityLabel={`Agregar ${it.nombre}`}>
                      <Ionicons name="add" size={22} color={colores.blanco} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* Horarios */}
        <Titulo>Horarios</Titulo>
        <View style={s.card}>
          {DIAS_SEMANA.map((dia) => {
            const h = negocio.horarios?.[dia.key];
            const esHoy = dia.key === keyHoy;
            return (
              <View key={dia.key} style={[s.horario, esHoy && s.horarioHoy]}>
                <Text style={[s.horarioDia, esHoy && { fontWeight: '900', color: colores.verde }]}>{dia.label}{esHoy ? ' (hoy)' : ''}</Text>
                <Text style={[s.horarioHora, !h?.activo && { color: colores.textoSecundario }]}>{h?.activo ? `${h.desde} – ${h.hasta}` : 'Cerrado'}</Text>
              </View>
            );
          })}
          {negocio.tipo === 'veterinaria' && d.urgencias24h ? (
            <Text style={s.horarioNota}>Fuera de horario: urgencias por la guardia 24 h.</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Carrito */}
      {lineas.length > 0 && (
        <View style={s.carritoBarra}>
          <TouchableOpacity style={s.carritoBtn} onPress={() => setVerPedido(true)} activeOpacity={0.9}>
            <View style={s.carritoCant}><Text style={s.carritoCantTxt}>{unidades}</Text></View>
            <Text style={s.carritoTxt}>Ver pedido</Text>
            <Text style={s.carritoTotal}>{formatoPlata(subtotal)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {cfg.usaPedidos && (
        <HojaPedido
          visible={verPedido}
          negocio={negocio}
          lineas={lineas}
          soloVista={soloVista}
          onCantidad={(item, n) => { ponerCantidad(item, n); if (n <= 0 && lineas.length === 1) setVerPedido(false); }}
          onCerrar={() => setVerPedido(false)}
          onHecho={(id) => {
            setVerPedido(false);
            setCarrito({});
            navigation.navigate('MisTurnos', {
              tab: 'pedidos', aviso: `¡Listo! ${negocio.nombre} recibió tu pedido #${id}. Te avisamos cuando lo acepte.`,
            });
          }}
        />
      )}

      <Modal visible={!!foto} transparent animationType="fade" onRequestClose={() => setFoto(null)}>
        <TouchableOpacity style={s.visor} activeOpacity={1} onPress={() => setFoto(null)}>
          {foto ? <Image source={{ uri: foto.url }} style={s.visorImg} resizeMode="contain" /> : null}
          {foto?.nota ? <Text style={s.visorNota}>{foto.nota}</Text> : null}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colores.menta },
  centro: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  headerTitulo: { fontSize: 20, fontWeight: '800', color: colores.verde },
  scroll: { padding: 20, paddingTop: 4, paddingBottom: 40 },
  vista: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8,
    padding: 10, borderRadius: 12, backgroundColor: colores.azulFondo,
  },
  vistaTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: colores.azul },

  card: { backgroundColor: colores.blanco, borderRadius: 20, padding: 16, ...sombras.tarjeta },
  heroFila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 76, height: 76, borderRadius: 22 },
  nombre: { fontSize: 21, fontWeight: '900', color: colores.texto },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, marginTop: 4,
  },
  tipoChipTxt: { fontSize: 12, fontWeight: '800' },
  estadoFila: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 },
  punto: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  estadoTxt: { fontSize: 13, fontWeight: '800' },
  estadoSub: { fontSize: 12, color: colores.textoSecundario },
  realizados: { fontSize: 13, color: colores.textoSecundario, marginTop: 12, fontWeight: '600' },
  descripcion: { fontSize: 14, color: colores.texto, marginTop: 10, lineHeight: 20 },
  sellos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  direccion: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  direccionTxt: { flex: 1, fontSize: 13, color: colores.texto },
  acciones: { flexDirection: 'row', gap: 8, marginTop: 14 },
  accion: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 16,
    borderWidth: 1.5, borderColor: colores.menta, backgroundColor: '#F6FFF9',
  },
  accionTxt: { fontSize: 12, fontWeight: '800', color: colores.verde },

  cerrado: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 14, borderRadius: 16,
    backgroundColor: '#FFF7E8', borderWidth: 1.5, borderColor: '#FCE7B2',
  },
  cerradoTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: colores.texto },

  urgencia: {
    marginTop: 14, padding: 16, borderRadius: 20, backgroundColor: '#FFF7F8', borderWidth: 2, borderColor: colores.rojoBorde,
  },
  urgenciaTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  urgenciaTitulo: { fontSize: 16, fontWeight: '900', color: colores.rojo },
  urgenciaTxt: { fontSize: 13, color: colores.texto, marginTop: 2, lineHeight: 18 },
  btnChico: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 42, borderRadius: 21,
  },
  btnChicoTxt: { fontSize: 14, fontWeight: '800' },
  matricula: { fontSize: 13, color: colores.textoSecundario, marginTop: 10, fontWeight: '700' },

  tituloExtra: { fontSize: 13, color: colores.textoSecundario, fontWeight: '700' },
  ayudaSeccion: { fontSize: 12, color: colores.textoSecundario, marginTop: -4, marginBottom: 10 },
  trabajo: { width: 130, height: 130, borderRadius: 16, backgroundColor: colores.blanco },

  categoria: { fontSize: 13, fontWeight: '900', color: colores.verde, textTransform: 'uppercase', marginTop: 8, marginBottom: 2 },
  servicio: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  servicioBorde: { borderTopWidth: 1, borderTopColor: colores.gris100 },
  servicioNombre: { fontSize: 15, fontWeight: '800', color: colores.texto },
  servicioDesc: { fontSize: 12, color: colores.textoSecundario, marginTop: 2 },
  porTamano: { fontSize: 12, color: colores.texto, marginTop: 4, fontWeight: '600' },
  servicioPrecio: { fontSize: 16, fontWeight: '900', color: colores.texto, marginTop: 2 },
  btnTurno: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colores.amarillo, justifyContent: 'center' },
  btnTurnoTxt: { fontSize: 13, fontWeight: '800', color: colores.texto },

  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colores.blanco, borderRadius: 16, paddingHorizontal: 12,
  },
  buscadorInput: { flex: 1, fontSize: 15, color: colores.texto, paddingVertical: 12 },
  categorias: { gap: 8, paddingVertical: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colores.blanco, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  chipOn: { backgroundColor: colores.verde },
  chipTxt: { fontSize: 13, fontWeight: '700', color: colores.texto },

  producto: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colores.blanco, borderRadius: 18,
    padding: 12, marginBottom: 10, ...sombras.tarjeta,
  },
  productoFoto: { width: 72, height: 72, borderRadius: 14, backgroundColor: '#F6F6F6' },
  productoSinFoto: { backgroundColor: '#FFF4DE', alignItems: 'center', justifyContent: 'center' },
  stock: { fontSize: 12, fontWeight: '800', color: colores.ambar, marginTop: 2 },
  agregar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colores.verde, alignItems: 'center', justifyContent: 'center' },

  horario: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10 },
  horarioHoy: { backgroundColor: '#F2FCF6' },
  horarioDia: { fontSize: 14, color: colores.texto, fontWeight: '600' },
  horarioHora: { fontSize: 14, color: colores.texto, fontWeight: '800', fontVariant: ['tabular-nums'] },
  horarioNota: { fontSize: 12, color: colores.rojo, marginTop: 8, fontWeight: '700' },

  carritoBarra: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16 },
  carritoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, height: 58, borderRadius: 30, paddingHorizontal: 12,
    backgroundColor: colores.amarillo, ...sombras.tarjeta, shadowOpacity: 0.18,
  },
  carritoCant: { width: 36, height: 36, borderRadius: 18, backgroundColor: colores.blanco, alignItems: 'center', justifyContent: 'center' },
  carritoCantTxt: { fontSize: 15, fontWeight: '900', color: colores.texto },
  carritoTxt: { flex: 1, fontSize: 16, fontWeight: '800', color: colores.texto },
  carritoTotal: { fontSize: 16, fontWeight: '900', color: colores.texto, marginRight: 6 },

  // Hoja del pedido
  btn: {
    marginTop: 20, height: 56, borderRadius: 30, backgroundColor: colores.amarillo, alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  btnTxt: { fontSize: 16, fontWeight: '800', color: colores.texto },
  vacioTxt: { fontSize: 14, color: colores.textoSecundario, textAlign: 'center', lineHeight: 20 },

  visor: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  visorImg: { width: '100%', height: '75%' },
  visorNota: { fontSize: 15, fontWeight: '700', color: colores.blanco, marginTop: 14, textAlign: 'center' },
});
