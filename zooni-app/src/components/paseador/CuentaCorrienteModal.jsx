/**
 * CuentaCorrienteModal.jsx — La cuenta corriente con UN dueño
 *
 * Arriba el saldo (cuánto te debe, al día o a favor) y "Registrar pago".
 * Abajo todos los movimientos, del más nuevo al más viejo, como un extracto:
 *   · Paseo  → suma a lo que debe; dice si quedó pagado, parcial o pendiente
 *   · Pago   → resta; tocarlo permite corregirlo o borrarlo
 * con el saldo que quedaba después de cada movimiento.
 *
 * Props: visible · cuenta (de fetchCuentasCorrientes) · onCerrar ·
 *        onRegistrar(pago) · onEditar(pago) — ambos abren PagoFormModal
 *        children — el formulario de pago va adentro de este Modal (en iOS no
 *        se puede abrir un Modal hermano mientras otro está abierto)
 */

import { useMemo } from 'react';
import {
  FlatList, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, PillButton } from './PaseadorUI';
import { formatoPlata, medioDePago } from '../../services/paseadorApi';

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' });

const ESTADO_PASEO = {
  pagado: { txt: 'Pagado', color: C.teal, fondo: C.menta },
  parcial: { txt: 'Parcial', color: '#B07A00', fondo: '#FFF1DC' },
  pendiente: { txt: 'Pendiente', color: C.rojo, fondo: '#FDECEE' },
};

export function EtiquetaSaldo({ saldo, grande = false }) {
  const est = saldo > 0
    ? { txt: grande ? 'Te debe' : `Debe ${formatoPlata(saldo)}`, color: C.rojo, fondo: '#FDECEE', icono: 'alert-circle' }
    : saldo < 0
      ? { txt: grande ? 'Tiene a favor' : `A favor ${formatoPlata(-saldo)}`, color: '#2B6CB0', fondo: '#E6F0FA', icono: 'arrow-undo-circle' }
      : { txt: 'Al día', color: C.teal, fondo: C.menta, icono: 'checkmark-circle' };
  return (
    <View style={[s.etiqueta, { backgroundColor: est.fondo }]}>
      <Ionicons name={est.icono} size={13} color={est.color} />
      <Text style={[s.etiquetaTxt, { color: est.color }]}>{est.txt}</Text>
    </View>
  );
}

export default function CuentaCorrienteModal({
  visible, cuenta, onCerrar, onRegistrar, onEditar, children,
}) {
  // Extracto: paseos (+) y pagos (-) mezclados por fecha, con saldo acumulado
  const movimientos = useMemo(() => {
    if (!cuenta) return [];
    const todos = [
      ...cuenta.paseos.map((p) => ({ tipo: 'paseo', fecha: p.fecha, importe: p.precio, paseo: p, key: `p${p.id}` })),
      ...cuenta.pagos.map((pg) => ({ tipo: 'pago', fecha: pg.fecha, importe: -pg.monto, pago: pg, key: `g${pg.id}` })),
    ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || (a.tipo === 'paseo' ? -1 : 1));
    let acumulado = 0;
    todos.forEach((m) => { acumulado += m.importe; m.saldo = acumulado; });
    return todos.reverse();
  }, [cuenta]);

  if (!cuenta) return null;
  const medio = medioDePago(cuenta.medioPreferido);

  const cabecera = (
    <View>
      <View style={s.perfil}>
        <Avatar uri={cuenta.dueno.foto} nombre={cuenta.dueno.nombre} size={56} borde />
        <View style={{ flex: 1 }}>
          <Text style={s.nombre}>{cuenta.dueno.nombre}</Text>
          <Text style={s.sub} numberOfLines={1}>{cuenta.mascotas.join(', ')}</Text>
          {medio ? (
            <View style={s.medioFila}>
              <Ionicons name={medio.icono} size={13} color={C.teal} />
              <Text style={s.medioTxt}>Paga con {medio.label}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[s.saldoCard, cuenta.saldo > 0 ? s.saldoDebe : s.saldoOk]}>
        <EtiquetaSaldo saldo={cuenta.saldo} grande />
        <Text style={s.saldo}>{formatoPlata(Math.abs(cuenta.saldo))}</Text>
        <View style={s.totales}>
          <View style={{ flex: 1 }}>
            <Text style={s.totalLabel}>Paseos</Text>
            <Text style={s.totalValor}>{formatoPlata(cuenta.totalCargos)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.totalLabel}>Pagó</Text>
            <Text style={s.totalValor}>{formatoPlata(cuenta.totalPagado)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.totalLabel}>Sin pagar</Text>
            <Text style={s.totalValor}>{cuenta.pendientes} {cuenta.pendientes === 1 ? 'paseo' : 'paseos'}</Text>
          </View>
        </View>
      </View>

      <PillButton titulo="Registrar pago" icono="add-circle" onPress={() => onRegistrar(null)} style={{ marginTop: 14 }} />
      <Text style={s.seccion}>Movimientos</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCerrar} style={s.volver} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={C.teal} />
          </TouchableOpacity>
          <Text style={s.titulo}>Cuenta corriente</Text>
        </View>
        <FlatList
          data={movimientos}
          keyExtractor={(m) => m.key}
          ListHeaderComponent={cabecera}
          contentContainerStyle={s.lista}
          ListEmptyComponent={<Text style={s.vacio}>Todavía no hay movimientos.</Text>}
          renderItem={({ item: m }) => {
            if (m.tipo === 'paseo') {
              const p = m.paseo;
              const est = ESTADO_PASEO[p.estado];
              const mp = medioDePago(p.medioPago);
              return (
                <View style={s.mov}>
                  <View style={[s.movIcono, { backgroundColor: C.menta }]}>
                    <Ionicons name="walk" size={18} color={C.teal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.movTitulo}>Paseo con {p.mascota.nombre}</Text>
                    <Text style={s.movSub}>
                      {fechaCorta(p.fecha)} · {p.duracionMin} min{mp ? ` · ${mp.label}` : ''}
                    </Text>
                    <View style={[s.estado, { backgroundColor: est.fondo }]}>
                      <Text style={[s.estadoTxt, { color: est.color }]}>
                        {est.txt}{p.estado === 'parcial' ? ` · falta ${formatoPlata(p.falta)}` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.cargo}>+{formatoPlata(p.precio)}</Text>
                    <Text style={s.saldoMov}>Saldo {formatoPlata(m.saldo)}</Text>
                  </View>
                </View>
              );
            }
            const pg = m.pago;
            const mp = medioDePago(pg.medio);
            return (
              <TouchableOpacity style={s.mov} onPress={() => onEditar(pg)} activeOpacity={0.8}
                accessibilityRole="button" accessibilityLabel="Editar pago">
                <View style={[s.movIcono, { backgroundColor: '#E6F0FA' }]}>
                  <Ionicons name={mp?.icono ?? 'cash-outline'} size={18} color="#2B6CB0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.movTitulo}>Pago · {mp?.label ?? pg.medio}</Text>
                  <Text style={s.movSub}>{fechaCorta(pg.fecha)}{pg.nota ? ` · ${pg.nota}` : ''}</Text>
                  <Text style={s.editar}>Tocá para modificar</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.abono}>−{formatoPlata(pg.monto)}</Text>
                  <Text style={s.saldoMov}>Saldo {formatoPlata(m.saldo)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
        {children}
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
  titulo: { fontSize: 19, fontWeight: '800', color: C.texto },
  lista: { padding: 20, paddingBottom: 40 },
  vacio: { fontSize: 14, color: C.texto2, textAlign: 'center', marginTop: 10 },

  perfil: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nombre: { fontSize: 21, fontWeight: '900', color: C.texto },
  sub: { fontSize: 13, color: C.texto2, marginTop: 2 },
  medioFila: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  medioTxt: { fontSize: 12, fontWeight: '700', color: C.teal },

  saldoCard: { borderRadius: 20, padding: 18, marginTop: 16 },
  saldoDebe: { backgroundColor: '#FFF4F5' },
  saldoOk: { backgroundColor: C.menta },
  saldo: { fontSize: 40, fontWeight: '900', color: C.texto, marginTop: 6 },
  totales: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  totalLabel: { fontSize: 12, color: C.texto2, fontWeight: '600' },
  totalValor: { fontSize: 15, color: C.texto, fontWeight: '800', marginTop: 2 },

  etiqueta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4,
  },
  etiquetaTxt: { fontSize: 12, fontWeight: '800' },

  seccion: { fontSize: 16, fontWeight: '900', color: C.texto, marginTop: 22, marginBottom: 10 },
  mov: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0',
  },
  movIcono: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  movTitulo: { fontSize: 14, fontWeight: '800', color: C.texto },
  movSub: { fontSize: 12, color: C.texto2, marginTop: 1 },
  estado: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 5 },
  estadoTxt: { fontSize: 11, fontWeight: '800' },
  editar: { fontSize: 11, color: C.gris, marginTop: 3 },
  cargo: { fontSize: 15, fontWeight: '900', color: C.texto },
  abono: { fontSize: 15, fontWeight: '900', color: '#2B6CB0' },
  saldoMov: { fontSize: 11, color: C.texto2, marginTop: 2 },
});
