/**
 * PaseadorAppScreen.jsx — Contenedor de Zooni Paseadores (5 tabs)
 *
 * Inicio · Solicitudes · Paseo · Ganancias · Perfil
 *
 * No hay @react-navigation/bottom-tabs en el proyecto: los tabs son estado de
 * esta pantalla y el bottom nav es propio (PaseadorTabBar). Chat y
 * Disponibilidad sí son pantallas del stack (se abren encima).
 *
 * Acá vive el estado que comparten los tabs: perfil, solicitudes pendientes
 * (para el badge) y el paseo en curso (para el punto rojo del tab Paseo).
 * Mientras el paseador está Disponible, las solicitudes se refrescan solas.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, SafeAreaView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import PaseadorHeader from '../../components/paseador/PaseadorHeader';
import PaseadorTabBar from '../../components/paseador/PaseadorTabBar';
import { C, PillButton, Vacio } from '../../components/paseador/PaseadorUI';
import {
  fetchPaseoEnCurso, fetchPerfilPaseador, fetchRolesCuenta, fetchSolicitudes, iniciarPaseo,
} from '../../services/paseadorApi';
import { clearCurrentUserId } from '../../config/session';

import InicioTab from './tabs/InicioTab';
import SolicitudesTab from './tabs/SolicitudesTab';
import PaseoTab from './tabs/PaseoTab';
import GananciasTab from './tabs/GananciasTab';
import PerfilTab from './tabs/PerfilTab';

const POLL_SOLICITUDES_MS = 20000;

export default function PaseadorAppScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [tab, setTab] = useState(route.params?.tab ?? 'inicio');
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sinPerfil, setSinPerfil] = useState(false);
  const [solicitudes, setSolicitudes] = useState([]);
  const [paseoActivo, setPaseoActivo] = useState(null);
  const [toast, setToast] = useState(null);
  const [avisoPermisos, setAvisoPermisos] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Perfil recién guardado en el registro (llega por params). Si la base no
  // deja leerlo, la app trabaja con esta copia en vez de mandar de nuevo al
  // formulario (eso era el bucle de "Empezar a pasear no hace nada").
  const perfilLocalRef = useRef(route.params?.perfilLocal ?? null);
  const desdeRegistro = !!route.params?.desdeRegistro;

  // ── Cargas ────────────────────────────────────────────────────────────────
  const recargarPerfil = useCallback(async () => {
    try {
      let p = null;
      try {
        p = await fetchPerfilPaseador();
      } catch (err) {
        console.error('[PaseadorApp] no se pudo leer el perfil', err);
      }
      if (!p && perfilLocalRef.current) {
        // Recién registrado pero la base no devuelve el perfil: permisos/RLS
        // de paseador_perfil (se arregla con la migración 038)
        setAvisoPermisos(true);
        setPerfil((actual) => actual ?? perfilLocalRef.current);
        return perfilLocalRef.current;
      }
      if (!p && !desdeRegistro) {
        // Tiene el rol pero no el perfil → a completarlo, no a un callejón sin salida
        const roles = await fetchRolesCuenta().catch(() => null);
        if (roles?.esPaseador) {
          navigation.reset({ index: 0, routes: [{ name: 'PaseadorRegistro', params: { completar: true } }] });
          return null;
        }
        setSinPerfil(true);
      }
      setPerfil(p);
      return p;
    } catch {
      return null;
    }
  }, [navigation, desdeRegistro]);

  const recargarSolicitudes = useCallback(async () => {
    try {
      setSolicitudes(await fetchSolicitudes());
    } catch {
      // sin red: queda la lista anterior
    }
  }, []);

  const recargarPaseo = useCallback(async () => {
    try {
      setPaseoActivo(await fetchPaseoEnCurso());
    } catch {
      // idem
    }
  }, []);

  const recargarTodo = useCallback(async () => {
    await Promise.all([recargarPerfil(), recargarSolicitudes(), recargarPaseo()]);
    setCargando(false);
  }, [recargarPerfil, recargarSolicitudes, recargarPaseo]);

  // Al volver de Chat / Disponibilidad, refrescar
  useFocusEffect(useCallback(() => { recargarTodo(); }, [recargarTodo]));

  // Polling de solicitudes sólo mientras está Disponible
  useEffect(() => {
    // Siempre se consulta (las solicitudes dirigidas a mí llegan aunque no esté
    // disponible); estando disponible, más seguido
    const t = setInterval(recargarSolicitudes, perfil?.disponible ? POLL_SOLICITUDES_MS : POLL_SOLICITUDES_MS * 3);
    return () => clearInterval(t);
  }, [perfil?.disponible, recargarSolicitudes]);

  // Navegación externa a un tab (ej: desde el Chat → "Ver paseo")
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const avisar = useCallback((texto, icono = 'checkmark-circle') => {
    setToast({ texto, icono });
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

  useEffect(() => {
    if (!route.params?.bienvenida) return;
    navigation.setParams({ bienvenida: undefined });
    avisar('¡Listo! Ya sos paseador de Zooni', 'paw');
  }, [route.params?.bienvenida, navigation, avisar]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <View style={s.centro}>
        <ActivityIndicator size="large" color={C.teal} />
      </View>
    );
  }

  if (sinPerfil) {
    // Sesión de una cuenta que no es (o dejó de ser) paseador
    return (
      <SafeAreaView style={[s.safe, s.centro]}>
        <Vacio icono="alert-circle-outline" titulo="Esta cuenta no tiene perfil de paseador"
          texto="Iniciá sesión de nuevo desde 'Registrarse como Proveedor'.">
          <PillButton titulo="Volver al inicio" style={{ marginTop: 18, alignSelf: 'stretch' }}
            onPress={async () => {
              await clearCurrentUserId();
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            }} />
        </Vacio>
      </SafeAreaView>
    );
  }

  // Arrancar un paseo aceptado: lo usan Inicio, Solicitudes (agenda) y Paseo
  const empezarPaseo = async (paseo) => {
    if (paseoActivo && paseoActivo.id !== paseo.id) {
      avisar(`Primero finalizá el paseo de ${paseoActivo.mascota.nombre}`, 'alert-circle');
      setTab('paseo');
      return;
    }
    try {
      const enCurso = await iniciarPaseo(paseo);
      setPaseoActivo(enCurso);
      setTab('paseo');
    } catch {
      avisar('No se pudo iniciar el paseo. Probá de nuevo.', 'alert-circle');
    }
  };

  const abrirChat = (paseo) => navigation.navigate('PaseadorChat', { paseoId: paseo.id });

  const ctx = {
    perfil, setPerfil, recargarPerfil,
    solicitudes, recargarSolicitudes,
    paseoActivo, setPaseoActivo, recargarPaseo,
    empezarPaseo, abrirChat,
    irA: setTab, avisar, navigation,
  };

  // En el Paseo activo el mapa ocupa toda la pantalla: sin header
  const pantallaCompleta = tab === 'paseo' && !!paseoActivo;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {!pantallaCompleta && <PaseadorHeader perfil={perfil} />}
      {avisoPermisos && !pantallaCompleta && (
        <View style={s.aviso}>
          <Ionicons name="warning" size={18} color={C.ambar} />
          <Text style={s.avisoTxt}>
            Tu perfil se guardó, pero la base de datos no deja leerlo. Es necesario correr la
            migración 038 en Supabase para que tus cambios se guarden.
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {tab === 'inicio' && <InicioTab {...ctx} />}
        {tab === 'solicitudes' && <SolicitudesTab {...ctx} />}
        {tab === 'paseo' && <PaseoTab {...ctx} />}
        {tab === 'ganancias' && <GananciasTab {...ctx} />}
        {tab === 'perfil' && <PerfilTab {...ctx} />}

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

      <PaseadorTabBar
        activo={tab}
        onCambiar={setTab}
        // Las dirigidas a mí cuentan siempre; las abiertas, sólo si estoy disponible
        pendientes={perfil?.disponible ? solicitudes.length : solicitudes.filter((x) => !x.abierta).length}
        enCurso={!!paseoActivo}
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
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF6E5',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5DDB0',
  },
  avisoTxt: { flex: 1, fontSize: 12, fontWeight: '600', color: C.texto, lineHeight: 17 },
});
