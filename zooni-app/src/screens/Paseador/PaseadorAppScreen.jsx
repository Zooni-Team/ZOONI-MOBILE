import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, SafeAreaView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import PaseadorHeader from '../../components/paseador/PaseadorHeader';
import PaseadorDrawer, { SECCIONES_PASEADOR } from '../../components/paseador/PaseadorDrawer';
import { C, PillButton, Vacio } from '../../components/paseador/PaseadorUI';
import {
  fetchPaseosEnCurso,
  fetchPerfilPaseador,
  fetchRolesCuenta,
  fetchSolicitudes,
  finalizarPaseo,
  iniciarPaseo,
  pausarPaseo,
  reanudarPaseo,
  revisarRecordatoriosCobro,
  setDisponible,
} from '../../services/paseadorApi';
import { formatoPlata, formatoTiempoPaseado, segundosDePaseo } from '../../domain/paseos';
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
import { colores } from '../../theme';
import Toast from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';

const POLL_SOLICITUDES_MS = 20000;

export default function PaseadorAppScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [tab, setTab] = useState(route.params?.tab ?? 'inicio');
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sinPerfil, setSinPerfil] = useState(false);
  const [solicitudes, setSolicitudes] = useState([]);
  const [paseosActivos, setPaseosActivos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const { toast, mostrarToast } = useToast(3000);
  const [avisoPermisos, setAvisoPermisos] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [chatsSinLeer, setChatsSinLeer] = useState(0);
  const [esDueno, setEsDueno] = useState(false);
  const seguimiento = useSeguimientoPaseos(paseosActivos, setPaseosActivos);

  const perfilLocalRef = useRef(route.params?.perfilLocal ?? null);
  const desdeRegistro = !!route.params?.desdeRegistro;

  const recargarPerfil = useCallback(async () => {
    try {
      let p = null;
      try {
        p = await fetchPerfilPaseador();
      } catch (err) {
        if (__DEV__) console.error('[PaseadorApp] no se pudo leer el perfil', err);
      }
      if (!p && perfilLocalRef.current) {
        setAvisoPermisos(true);
        setPerfil((actual) => actual ?? perfilLocalRef.current);
        return perfilLocalRef.current;
      }
      if (!p && !desdeRegistro) {
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
    }
  }, []);

  const recargarPaseo = useCallback(async () => {
    try {
      const lista = await fetchPaseosEnCurso();
      setPaseosActivos((actual) => lista.map((p) => {
        const local = actual.find((x) => x.id === p.id);
        return local ? { ...p, distanciaMetros: Math.max(p.distanciaMetros ?? 0, local.distanciaMetros ?? 0) } : p;
      }));
    } catch {
    }
  }, []);

  const recargarTodo = useCallback(async () => {
    await Promise.all([recargarPerfil(), recargarSolicitudes(), recargarPaseo()]);
    setCargando(false);
  }, [recargarPerfil, recargarSolicitudes, recargarPaseo]);

  useEffect(() => {
    fetchRolesCuenta().then((r) => setEsDueno(!!r?.esDueno)).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { recargarTodo(); }, [recargarTodo]));

  useEffect(() => {
    const t = setInterval(recargarSolicitudes, perfil?.disponible ? POLL_SOLICITUDES_MS : POLL_SOLICITUDES_MS * 3);
    return () => clearInterval(t);
  }, [perfil?.disponible, recargarSolicitudes]);

  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const avisar = useCallback((texto, icono = 'checkmark-circle') => {
    mostrarToast(texto, { icono, color: icono === 'alert-circle' ? colores.rojo : colores.verde });
  }, [mostrarToast]);

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

  if (cargando) {
    return (
      <View style={s.centro}>
        <ActivityIndicator size="large" color={C.teal} />
      </View>
    );
  }

  if (sinPerfil) {
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

  const actualizarActivo = (nuevo) => setPaseosActivos((lista) => lista.map((x) => (x.id === nuevo.id
    ? { ...x, ...nuevo, distanciaMetros: x.distanciaMetros } : x)));

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
      const actual = paseosActivos.find((x) => x.id === paseo.id) ?? paseo;
      const fin = await finalizarPaseo(actual, actual.distanciaMetros);
      const quedan = paseosActivos.filter((x) => x.id !== paseo.id).length;
      setPaseosActivos((lista) => lista.filter((x) => x.id !== paseo.id));
      setResumen(fin);
      if (!quedan) setTab('paseo');
    } catch {
      avisar('No se pudo finalizar. Probá de nuevo.', 'alert-circle');
    } finally {
      setOcupado(null);
    }
  };

  const retomado = (paseo) => {
    setResumen(null);
    setPaseosActivos((lista) => [...lista.filter((x) => x.id !== paseo.id), paseo]);
    setTab('paseo');
  };

  const abrirChat = (paseo) => navigation.navigate('PaseadorChat', { paseoId: paseo.id });

  const modoDueno = async () => {
    await recordarModoPaseador();
    await setModo(MODO_DUENO);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const salir = async () => {
    await setDisponible(false).catch(() => {});
    await clearCurrentUserId();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

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

  const pantallaCompleta = tab === 'paseo' && paseosActivos.length > 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colores.blanco} />
      {!pantallaCompleta && (
        <PaseadorHeader
          perfil={perfil}
          onMenu={abrirMenu}
          onChatsSinLeer={setChatsSinLeer}
          onIrASeccion={(seccion) => setTab(seccion)}
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

        <Toast {...toast} posicion="abajo" />
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
  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF6E5',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5DDB0',
  },
  avisoTxt: { flex: 1, fontSize: 12, fontWeight: '600', color: C.texto, lineHeight: 17 },
});
