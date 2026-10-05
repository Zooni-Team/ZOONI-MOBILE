/**
 * PaseadorDisponibilidadScreen.jsx — Horarios y zonas de trabajo
 *
 * Se abre desde Perfil. Define en qué días/horarios trabaja el paseador, el
 * radio que está dispuesto a moverse y los barrios donde pasea. Se guarda
 * todo junto con "Guardar" (no hay autosave: son decisiones de trabajo y es
 * mejor confirmarlas).
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, SafeAreaView, ScrollView, StatusBar, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { C, Card, PillButton, Seccion } from '../../components/paseador/PaseadorUI';
import HoraPicker from '../../components/HoraPicker';
import ZonaMapaPicker from '../../components/paseador/ZonaMapaPicker';
import {
  DIAS, actualizarPerfilPaseador, fetchPerfilPaseador,
} from '../../services/paseadorApi';
import { alerta } from '../../utils/dialogo';

function aDate(hhmm) {
  const [h, m] = (hhmm ?? '08:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
const aHHMM = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function PaseadorDisponibilidadScreen() {
  const navigation = useNavigation();
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [horarios, setHorarios] = useState({});
  const [radioKm, setRadioKm] = useState(3);
  const [zona, setZona] = useState('');
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [zonas, setZonas] = useState([]);
  const [nuevaZona, setNuevaZona] = useState('');
  const [picker, setPicker] = useState(null); // { dia, campo }

  useEffect(() => {
    fetchPerfilPaseador().then((p) => {
      if (p) {
        setHorarios(p.horarios);
        setRadioKm(p.radioKm);
        setZona(p.zona);
        setCoords({ lat: p.lat, lng: p.lng });
        setZonas(p.zonas ?? []);
      }
      setCargando(false);
    }).catch(() => setCargando(false));
  }, []);

  const setDia = (dia, cambios) => setHorarios((h) => ({ ...h, [dia]: { ...h[dia], ...cambios } }));

  const agregarZona = () => {
    const z = nuevaZona.trim();
    if (z.length < 3) return;
    const existe = [zona, ...zonas].some((x) => x?.toLowerCase() === z.toLowerCase());
    if (!existe) setZonas((zs) => [...zs, z].slice(0, 8));
    setNuevaZona('');
  };

  const guardar = async () => {
    const invalido = DIAS.find(({ key }) => horarios[key]?.activo && horarios[key].desde >= horarios[key].hasta);
    if (invalido) {
      alerta('Revisá los horarios', `El ${invalido.label.toLowerCase()} termina antes de empezar.`);
      return;
    }
    if (coords.lat == null) {
      alerta('Falta tu zona', 'Marcá en el mapa dónde paseás.');
      return;
    }
    if (radioKm == null) {
      alerta('Falta tu radio', 'Escribí hasta cuántos kilómetros vas a buscar perros.');
      return;
    }
    setGuardando(true);
    try {
      await actualizarPerfilPaseador({
        horarios, radioKm, zona: zona.trim() || 'Mi zona', zonas, lat: coords.lat, lng: coords.lng,
      });
      navigation.goBack();
    } catch {
      alerta('No se pudo guardar', 'Revisá tu conexión e intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const diasActivos = DIAS.filter(({ key }) => horarios[key]?.activo).length;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.volver} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={26} color={C.teal} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Horarios y zonas</Text>
          <Text style={s.sub}>Te llegan solicitudes sólo dentro de esto</Text>
        </View>
      </View>

      {cargando ? (
        <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Seccion titulo={`Días y horarios · ${diasActivos} activos`} />
          <Card style={{ paddingVertical: 6 }}>
            {DIAS.map(({ key, label }, i) => {
              const d = horarios[key] ?? { activo: false, desde: '08:00', hasta: '19:00' };
              return (
                <View key={key} style={[s.dia, i > 0 && s.diaBorde]}>
                  <Switch
                    value={d.activo}
                    onValueChange={(v) => setDia(key, { activo: v })}
                    trackColor={{ false: '#DDDDDD', true: C.teal }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel={`Trabajo los ${label}`}
                  />
                  <Text style={[s.diaLabel, !d.activo && { color: C.gris }]}>{label}</Text>
                  {d.activo ? (
                    <View style={s.horas}>
                      <TouchableOpacity style={s.hora} onPress={() => setPicker({ dia: key, campo: 'desde' })}>
                        <Text style={s.horaTxt}>{d.desde}</Text>
                      </TouchableOpacity>
                      <Text style={s.guion}>–</Text>
                      <TouchableOpacity style={s.hora} onPress={() => setPicker({ dia: key, campo: 'hasta' })}>
                        <Text style={s.horaTxt}>{d.hasta}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={s.libre}>Libre</Text>
                  )}
                </View>
              );
            })}
          </Card>

          <Seccion titulo="Zona de atención" />
          <Card>
            <ZonaMapaPicker
              valor={{ ...coords, radioKm, zona }}
              onCambio={(z) => {
                setCoords({ lat: z.lat, lng: z.lng });
                setRadioKm(z.radioKm);
                setZona(z.zona ?? '');
              }}
            />
          </Card>

          <Seccion titulo="Otros barrios" />
          <Card>
            <Text style={s.label}>También paseo en</Text>
            <View style={s.zonas}>
              {zonas.map((z) => (
                <View key={z} style={s.zonaChip}>
                  <Text style={s.zonaTxt}>{z}</Text>
                  <TouchableOpacity onPress={() => setZonas((zs) => zs.filter((x) => x !== z))} hitSlop={8}
                    accessibilityLabel={`Quitar ${z}`}>
                    <Ionicons name="close-circle" size={18} color={C.teal} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={s.agregarRow}>
              <TextInput style={[s.input, { flex: 1 }]} value={nuevaZona} onChangeText={(v) => setNuevaZona(v.slice(0, 80))}
                placeholder="Agregar barrio" placeholderTextColor={C.gris} onSubmitEditing={agregarZona} returnKeyType="done" />
              <TouchableOpacity style={s.agregar} onPress={agregarZona} accessibilityLabel="Agregar barrio">
                <Ionicons name="add" size={24} color={C.texto} />
              </TouchableOpacity>
            </View>
          </Card>

          <PillButton titulo="Guardar" onPress={guardar} cargando={guardando} style={{ marginTop: 24 }} />
        </ScrollView>
      )}

      <HoraPicker
        visible={!!picker}
        titulo={picker?.campo === 'desde' ? 'Empiezo a las' : 'Termino a las'}
        valor={picker ? aDate(horarios[picker.dia]?.[picker.campo]) : null}
        onCancelar={() => setPicker(null)}
        onConfirmar={(d) => {
          setDia(picker.dia, { [picker.campo]: aHHMM(d) });
          setPicker(null);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fondo },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF',
    paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  volver: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 19, fontWeight: '800', color: C.texto },
  sub: { fontSize: 12, color: C.texto2, marginTop: 1 },
  scroll: { padding: 20, paddingTop: 0, paddingBottom: 40 },

  dia: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, minHeight: 56 },
  diaBorde: { borderTopWidth: 1, borderTopColor: '#F2F2F2' },
  diaLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: C.texto },
  horas: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hora: { backgroundColor: C.menta, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  horaTxt: { fontSize: 15, fontWeight: '800', color: C.texto, fontVariant: ['tabular-nums'] },
  guion: { color: C.texto2, fontWeight: '700' },
  libre: { fontSize: 14, color: C.gris, fontWeight: '600' },


  label: { fontSize: 13, fontWeight: '700', color: C.texto, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: C.texto, backgroundColor: '#FFFFFF',
  },
  zonas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  zonaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.menta,
    borderRadius: 20, paddingLeft: 12, paddingRight: 8, paddingVertical: 7,
  },
  zonaTxt: { fontSize: 14, fontWeight: '700', color: C.texto },
  agregarRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  agregar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.amarillo, alignItems: 'center', justifyContent: 'center' },
});
