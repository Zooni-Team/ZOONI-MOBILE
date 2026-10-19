/**
 * NegocioChatScreen.jsx — El negocio chatea con un cliente
 *
 * Mismas burbujas que el chat de paseadores: verde menta para el negocio
 * (derecha), blancas para el dueño (izquierda). Abajo del header, lo que hay
 * que saber del cliente mientras se le contesta:
 *   · veterinaria / peluquería → su próximo turno (o "sin turnos") y cuántas
 *     veces vino, con sus mascotas.
 *   · pet shop → el pedido que tiene en curso (o cuántas compras hizo).
 * Respuestas rápidas del tipo de negocio (constants/negocios.js): la que ya se
 * mandó en esta conversación desaparece y entra la siguiente.
 * Polling liviano mientras está en foco, como el resto de los chats.
 *
 * Params: { tipo, idDueno, nombre }
 */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { Avatar, C } from '../../components/paseador/PaseadorUI';
import { EstadoChip } from '../../components/negocio/NegocioUI';
import { configNegocio } from '../../constants/negocios';
import {
  cuandoTexto, enviarMensajeNegocio, fetchContextoCliente, fetchMiNegocio, formatoPlata, getMensajesNegocio,
  marcarLeidosNegocio,
} from '../../services/negocioApi';
import { etiquetaDia, horaCorta, mismoDia } from '../../utils/tiempoRelativo';

const POLL_MS = 4000;
const RAPIDAS_VISIBLES = 3;

export default function NegocioChatScreen() {
  const navigation = useNavigation();
  const { tipo = 'veterinaria', idDueno, nombre } = useRoute().params ?? {};
  const cfg = configNegocio(tipo);

  const [negocio, setNegocio] = useState(null);
  const [contexto, setContexto] = useState(null);
  const [mensajes, setMensajes] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchMiNegocio(tipo).then(setNegocio).catch(() => setError('No se pudo abrir la conversación.'));
  }, [tipo]);

  useEffect(() => {
    if (negocio) fetchContextoCliente(negocio, idDueno).then(setContexto).catch(() => {});
  }, [negocio, idDueno]);

  const cargar = useCallback(async () => {
    if (!negocio) return;
    if (!negocio.idServicio) {
      // Sin pin en Comunidad no hay hilo posible (ver MensajesNegocioTab)
      setMensajes([]);
      setError('Tu negocio no tiene su pin en Comunidad: revisá la ubicación en «Mi negocio».');
      return;
    }
    try {
      setMensajes(await getMensajesNegocio(negocio.idServicio, idDueno));
      marcarLeidosNegocio(negocio.idServicio, idDueno).catch(() => {});
    } catch {
      setMensajes((m) => m ?? []);
    }
  }, [negocio, idDueno]);

  useFocusEffect(useCallback(() => {
    cargar();
    const t = setInterval(cargar, POLL_MS);
    return () => clearInterval(t);
  }, [cargar]));

  const enviar = async (contenido = texto) => {
    const limpio = contenido.trim();
    if (!limpio || !negocio || enviando) return;
    setEnviando(true);
    setTexto('');
    setError(null);
    try {
      await enviarMensajeNegocio(negocio, idDueno, limpio);
      await cargar();
    } catch {
      setTexto(limpio); // que no se pierda lo escrito
      setError('No se pudo enviar. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const nombreCliente = contexto?.dueno?.nombre ?? nombre ?? 'Cliente';
  const yaMandadas = new Set((mensajes ?? []).filter((m) => m.autor === 'yo').map((m) => String(m.texto ?? '').trim()));
  const rapidas = cfg.rapidas.filter((r) => !yaMandadas.has(r)).slice(0, RAPIDAS_VISIBLES);

  // Una línea con lo que importa de este cliente
  let franja = null;
  if (contexto) {
    if (cfg.usaPedidos) {
      franja = contexto.pedidoActivo ? (
        <View style={s.franja}>
          <Ionicons name="bag-handle-outline" size={16} color={C.teal} />
          <Text style={s.franjaTxt} numberOfLines={1}>
            Pedido #{contexto.pedidoActivo.id} · {formatoPlata(contexto.pedidoActivo.total)}
          </Text>
          <EstadoChip estado={contexto.pedidoActivo.estado} tipo="pedido" />
        </View>
      ) : (
        <View style={s.franja}>
          <Ionicons name="receipt-outline" size={16} color={C.texto2} />
          <Text style={s.franjaTxt}>
            {contexto.compras ? `${contexto.compras} ${contexto.compras === 1 ? 'compra' : 'compras'} entregadas` : 'Todavía no te compró'}
          </Text>
        </View>
      );
    } else {
      franja = contexto.proximoTurno ? (
        <View style={s.franja}>
          <Ionicons name="calendar-outline" size={16} color={C.teal} />
          <Text style={s.franjaTxt} numberOfLines={1}>
            {contexto.proximoTurno.mascota.nombre} · {contexto.proximoTurno.servicio} · {cuandoTexto(contexto.proximoTurno.fecha)}
          </Text>
          <EstadoChip estado={contexto.proximoTurno.estado} />
        </View>
      ) : (
        <View style={s.franja}>
          <Ionicons name="paw-outline" size={16} color={C.texto2} />
          <Text style={s.franjaTxt} numberOfLines={1}>
            {contexto.mascotas?.length ? contexto.mascotas.map((m) => m.nombre).join(', ') : 'Sin turnos todavía'}
            {contexto.visitas ? ` · ${contexto.visitas} ${contexto.visitas === 1 ? 'visita' : 'visitas'}` : ''}
          </Text>
        </View>
      );
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.volver} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={26} color={C.teal} />
        </TouchableOpacity>
        <Avatar uri={contexto?.dueno?.foto} nombre={nombreCliente} size={42} borde />
        <View style={{ flex: 1 }}>
          <Text style={s.titulo} numberOfLines={1}>{nombreCliente}</Text>
          <Text style={s.sub} numberOfLines={1}>Cliente de {negocio?.nombre ?? cfg.label}</Text>
        </View>
      </View>
      {franja}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={s.lista}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {mensajes === null ? (
            <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
          ) : mensajes.length === 0 ? (
            <View style={s.vacio}>
              <Ionicons name="chatbubbles-outline" size={36} color={C.teal} />
              <Text style={s.vacioTxt}>Escribile a {nombreCliente}. Abajo tenés respuestas rápidas para tu {cfg.label.toLowerCase()}.</Text>
            </View>
          ) : mensajes.map((m, i) => {
            const yo = m.autor === 'yo';
            const nuevoDia = i === 0 || !mismoDia(mensajes[i - 1].fecha, m.fecha);
            return (
              <Fragment key={m.id}>
                {nuevoDia && <Text style={s.dia}>{etiquetaDia(m.fecha)}</Text>}
                <View style={[s.burbuja, yo ? s.burbujaYo : s.burbujaOtro]}>
                  <Text style={s.burbujaTxt}>{m.texto}</Text>
                  <Text style={s.hora}>{horaCorta(m.fecha)}</Text>
                </View>
              </Fragment>
            );
          })}
        </ScrollView>

        {error ? <Text style={s.error}>{error}</Text> : null}
        {rapidas.length > 0 && (
          // En web un ScrollView horizontal sin alto fijo se estira: va dentro de una franja de alto fijo.
          <View style={s.rapidasFranja}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.rapidasScroll}
              contentContainerStyle={s.rapidas} keyboardShouldPersistTaps="handled">
              {rapidas.map((r) => (
                <TouchableOpacity key={r} style={s.rapida} onPress={() => enviar(r)} disabled={enviando || !negocio}>
                  <Text style={s.rapidaTxt} numberOfLines={1}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={texto}
            onChangeText={setTexto}
            placeholder={`Escribile a ${nombreCliente.split(' ')[0]}…`}
            placeholderTextColor={C.gris}
            multiline
            maxLength={2000}
            onSubmitEditing={() => enviar()}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[s.enviar, (!texto.trim() || enviando) && { opacity: 0.5 }]}
            onPress={() => enviar()}
            disabled={!texto.trim() || enviando}
            accessibilityLabel="Enviar"
          >
            <Ionicons name="send" size={20} color={C.texto} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fondo },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF',
    paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  volver: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 16, fontWeight: '800', color: C.texto },
  sub: { fontSize: 12, color: C.teal, fontWeight: '600', marginTop: 1 },

  franja: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#F2FCF6', borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  franjaTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: C.texto },

  lista: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  vacio: { alignItems: 'center', gap: 8, marginTop: 40, paddingHorizontal: 30 },
  vacioTxt: { fontSize: 14, color: C.texto2, textAlign: 'center' },
  dia: { alignSelf: 'center', fontSize: 12, color: C.texto2, fontWeight: '700', marginVertical: 10 },

  burbuja: { maxWidth: '80%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 6 },
  burbujaYo: { alignSelf: 'flex-end', backgroundColor: C.burbujaYo, borderBottomRightRadius: 6 },
  burbujaOtro: {
    alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderBottomLeftRadius: 6,
    borderWidth: 1, borderColor: '#EAEAEA',
  },
  burbujaTxt: { fontSize: 15, color: C.texto, lineHeight: 20 },
  hora: { fontSize: 10, color: C.texto2, alignSelf: 'flex-end', marginTop: 2 },
  error: { fontSize: 13, color: C.rojo, textAlign: 'center', paddingVertical: 4 },

  rapidasFranja: { height: 48, flexGrow: 0, flexShrink: 0 },
  rapidasScroll: { flexGrow: 0 },
  rapidas: { paddingHorizontal: 12, alignItems: 'center', gap: 8, height: 48 },
  rapida: {
    height: 36, justifyContent: 'center', alignSelf: 'center',
    borderWidth: 1.5, borderColor: C.teal, borderRadius: 18, paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  rapidaTxt: { fontSize: 13, fontWeight: '700', color: C.teal },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: C.borde,
  },
  input: {
    flex: 1, minHeight: 46, maxHeight: 110, borderRadius: 23, backgroundColor: C.fondo,
    borderWidth: 1, borderColor: '#E3E3E3', paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: C.texto,
  },
  enviar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: C.amarillo,
    alignItems: 'center', justifyContent: 'center',
  },
});
