/**
 * PaseadorAppScreen.jsx — Contenedor de Zooni Paseadores (6 secciones)
 *
 * Inicio · Solicitudes · Paseo · Ganancias · Perfil
 *
 * Las secciones son estado de esta pantalla y se eligen desde el menú
 * hamburguesa (PaseadorDrawer), igual que en la app de dueños. Chat y
 * Disponibilidad sí son pantallas del stack (se abren encima).
 *
 * Acá vive el estado que comparten los tabs: perfil, solicitudes pendientes
 * (para el badge) y los paseos en curso (para el punto rojo del tab Paseo).
 * Mientras el paseador está Disponible, las solicitudes se refrescan solas.
 *
 * PASEOS EN GRUPO: cada mascota es un paseo aparte, y se pueden tener varios
 * en curso a la vez (hasta "perros por paseo" del perfil). Pausar, reanudar y
 * finalizar son por mascota y están acá para que los usen Inicio y Paseo. El
 * GPS también vive acá (useSeguimientoPaseos): sigue sumando distancia
 * aunque el paseador cambie de sección. Al finalizar una mascota del grupo, su
 * resumen (cobro) se abre encima y el resto del grupo sigue en curso.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Modal, SafeAreaView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import PaseadorHeader from '../../components/paseador/PaseadorHeader';
import PaseadorDrawer, { SECCIONES_PASEADOR } from '../../components/paseador/PaseadorDrawer';
import { C, PillButton, Vacio } from '../../components/paseador/PaseadorUI';
import {
  fetchPaseosEnCurso, fetchPerfilPaseador, fetchRolesCuenta, fetchSolicitudes, finalizarPaseo, formatoPlata,
  formatoTiempoPaseado, iniciarPaseo, pausarPaseo, reanudarPaseo, revisarRecordatoriosCobro, segundosDePaseo,
  setDisponible,
} from '../../services/paseadorApi';
import useSeguimientoPaseos from '../../hooks/useSeguimientoPaseos';
import { confirmar } from '../../utils/dialogo';
import {
  clearCurrentUserId, recordarModoPaseador, setModo, MODO_DUENO,
} from '../../config/session';

import InicioTab from './tabs/InicioTab';
import SolicitudesTab from './tabs/SolicitudesTab';
import PaseoTab, { Resumen } from './tabs/PaseoTab';
import GananciasTab from './tabs/GananciasTab';
import PagosTab from './tabs/PagosTab';
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
  // Paseos en curso: uno por mascota (varios = paseo en grupo)
  const [paseosActivos, setPaseosActivos] = useState([]);
  // Paseo recién finalizado cuyo resumen (cobro) se está mostrando
  const [resumen, setResumen] = useState(null);
  // Id del paseo con una acción en marcha (deshabilita sus botones)
  const [ocupado, setOcupado] = useState(null);
  const [toast, setToast] = useState(null);
  const [avisoPermisos, setAvisoPermisos] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [chatsSinLeer, setChatsSinLeer] = useState(0);
  const [esDueno, setEsDueno] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const seguimiento = useSeguimientoPaseos(paseosActivos, setPaseosActivos);

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
      const lista = await fetchPaseosEnCurso();
      // La base guarda la distancia cada ~15 s: no pisar la que ya se midió acá
      setPaseosActivos((actual) => lista.map((p) => {
        const local = actual.find((x) => x.id === p.id);
        return local ? { ...p, distanciaMetros: Math.max(p.distanciaMetros ?? 0, local.distanciaMetros ?? 0) } : p;
      }));
    } catch {
      // idem
    }
  }, []);

  const recargarTodo = useCallback(async () => {
    await Promise.all([recargarPerfil(), recargarSolicitudes(), recargarPaseo()]);
    setCargando(false);
  }, [recargarPerfil, recargarSolicitudes, recargarPaseo]);

  // ¿La cuenta también es de dueño? (para ofrecer "Cambiar a modo dueño")
  useEffect(() => {
    fetchRolesCuenta().then((r) => setEsDueno(!!r?.esDueno)).catch(() => {});
  }, []);

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

  // Dueños que pagan por semana / mes: si se cerró su período y deben, avisar
  // (la notificación queda en la campana y lleva a Pagos)
  useEffect(() => {
    revisarRecordatoriosCobro().then((n) => {
      if (n > 0) avisar(n === 1 ? 'Un cliente te debe plata: mirá Pagos' : `${n} clientes te deben plata: mirá Pagos`, 'wallet');
    });
  }, [avisar]);

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

  // Reemplaza un paseo del grupo por su versión nueva. La distancia se queda
  // con la que viene midiendo el GPS (la respuesta de la API trae la vieja).
  const actualizarActivo = (nuevo) => setPaseosActivos((lista) => lista.map((x) => (x.id === nuevo.id
    ? { ...x, ...nuevo, distanciaMetros: x.distanciaMetros } : x)));

  // Arrancar un paseo aceptado: lo usan Inicio, Solicitudes (agenda) y Paseo.
  // Si ya hay otros en curso, la mascota se suma al grupo.
  const empezarPaseo = async (paseo) => {
    if (paseosActivos.some((x) => x.id === paseo.id)) {
      setTab('paseo');
      return;
    }
    const max = perfil?.maxPerros ?? 3;
    if (paseosActivos.length >= max) {
      avisar(`Sacás hasta ${max} ${max === 1 ? 'mascota' : 'mascotas'} a la vez. Podés cambiarlo en tu Perfil.`, 'alert-circle');
      return;
    }
    setOcupado(paseo.id);
    try {
      const enCurso = await iniciarPaseo(paseo);
      setPaseosActivos((lista) => [...lista.filter((x) => x.id !== enCurso.id), enCurso]);
      if (paseosActivos.length) avisar(`${paseo.mascota.nombre} se sumó al paseo`, 'paw');
      setTab('paseo');
    } catch {
      avisar('No se pudo iniciar el paseo. Probá de nuevo.', 'alert-circle');
    } finally {
      setOcupado(null);
    }
  };

  const pausarOReanudar = async (paseo) => {
    setOcupado(paseo.id);
    try {
      actualizarActivo(paseo.reanudadoEn ? await pausarPaseo(paseo) : await reanudarPaseo(paseo));
    } catch {
      avisar('No se pudo actualizar el paseo. Probá de nuevo.', 'alert-circle');
    } finally {
      setOcupado(null);
    }
  };

  /** Pausa a todos los que están caminando, o reanuda a todos si están todos en pausa. */
  const pausarOReanudarTodos = async () => {
    const corriendo = paseosActivos.filter((x) => x.reanudadoEn);
    const lista = corriendo.length ? corriendo : paseosActivos;
    setOcupado('todos');
    try {
      const nuevos = await Promise.all(lista.map((x) => (corriendo.length ? pausarPaseo(x) : reanudarPaseo(x))));
      nuevos.forEach(actualizarActivo);
    } catch {
      avisar('No se pudo actualizar el paseo. Probá de nuevo.', 'alert-circle');
      recargarPaseo();
    } finally {
      setOcupado(null);
    }
  };

  const finalizar = async (paseo) => {
    const seg = segundosDePaseo(paseo);
    const aCobrar = formatoPlata(paseo.precio);
    const corto = seg < paseo.duracionMin * 60;
    const ok = await confirmar(
      `¿Finalizar el paseo de ${paseo.mascota.nombre}?`,
      corto
        ? `Llevás ${formatoTiempoPaseado(seg)} de los ${paseo.duracionMin} minutos pactados. Se cobra lo pactado, ${aCobrar}.`
        : `Cumpliste el tiempo pactado: se cobra ${aCobrar}. Le avisamos al dueño que ya está de vuelta.`,
      { textoOk: `Finalizar · ${aCobrar}` },
    );
    if (!ok) return;
    // Segunda confirmación si todavía no cumplió el tiempo: un toque sin
    // querer deja a la mascota "de vuelta en casa" antes de tiempo
    if (corto) {
      const seguro = await confirmar(
        '¿Seguro que querés finalizar?',
        `Faltan ${formatoTiempoPaseado(paseo.duracionMin * 60 - seg)} para el tiempo pactado. Si lo finalizás ahora, ${paseo.mascota.nombre} figura de vuelta en casa.`,
        { textoOk: 'Sí, finalizar', textoCancelar: 'Seguir paseando', destructivo: true },
      );
      if (!seguro) return;
    }
    setOcupado(paseo.id);
    try {
      // La distancia más nueva es la del estado (la mide el GPS de acá)
      const actual = paseosActivos.find((x) => x.id === paseo.id) ?? paseo;
      const fin = await finalizarPaseo(actual, actual.distanciaMetros);
      const quedan = paseosActivos.filter((x) => x.id !== paseo.id).length;
      setPaseosActivos((lista) => lista.filter((x) => x.id !== paseo.id));
      setResumen(fin);
      // Sin nadie más en curso, el resumen se ve en la sección Paseo; con el
      // grupo todavía caminando, se abre encima de donde esté
      if (!quedan) setTab('paseo');
    } catch {
      avisar('No se pudo finalizar. Probá de nuevo.', 'alert-circle');
    } finally {
      setOcupado(null);
    }
  };

  // "Retomar paseo" desde el resumen: la mascota vuelve al grupo
  const retomado = (paseo) => {
    setResumen(null);
    setPaseosActivos((lista) => [...lista.filter((x) => x.id !== paseo.id), paseo]);
    setTab('paseo');
  };

  const abrirChat = (paseo) => navigation.navigate('PaseadorChat', { paseoId: paseo.id });

  const modoDueno = async () => {
    // Para que el menú del dueño ofrezca volver, aunque la base no devuelva el rol
    await recordarModoPaseador();
    await setModo(MODO_DUENO);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const salir = async () => {
    // Al salir deja de figurar disponible: nadie le asigna paseos con la app cerrada
    await setDisponible(false).catch(() => {});
    await clearCurrentUserId();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  // Dirigidas a mí: siempre. Abiertas: sólo si estoy disponible
  const pendientes = perfil?.disponible ? solicitudes.length : solicitudes.filter((x) => !x.abierta).length;
  const abrirMenu = () => setMenuAbierto(true);

  const ctx = {
    perfil, setPerfil, recargarPerfil,
    solicitudes, recargarSolicitudes,
    paseosActivos, recargarPaseo, seguimiento, ocupado,
    empezarPaseo, pausarOReanudar, pausarOReanudarTodos, finalizar,
    resumen, setResumen, retomado,
    abrirChat, abrirMenu,
    irA: setTab, avisar, navigation,
  };

  // En el Paseo activo el mapa ocupa toda la pantalla: sin header
  const pantallaCompleta = tab === 'paseo' && paseosActivos.length > 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {!pantallaCompleta && (
        <PaseadorHeader
          perfil={perfil}
          onMenu={abrirMenu}
          onChatsSinLeer={setChatsSinLeer}
          // Tocar una notificación abre la sección que corresponde (las
          // secciones son pestañas de esta pantalla, no rutas del navegador).
          onIrASeccion={(seccion) => setTab(seccion)}
          // En Inicio saluda; en el resto dice en qué sección estás
          titulo={tab === 'inicio' ? undefined : SECCIONES_PASEADOR.find((x) => x.key === tab)?.label}
        />
      )}
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
        {tab === 'pagos' && <PagosTab {...ctx} />}
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

      <PaseadorDrawer
        visible={menuAbierto}
        onClose={() => setMenuAbierto(false)}
        perfil={perfil}
        activo={tab}
        onElegir={setTab}
        pendientes={pendientes}
        enCurso={paseosActivos.length > 0}
        chatsSinLeer={chatsSinLeer}
        onChats={() => navigation.navigate('PaseadorChats')}
        onZona={() => navigation.navigate('PaseadorDisponibilidad')}
        onModoDueno={esDueno ? modoDueno : null}
        onSalir={salir}
      />

      {/* Resumen de una mascota finalizada mientras el resto del grupo sigue */}
      <Modal visible={!!resumen && paseosActivos.length > 0} animationType="slide"
        onRequestClose={() => setResumen(null)}>
        <SafeAreaView style={s.safe}>
          {resumen && (
            <Resumen paseo={resumen} enGrupo={paseosActivos.length} onCerrar={() => setResumen(null)}
              onRetomado={retomado} irA={setTab} avisar={avisar} />
          )}
        </SafeAreaView>
      </Modal>
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
