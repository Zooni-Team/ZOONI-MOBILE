/**
 * PerfilTab.jsx — Tab 5 de Zooni Paseadores
 *
 *   · Rating, paseos y experiencia
 *   · Servicios ofrecidos (precios editables, tamaños, perros por paseo)
 *   · Reseñas de los dueños
 *   · Configuración de disponibilidad, cambiar a modo dueño, cerrar sesión
 */

import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, Card, Chip, PillButton, Seccion, Stat } from '../../../components/paseador/PaseadorUI';
import {
  actualizarPerfilPaseador, fetchResenas, formatoPlata,
} from '../../../services/paseadorApi';
import { clearCurrentUserId, getCurrentUserId, setModo, MODO_DUENO } from '../../../config/session';
import { supabase } from '../../../lib/supabase';
import { sanitizarDigitos } from '../../../utils/sanitizar';
import { confirmar } from '../../../utils/dialogo';
import { tiempoRelativo } from '../../../utils/tiempoRelativo';

const TAMANO_LABEL = { chico: 'Chicos', mediano: 'Medianos', grande: 'Grandes' };

function Estrellas({ valor, size = 14 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} size={size} color={C.amarillo}
          name={valor >= i ? 'star' : valor >= i - 0.5 ? 'star-half' : 'star-outline'} />
      ))}
    </View>
  );
}

function FilaMenu({ icono, titulo, sub, onPress, color = C.texto }) {
  return (
    <TouchableOpacity style={s.menuFila} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.menuIcono, color === C.rojo && { backgroundColor: '#FDECEE' }]}>
        <Ionicons name={icono} size={20} color={color === C.rojo ? C.rojo : C.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.menuTitulo, { color }]}>{titulo}</Text>
        {sub ? <Text style={s.menuSub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.gris} />
    </TouchableOpacity>
  );
}

export default function PerfilTab({ perfil, setPerfil, navigation, avisar }) {
  const [resenas, setResenas] = useState(null);
  const [tieneMascotas, setTieneMascotas] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    fetchResenas().then(setResenas).catch(() => setResenas({ promedio: null, cantidad: 0, totalPaseos: 0, resenas: [] }));
    const { data } = await supabase.from('Mascota').select('Id_Mascota').eq('Id_User', getCurrentUserId()).limit(1);
    setTieneMascotas((data?.length ?? 0) > 0);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (!perfil) return null;
  const nombre = `${perfil.nombre} ${perfil.apellido}`.trim();

  const abrirEditor = () => {
    setForm({
      precio30: String(perfil.precio30 || ''),
      precio60: String(perfil.precio60 || ''),
      maxPerros: perfil.maxPerros,
      bio: perfil.bio ?? '',
    });
    setEditando(true);
  };

  const guardar = async () => {
    if (!(Number(form.precio30) > 0) || !(Number(form.precio60) > 0)) {
      avisar('Es necesario un precio para 30 y para 60 minutos', 'alert-circle');
      return;
    }
    const cambios = {
      precio30: Number(form.precio30), precio60: Number(form.precio60),
      maxPerros: form.maxPerros, bio: form.bio.trim(),
    };
    setGuardando(true);
    try {
      await actualizarPerfilPaseador(cambios);
      setPerfil((p) => ({ ...p, ...cambios }));
      setEditando(false);
      avisar('Guardamos tus cambios');
    } catch {
      avisar('No se pudo guardar. Probá de nuevo.', 'alert-circle');
    } finally {
      setGuardando(false);
    }
  };

  const modoDueno = async () => {
    await setModo(MODO_DUENO);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const salir = async () => {
    const ok = await confirmar('¿Cerrar sesión?', 'Vas a dejar de recibir solicitudes en este dispositivo.', { textoOk: 'Cerrar sesión', destructivo: true });
    if (!ok) return;
    // Al salir deja de figurar disponible: nadie le asigna paseos con la app cerrada
    await actualizarPerfilPaseador({ disponible: false }).catch(() => {});
    await clearCurrentUserId();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const diasActivos = Object.values(perfil.horarios ?? {}).filter((d) => d.activo).length;

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      {/* ── Cabecera ───────────────────────────────────────────────── */}
      <View style={s.cabecera}>
        <Avatar uri={perfil.foto} nombre={nombre} size={76} borde />
        <View style={{ flex: 1 }}>
          <Text style={s.nombre}>{nombre || 'Paseador'}</Text>
          <View style={s.zonaRow}>
            <Ionicons name="location" size={14} color={C.teal} />
            <Text style={s.zona}>{perfil.zona || 'Sin zona'} · {perfil.radioKm} km</Text>
          </View>
          {perfil.verificado
            ? <Chip texto="Verificado" icono="shield-checkmark" style={{ marginTop: 6 }} />
            : <Chip texto="Verificación pendiente" icono="time-outline" color={C.texto2} fondo="#F1F1F1" style={{ marginTop: 6 }} />}
        </View>
      </View>

      <Card style={s.stats}>
        <View style={{ flex: 1 }}>
          <Text style={s.rating}>{resenas?.promedio ? resenas.promedio.toFixed(1).replace('.', ',') : '–'}</Text>
          {resenas?.promedio ? <Estrellas valor={resenas.promedio} /> : null}
          <Text style={s.statEtiqueta}>{resenas?.cantidad ?? 0} calificaciones</Text>
        </View>
        <View style={s.divisor} />
        <Stat valor={String(resenas?.totalPaseos ?? 0)} etiqueta="paseos hechos" />
        <View style={s.divisor} />
        <Stat valor={String(perfil.experienciaAnios)} etiqueta={perfil.experienciaAnios === 1 ? 'año de exp.' : 'años de exp.'} />
      </Card>

      {perfil.bio ? <Text style={s.bio}>{perfil.bio}</Text> : null}

      {/* ── Servicios ──────────────────────────────────────────────── */}
      <Seccion titulo="Servicios que ofrecés" accion="Editar" onAccion={abrirEditor} />
      <Card>
        {[{ dur: 30, precio: perfil.precio30 }, { dur: 60, precio: perfil.precio60 }].map((x, i) => (
          <View key={x.dur} style={[s.servicio, i > 0 && s.servicioBorde]}>
            <View style={s.servicioIcono}><Ionicons name="walk" size={20} color={C.teal} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.servicioTitulo}>Paseo de {x.dur} minutos</Text>
              <Text style={s.servicioSub}>Hasta {perfil.maxPerros} {perfil.maxPerros === 1 ? 'perro' : 'perros'} por salida</Text>
            </View>
            <Text style={s.servicioPrecio}>{formatoPlata(x.precio)}</Text>
          </View>
        ))}
        <View style={s.tamanos}>
          {(perfil.tamanos ?? []).map((t) => <Chip key={t} texto={TAMANO_LABEL[t] ?? t} icono="paw" />)}
        </View>
      </Card>

      {/* ── Reseñas ────────────────────────────────────────────────── */}
      <Seccion titulo="Reseñas" />
      {resenas?.resenas?.length ? (
        resenas.resenas.slice(0, 5).map((r) => (
          <Card key={r.id} style={{ marginBottom: 10 }}>
            <View style={s.resenaTop}>
              <Avatar fuente={r.mascota.visual} nombre={r.mascota.nombre} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={s.resenaNombre}>{r.dueno.nombre}</Text>
                <Text style={s.resenaSub}>Paseo con {r.mascota.nombre} · {tiempoRelativo(r.fecha)}</Text>
              </View>
              <Estrellas valor={r.rating} size={13} />
            </View>
            <Text style={s.resenaTxt}>{r.resena}</Text>
          </Card>
        ))
      ) : (
        <Card><Text style={s.sinResenas}>Todavía no tenés reseñas. Llegan cuando los dueños califican tus paseos.</Text></Card>
      )}

      {/* ── Configuración ──────────────────────────────────────────── */}
      <Seccion titulo="Configuración" />
      <Card style={{ paddingVertical: 4 }}>
        <FilaMenu icono="calendar" titulo="Horarios y zonas"
          sub={`${diasActivos} ${diasActivos === 1 ? 'día' : 'días'} activos · ${[perfil.zona, ...(perfil.zonas ?? [])].filter(Boolean).length} zonas`}
          onPress={() => navigation.navigate('PaseadorDisponibilidad')} />
        {tieneMascotas && (
          <FilaMenu icono="swap-horizontal" titulo="Cambiar a modo dueño" sub="Volver a Zooni con tus mascotas" onPress={modoDueno} />
        )}
        <FilaMenu icono="log-out-outline" titulo="Cerrar sesión" color={C.rojo} onPress={salir} />
      </Card>

      {/* ── Editor de servicios ────────────────────────────────────── */}
      <Modal visible={editando} transparent animationType="slide" onRequestClose={() => setEditando(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={s.overlay} onPress={() => setEditando(false)} />
          {form && (
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitulo}>Editar servicios</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[['precio30', '30 minutos'], ['precio60', '60 minutos']].map(([k, label]) => (
                  <View key={k} style={s.precioBox}>
                    <Text style={s.precioLabel}>{label}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={s.precioSigno}>$</Text>
                      <TextInput style={s.precioInput} keyboardType="number-pad" value={form[k]}
                        onChangeText={(v) => setForm((f) => ({ ...f, [k]: sanitizarDigitos(v, 7) }))} />
                    </View>
                  </View>
                ))}
              </View>
              <Text style={s.sheetLabel}>Perros por paseo</Text>
              <View style={s.stepper}>
                <TouchableOpacity style={s.stepBtn} onPress={() => setForm((f) => ({ ...f, maxPerros: Math.max(1, f.maxPerros - 1) }))} accessibilityLabel="Uno menos">
                  <Ionicons name="remove" size={22} color={C.teal} />
                </TouchableOpacity>
                <Text style={s.stepValor}>{form.maxPerros}</Text>
                <TouchableOpacity style={s.stepBtn} onPress={() => setForm((f) => ({ ...f, maxPerros: Math.min(6, f.maxPerros + 1) }))} accessibilityLabel="Uno más">
                  <Ionicons name="add" size={22} color={C.teal} />
                </TouchableOpacity>
              </View>
              <Text style={s.sheetLabel}>Sobre vos</Text>
              <TextInput style={s.bioInput} multiline maxLength={500} value={form.bio}
                onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))} />
              <PillButton titulo="Guardar" onPress={guardar} cargando={guardando} style={{ marginTop: 16 }} />
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 32 },

  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  nombre: { fontSize: 22, fontWeight: '900', color: C.texto },
  zonaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  zona: { fontSize: 13, color: C.texto2, fontWeight: '600' },

  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  rating: { fontSize: 30, fontWeight: '900', color: C.texto },
  statEtiqueta: { fontSize: 12, color: C.texto2, fontWeight: '600', marginTop: 2 },
  divisor: { width: 1, alignSelf: 'stretch', backgroundColor: '#F0F0F0', marginHorizontal: 12 },
  bio: { fontSize: 14, color: C.texto, lineHeight: 20, marginTop: 14 },

  servicio: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  servicioBorde: { borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  servicioIcono: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.menta, alignItems: 'center', justifyContent: 'center' },
  servicioTitulo: { fontSize: 15, fontWeight: '800', color: C.texto },
  servicioSub: { fontSize: 12, color: C.texto2, marginTop: 1 },
  servicioPrecio: { fontSize: 20, fontWeight: '900', color: C.texto },
  tamanos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },

  resenaTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resenaNombre: { fontSize: 14, fontWeight: '800', color: C.texto },
  resenaSub: { fontSize: 12, color: C.texto2 },
  resenaTxt: { fontSize: 14, color: C.texto, marginTop: 10, lineHeight: 20 },
  sinResenas: { fontSize: 14, color: C.texto2, lineHeight: 20 },

  menuFila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  menuIcono: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.menta, alignItems: 'center', justifyContent: 'center' },
  menuTitulo: { fontSize: 15, fontWeight: '700' },
  menuSub: { fontSize: 12, color: C.texto2, marginTop: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 30,
  },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 14 },
  sheetTitulo: { fontSize: 19, fontWeight: '900', color: C.texto, marginBottom: 14 },
  sheetLabel: { fontSize: 13, fontWeight: '700', color: C.texto, marginTop: 16, marginBottom: 8 },
  precioBox: { flex: 1, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 14, padding: 12, backgroundColor: C.fondo },
  precioLabel: { fontSize: 12, fontWeight: '700', color: C.teal },
  precioSigno: { fontSize: 22, fontWeight: '900', color: C.texto, marginRight: 2 },
  precioInput: { flex: 1, fontSize: 22, fontWeight: '900', color: C.texto, paddingVertical: 2, minWidth: 0 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  stepValor: { fontSize: 26, fontWeight: '900', color: C.texto, minWidth: 30, textAlign: 'center' },
  bioInput: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12, padding: 12, minHeight: 80,
    fontSize: 14, color: C.texto, textAlignVertical: 'top',
  },
});
