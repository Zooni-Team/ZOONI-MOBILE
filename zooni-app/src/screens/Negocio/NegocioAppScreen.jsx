/**
 * NegocioAppScreen.jsx — Contenedor de Zooni Negocios
 *
 * Una sola pantalla para veterinarias, peluquerías y pet shops con el diseño
 * de Zooni Paseadores (PaseadorHeader + PaseadorDrawer + cards). Lo que
 * cambia es qué secciones tiene cada tipo (constants/negocios.js):
 *
 *   Veterinaria  Inicio · Turnos · Pacientes · Servicios y precios · Mensajes · Mi negocio
 *   Peluquería   Inicio · Turnos · Servicios y precios · Trabajos · Clientes · Mensajes · Mi negocio
 *   Pet shop     Inicio · Pedidos · Catálogo · Clientes · Mensajes · Mi negocio
 *
 * Acá vive lo que comparten las secciones: el negocio y los contadores del
 * menú (turnos por confirmar, pedidos nuevos, mensajes sin leer), que se
 * refrescan solos cada POLL_MS.
 *
 * Params: { tipo, tab?, bienvenida? }
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, SafeAreaView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import PaseadorHeader from '../../components/paseador/PaseadorHeader';
import PaseadorDrawer from '../../components/paseador/PaseadorDrawer';
import { C, PillButton, Vacio } from '../../components/paseador/PaseadorUI';
import { configNegocio } from '../../constants/negocios';
import {
  contarNoLeidosNegocio, fetchMiNegocio, fetchPedidosNegocio, fetchTurnosNegocio,
} from '../../services/negocioApi';
import { fetchRolesCuenta } from '../../services/paseadorApi';
import { clearCurrentUserId, setModo, MODO_DUENO } from '../../config/session';
import { cantidadDeApps } from '../../utils/rutaSegunRoles';

import InicioNegocioTab from './tabs/InicioNegocioTab';
import TurnosTab from './tabs/TurnosTab';
import PacientesTab from './tabs/PacientesTab';
import ItemsTab from './tabs/ItemsTab';
import PedidosTab from './tabs/PedidosTab';
import GaleriaTab from './tabs/GaleriaTab';
import ClientesPetshopTab from './tabs/ClientesPetshopTab';
import MensajesNegocioTab from './tabs/MensajesNegocioTab';
import MiNegocioTab from './tabs/MiNegocioTab';

const POLL_MS = 30000;

export default function NegocioAppScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const tipo = route.params?.tipo ?? 'veterinaria';
  const cfg = configNegocio(tipo);

  const [tab, setTab] = useState(route.params?.tab ?? 'inicio');
  const [negocio, setNegocio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [badges, setBadges] = useState({});
  const [roles, setRoles] = useState(null);
  const [toast, setToast] = useState(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const avisar = useCallback((texto, icono = 'checkmark-circle') => {
    setToast({ texto, icono });
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

  const recargarNegocio = useCallback(async () => {
    try {
      const n = await fetchMiNegocio(tipo);
      setNegocio(n);
      setError(n ? null : 'sin_negocio');
      return n;
    } catch (err) {
      setError(err?.message === 'migracion_pendiente' ? 'migracion' : 'red');
      return null;
    } finally {
      setCargando(false);
    }
  }, [tipo]);

  // Contadores del menú
  const refrescarBadges = useCallback(async (n = negocio) => {
    if (!n) return;
    try {
      const [mensajes, pendientes] = await Promise.all([
        contarNoLeidosNegocio(n.idServicio),
        cfg.usaPedidos
          ? fetchPedidosNegocio(n.id).then((l) => l.filter((p) => p.estado === 'nuevo').length)
          : fetchTurnosNegocio(n.id, { desde: new Date(), estados: ['pendiente'] }).then((l) => l.length),
      ]);
      setBadges({ mensajes, [cfg.usaPedidos ? 'pedidos' : 'turnos']: pendientes });
    } catch {
      // sin red: quedan los anteriores
    }
  }, [negocio, cfg.usaPedidos]);

  useFocusEffect(useCallback(() => {
    recargarNegocio().then((n) => refrescarBadges(n));
  }, [recargarNegocio])); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => refrescarBadges(), POLL_MS);
    return () => clearInterval(t);
  }, [refrescarBadges]);

  useEffect(() => {
    fetchRolesCuenta().then(setRoles).catch(() => {});
  }, []);

  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  useEffect(() => {
    if (!route.params?.bienvenida) return;
    navigation.setParams({ bienvenida: undefined });
    avisar(`¡Listo! Tu ${cfg.label.toLowerCase()} ya está en Zooni`, cfg.icono);
  }, [route.params?.bienvenida, navigation, avisar, cfg]);

  const abrirChat = useCallback((idDueno, nombre) => {
    navigation.navigate('NegocioChat', { tipo, idDueno, nombre });
  }, [navigation, tipo]);

  const salir = async () => {
    await clearCurrentUserId();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  // ── Estados de carga / error ─────────────────────────────────────────────
  if (cargando) {
    return <View style={s.centro}><ActivityIndicator size="large" color={C.teal} /></View>;
  }
  if (!negocio) {
    return (
      <SafeAreaView style={[s.safe, s.centro]}>
        <Vacio
          icono={error === 'red' ? 'cloud-offline-outline' : cfg.icono}
          titulo={error === 'migracion' ? 'Falta preparar la base de datos'
            : error === 'red' ? 'No se pudo conectar' : `Esta cuenta no tiene una ${cfg.label.toLowerCase()}`}
          texto={error === 'migracion' ? 'Es necesario correr la migración 046 en el SQL Editor de Supabase.'
            : error === 'red' ? 'Revisá tu internet y probá de nuevo.' : `Podés registrarla ahora con tu misma cuenta.`}
        >
          {error === 'red' ? (
            <PillButton titulo="Reintentar" style={{ marginTop: 18, alignSelf: 'stretch' }}
              onPress={() => { setCargando(true); recargarNegocio(); }} />
          ) : error === 'sin_negocio' ? (
            <PillButton titulo={`Registrar mi ${cfg.label.toLowerCase()}`} style={{ marginTop: 18, alignSelf: 'stretch' }}
              onPress={() => navigation.navigate('NegocioLogin', { tipo })} />
          ) : null}
          <PillButton titulo="Volver al inicio" variante="secundario" style={{ marginTop: 12, alignSelf: 'stretch' }}
            onPress={async () => { await setModo(MODO_DUENO); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }} />
        </Vacio>
      </SafeAreaView>
    );
  }

  const ctx = {
    negocio, setNegocio, recargarNegocio, tipo, cfg,
    irA: setTab, avisar, navigation, abrirChat, badges, refrescarBadges,
  };
  const seccion = cfg.secciones.find((x) => x.key === tab) ?? cfg.secciones[0];

  const extras = [
    { icono: 'eye-outline', label: 'Ver mi ficha como cliente', onPress: () => navigation.navigate('NegocioPublico', { idNegocio: negocio.id, vistaPrevia: true }) },
    ...(cantidadDeApps(roles) > 1
      ? [{ icono: 'swap-horizontal-outline', label: 'Cambiar de app', onPress: () => navigation.navigate('ElegirModo') }]
      : []),
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <PaseadorHeader
        perfil={{ nombre: negocio.nombre, apellido: '', foto: negocio.logo }}
        chip={{ texto: negocio.abierto ? cfg.abierto.on : cfg.abierto.off, on: negocio.abierto }}
        contarChats={() => contarNoLeidosNegocio(negocio.idServicio)}
        onMenu={() => setMenuAbierto(true)}
        onIrASeccion={(destino) => { if (cfg.secciones.some((x) => x.key === destino)) setTab(destino); }}
        titulo={tab === 'inicio' ? negocio.nombre : seccion.label}
      />

      <View style={{ flex: 1 }}>
        {seccion.key === 'inicio' && <InicioNegocioTab {...ctx} />}
        {seccion.key === 'turnos' && <TurnosTab {...ctx} />}
        {seccion.key === 'pacientes' && <PacientesTab {...ctx} />}
        {seccion.key === 'clientes' && (cfg.usaPedidos ? <ClientesPetshopTab {...ctx} /> : <PacientesTab {...ctx} />)}
        {(seccion.key === 'servicios' || seccion.key === 'catalogo') && <ItemsTab {...ctx} />}
        {seccion.key === 'pedidos' && <PedidosTab {...ctx} />}
        {seccion.key === 'galeria' && <GaleriaTab {...ctx} />}
        {seccion.key === 'mensajes' && <MensajesNegocioTab {...ctx} />}
        {seccion.key === 'perfil' && <MiNegocioTab {...ctx} />}

        {toast && (
          <Animated.View
            pointerEvents="none"
            style={[s.toast, {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }]}
          >
            <Ionicons name={toast.icono} size={20} color={C.teal} />
            <Text style={s.toastTxt}>{toast.texto}</Text>
          </Animated.View>
        )}
      </View>

      <PaseadorDrawer
        visible={menuAbierto}
        onClose={() => setMenuAbierto(false)}
        perfil={{ nombre: negocio.nombre, apellido: '', foto: negocio.logo }}
        subtitulo={`${cfg.app} · ${negocio.abierto ? cfg.abierto.on : cfg.abierto.off}`}
        secciones={cfg.secciones}
        badges={badges}
        activo={tab}
        onElegir={setTab}
        extras={extras}
        textoSalir={cfg.usaPedidos ? 'Vas a dejar de ver los pedidos en este dispositivo.' : 'Vas a dejar de ver los turnos en este dispositivo.'}
        onSalir={salir}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fondo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fondo },
  toast: {
    position: 'absolute', left: 20, right: 20, bottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: C.menta,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  toastTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: C.texto },
});
