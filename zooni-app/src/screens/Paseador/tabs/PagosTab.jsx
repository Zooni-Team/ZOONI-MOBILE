/**
 * PagosTab.jsx — Sección "Pagos" de Zooni Paseadores (cuenta corriente)
 *
 *   · Arriba: cuánto te deben en total y cuántos clientes deben
 *   · Filtro: Todos / Deben / Al día
 *   · Una fila por dueño con su saldo (Debe $X / Al día / A favor) y con qué
 *     medio paga. Tocarla abre su cuenta corriente (CuentaCorrienteModal),
 *     donde se anotan, corrigen o borran los pagos (PagoFormModal).
 *
 * Los paseos finalizados suman a lo que debe cada dueño; los pagos que anota
 * el paseador restan. Ver fetchCuentasCorrientes en services/paseadorApi.js.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, Vacio } from '../../../components/paseador/PaseadorUI';
import CuentaCorrienteModal, { EtiquetaSaldo } from '../../../components/paseador/CuentaCorrienteModal';
import PagoFormModal from '../../../components/paseador/PagoFormModal';
import {
  borrarPago, editarPago, fetchCuentasCorrientes, formatoPlata, medioDePago, registrarPago,
} from '../../../services/paseadorApi';

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'deben', label: 'Deben' },
  { key: 'aldia', label: 'Al día' },
];

export default function PagosTab({ avisar }) {
  const [cuentas, setCuentas] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [refrescando, setRefrescando] = useState(false);
  const [abierta, setAbierta] = useState(null); // idDueno de la cuenta abierta
  // Formulario de pago: { pago } (null = nuevo) — undefined = cerrado
  const [form, setForm] = useState(undefined);

  const cargar = useCallback(async () => {
    try {
      setCuentas(await fetchCuentasCorrientes());
      setError(null);
    } catch (err) {
      setCuentas((c) => c ?? []);
      setError(err?.message === 'migracion_pendiente'
        ? 'Para usar Pagos es necesario correr la migración 044 en Supabase.'
        : 'No se pudieron cargar los pagos. Deslizá hacia abajo para reintentar.');
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const cuenta = cuentas?.find((c) => c.idDueno === abierta) ?? null;

  const resumen = useMemo(() => {
    const lista = cuentas ?? [];
    const deudores = lista.filter((c) => c.saldo > 0);
    return {
      teDeben: deudores.reduce((a, c) => a + c.saldo, 0),
      deudores: deudores.length,
      cobrado: lista.reduce((a, c) => a + c.totalPagado, 0),
      alDia: lista.length - deudores.length,
    };
  }, [cuentas]);

  const visibles = (cuentas ?? []).filter((c) => (
    filtro === 'deben' ? c.saldo > 0 : filtro === 'aldia' ? c.saldo <= 0 : true
  ));

  const guardarPago = async (datos) => {
    if (form?.pago) {
      await editarPago(form.pago.id, { ...datos, idDueno: cuenta.idDueno });
      avisar?.('Pago modificado');
    } else {
      await registrarPago({ ...datos, idDueno: cuenta.idDueno });
      avisar?.(datos.monto >= cuenta.saldo ? `${cuenta.dueno.nombre} quedó al día` : 'Pago parcial registrado');
    }
    setForm(undefined);
    await cargar();
  };

  const borrar = async () => {
    try {
      await borrarPago(form.pago.id);
      setForm(undefined);
      avisar?.('Pago borrado');
      await cargar();
    } catch {
      avisar?.('No se pudo borrar. Probá de nuevo.', 'alert-circle');
    }
  };

  const cabecera = (
    <View>
      <View style={s.hero}>
        <Text style={s.heroLabel}>Te deben</Text>
        <Text style={s.heroValor} numberOfLines={1} adjustsFontSizeToFit>{formatoPlata(resumen.teDeben)}</Text>
        <View style={s.heroFila}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroNum}>{resumen.deudores}</Text>
            <Text style={s.heroTxt}>{resumen.deudores === 1 ? 'cliente debe' : 'clientes deben'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroNum}>{resumen.alDia}</Text>
            <Text style={s.heroTxt}>al día</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroNum}>{formatoPlata(resumen.cobrado)}</Text>
            <Text style={s.heroTxt}>cobrado</Text>
          </View>
        </View>
      </View>

      {error ? (
        <View style={s.aviso}>
          <Ionicons name="warning" size={16} color={C.ambar} />
          <Text style={s.avisoTxt}>{error}</Text>
        </View>
      ) : null}

      <View style={s.segmento}>
        {FILTROS.map((f) => {
          const on = filtro === f.key;
          return (
            <TouchableOpacity key={f.key} style={[s.segBtn, on && s.segBtnOn]} onPress={() => setFiltro(f.key)}
              accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={[s.segTxt, on && s.segTxtOn]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  if (cuentas === null) {
    return <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />;
  }

  return (
    <>
      <FlatList
        data={visibles}
        keyExtractor={(c) => String(c.idDueno)}
        ListHeaderComponent={cabecera}
        contentContainerStyle={s.lista}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={C.teal} />}
        ListEmptyComponent={
          <Vacio icono="wallet-outline"
            titulo={filtro === 'deben' ? 'Nadie te debe plata' : filtro === 'aldia' ? 'Nadie está al día todavía' : 'Todavía no hay cuentas'}
            texto={filtro === 'todos' ? 'Cuando termines un paseo, el dueño aparece acá con lo que te debe.' : undefined} />
        }
        renderItem={({ item: c }) => {
          const medio = medioDePago(c.medioPreferido);
          const n = c.paseos.length;
          return (
            <TouchableOpacity style={s.fila} onPress={() => setAbierta(c.idDueno)} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel={`Cuenta de ${c.dueno.nombre}`}>
              <Avatar uri={c.dueno.foto} nombre={c.dueno.nombre} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={s.filaNombre} numberOfLines={1}>{c.dueno.nombre}</Text>
                <Text style={s.filaSub} numberOfLines={1}>
                  {c.mascotas.join(', ')} · {n} {n === 1 ? 'paseo' : 'paseos'}
                </Text>
                <View style={s.filaInfo}>
                  {medio ? (
                    <>
                      <Ionicons name={medio.icono} size={12} color={C.texto2} />
                      <Text style={s.filaMedio}>{medio.label}</Text>
                    </>
                  ) : null}
                  {c.pendientes > 0 && (
                    <Text style={s.filaMedio}>{medio ? '· ' : ''}{c.pendientes} sin pagar</Text>
                  )}
                </View>
              </View>
              <EtiquetaSaldo saldo={c.saldo} />
              <Ionicons name="chevron-forward" size={18} color={C.gris} />
            </TouchableOpacity>
          );
        }}
      />

      <CuentaCorrienteModal
        visible={!!cuenta}
        cuenta={cuenta}
        onCerrar={() => setAbierta(null)}
        onRegistrar={() => setForm({ pago: null })}
        onEditar={(pago) => setForm({ pago })}
      >
        <PagoFormModal
          visible={form !== undefined && !!cuenta}
          dueno={cuenta?.dueno}
          saldo={form?.pago ? (cuenta?.saldo ?? 0) + form.pago.monto : (cuenta?.saldo ?? 0)}
          medioSugerido={cuenta?.medioPreferido}
          pago={form?.pago ?? null}
          onGuardar={guardarPago}
          onBorrar={borrar}
          onCerrar={() => setForm(undefined)}
        />
      </CuentaCorrienteModal>
    </>
  );
}

const s = StyleSheet.create({
  lista: { padding: 20, paddingBottom: 32 },

  hero: { backgroundColor: C.menta, borderRadius: 20, padding: 20 },
  heroLabel: { fontSize: 14, fontWeight: '700', color: C.texto },
  heroValor: { fontSize: 44, fontWeight: '900', color: C.texto, marginTop: 2 },
  heroFila: { flexDirection: 'row', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  heroNum: { fontSize: 17, fontWeight: '900', color: C.texto },
  heroTxt: { fontSize: 12, color: C.texto2, fontWeight: '600', marginTop: 1 },

  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF6E5',
    borderRadius: 12, padding: 10, marginTop: 14,
  },
  avisoTxt: { flex: 1, fontSize: 12, color: C.texto, fontWeight: '600' },

  segmento: {
    flexDirection: 'row', padding: 4, backgroundColor: '#FFFFFF', borderRadius: 30,
    borderWidth: 1, borderColor: C.borde, marginTop: 16, marginBottom: 12,
  },
  segBtn: { flex: 1, height: 38, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  segBtnOn: { backgroundColor: C.teal },
  segTxt: { fontSize: 14, fontWeight: '700', color: C.texto2 },
  segTxtOn: { color: '#FFFFFF', fontWeight: '800' },

  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card,
    borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0',
  },
  filaNombre: { fontSize: 15, fontWeight: '800', color: C.texto },
  filaSub: { fontSize: 12, color: C.texto2, marginTop: 1 },
  filaInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  filaMedio: { fontSize: 12, color: C.texto2, fontWeight: '600' },
});
