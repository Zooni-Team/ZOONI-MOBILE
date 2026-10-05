/**
 * PagoFormModal.jsx — Anotar (o corregir) un pago de un dueño
 *
 * Monto con atajos ("Todo lo que debe" / la mitad), medio de pago, fecha y
 * una nota opcional. Si se abre con `pago`, es para editarlo y además se puede
 * borrar. El medio arranca en el que eligió el dueño al pedir los paseos.
 *
 * Props: visible · dueno · saldo · medioSugerido · pago (opcional) ·
 *        onGuardar({ monto, medio, fecha, nota }) · onBorrar() · onCerrar
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C, PillButton } from './PaseadorUI';
import FechaPicker from '../FechaPicker';
import { MEDIOS_PAGO, formatoPlata } from '../../services/paseadorApi';
import { sanitizarDigitos } from '../../utils/sanitizar';
import { confirmar } from '../../utils/dialogo';

const fechaCorta = (d) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

export default function PagoFormModal({
  visible, dueno, saldo = 0, medioSugerido, pago, onGuardar, onBorrar, onCerrar,
}) {
  const [monto, setMonto] = useState('');
  const [medio, setMedio] = useState(null);
  const [fecha, setFecha] = useState(new Date());
  const [nota, setNota] = useState('');
  const [verFecha, setVerFecha] = useState(false);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMonto(pago ? String(Math.round(pago.monto)) : (saldo > 0 ? String(Math.round(saldo)) : ''));
    setMedio(pago?.medio ?? medioSugerido ?? null);
    setFecha(pago ? new Date(pago.fecha) : new Date());
    setNota(pago?.nota ?? '');
    setError(null);
  }, [visible, pago, saldo, medioSugerido]);

  const guardar = async () => {
    if (!(Number(monto) > 0)) { setError('Es necesario el monto que te pagó'); return; }
    if (!medio) { setError('Es necesario elegir con qué medio te pagó'); return; }
    setGuardando(true);
    try {
      await onGuardar({ monto: Number(monto), medio, fecha, nota });
    } catch {
      setError('No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    const ok = await confirmar('¿Borrar este pago?', `${formatoPlata(pago.monto)} del ${fechaCorta(new Date(pago.fecha))}. Vuelve a figurar como deuda.`,
      { textoOk: 'Borrar', destructivo: true });
    if (ok) onBorrar();
  };

  const parcial = Number(monto) > 0 && saldo > 0 && Number(monto) < saldo;
  const deMas = Number(monto) > 0 && !pago && Number(monto) > saldo;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.overlay} onPress={onCerrar} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.titulo}>{pago ? 'Editar pago' : 'Registrar pago'}</Text>
          <Text style={s.sub}>
            {dueno?.nombre}{saldo > 0 ? ` · te debe ${formatoPlata(saldo)}` : ' · está al día'}
          </Text>

          <Text style={s.label}>¿Cuánto te pagó?</Text>
          <View style={[s.montoBox, error && !(Number(monto) > 0) && { borderColor: C.rojo }]}>
            <Text style={s.signo}>$</Text>
            <TextInput style={s.montoInput} value={monto} keyboardType="number-pad" placeholder="0"
              placeholderTextColor="#C8C8C8" onChangeText={(v) => { setMonto(sanitizarDigitos(v, 8)); setError(null); }} />
          </View>
          {!pago && saldo > 0 && (
            <View style={s.atajos}>
              <TouchableOpacity style={s.atajo} onPress={() => setMonto(String(Math.round(saldo)))}>
                <Text style={s.atajoTxt}>Todo ({formatoPlata(saldo)})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.atajo} onPress={() => setMonto(String(Math.round(saldo / 2)))}>
                <Text style={s.atajoTxt}>La mitad</Text>
              </TouchableOpacity>
            </View>
          )}
          {parcial && <Text style={s.ayuda}>Pago parcial: va a quedar debiendo {formatoPlata(saldo - Number(monto))}.</Text>}
          {deMas && <Text style={s.ayuda}>Te paga {formatoPlata(Number(monto) - Math.max(0, saldo))} de más: le queda a favor.</Text>}

          <Text style={s.label}>¿Con qué te pagó?</Text>
          <View style={s.medios}>
            {MEDIOS_PAGO.map((m) => {
              const on = medio === m.key;
              return (
                <TouchableOpacity key={m.key} style={[s.medio, on && s.medioOn]} onPress={() => { setMedio(m.key); setError(null); }}
                  accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Ionicons name={m.icono} size={16} color={on ? '#FFF' : C.teal} />
                  <Text style={[s.medioTxt, on && { color: '#FFF' }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.label}>Fecha</Text>
          <TouchableOpacity style={s.fecha} onPress={() => setVerFecha(true)}>
            <Ionicons name="calendar-outline" size={18} color={C.teal} />
            <Text style={s.fechaTxt}>{fechaCorta(fecha)}</Text>
          </TouchableOpacity>

          <Text style={s.label}>Nota (opcional)</Text>
          <TextInput style={s.nota} value={nota} onChangeText={setNota} maxLength={300}
            placeholder="Ej: pagó los paseos de la semana" placeholderTextColor={C.gris} />

          {error ? <Text style={s.error}>{error}</Text> : null}
          <PillButton titulo={pago ? 'Guardar cambios' : 'Registrar pago'} onPress={guardar} cargando={guardando} style={{ marginTop: 16 }} />
          {pago && (
            <TouchableOpacity style={s.borrar} onPress={borrar}>
              <Ionicons name="trash-outline" size={16} color={C.rojo} />
              <Text style={s.borrarTxt}>Borrar pago</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
      <FechaPicker visible={verFecha} titulo="Fecha del pago" valor={fecha} aniosAtras={3} sinFuturo
        onConfirmar={(d) => { setFecha(d); setVerFecha(false); }} onCancelar={() => setVerFecha(false)} />
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30,
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 14 },
  titulo: { fontSize: 20, fontWeight: '900', color: C.texto },
  sub: { fontSize: 13, color: C.texto2, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '700', color: C.texto, marginTop: 16, marginBottom: 8 },

  montoBox: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 14,
    paddingHorizontal: 14, backgroundColor: C.fondo,
  },
  signo: { fontSize: 26, fontWeight: '900', color: C.texto, marginRight: 4 },
  montoInput: { flex: 1, fontSize: 28, fontWeight: '900', color: C.texto, paddingVertical: 10, minWidth: 0 },
  atajos: { flexDirection: 'row', gap: 8, marginTop: 8 },
  atajo: { borderRadius: 16, borderWidth: 1.5, borderColor: C.teal, paddingHorizontal: 12, paddingVertical: 6 },
  atajoTxt: { fontSize: 13, fontWeight: '800', color: C.teal },
  ayuda: { fontSize: 12, color: C.texto2, marginTop: 6 },

  medios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  medio: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1.5, borderColor: C.menta,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF',
  },
  medioOn: { backgroundColor: C.teal, borderColor: C.teal },
  medioTxt: { fontSize: 13, fontWeight: '700', color: C.texto },

  fecha: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#DDDDDD',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  fechaTxt: { fontSize: 15, color: C.texto, fontWeight: '600' },
  nota: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: C.texto,
  },
  error: { fontSize: 13, color: C.rojo, marginTop: 12, textAlign: 'center' },
  borrar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  borrarTxt: { fontSize: 14, fontWeight: '800', color: C.rojo },
});
