/**
 * NegocioRegistroScreen.jsx — Alta de una veterinaria, peluquería o pet shop
 *
 *   Paso 1 · Tus datos     (responsable: nombre, apellido, mail, teléfono, contraseña)
 *   Paso 2 · Tu negocio    (logo, nombre, descripción, dirección + punto en el
 *                           mapa, teléfono, horarios y lo propio de cada tipo)
 *
 * Lo propio de cada tipo (va a negocio_perfil.datos):
 *   · Veterinaria: matrícula (obligatoria), especialidades, urgencias 24 h,
 *     atención a domicilio.
 *   · Peluquería: tamaños y especies que atiende, busca y lleva a domicilio.
 *   · Pet shop: envíos (costo, gratis desde, radio), pedido mínimo y medios de
 *     pago que acepta.
 *
 * Con params.activar ({ email, hash, nombre }) es una cuenta que ya existe:
 * se saltea el paso 1 y sólo se suma el negocio.
 * Al terminar entra directo a la app del negocio, donde un checklist lo guía
 * para cargar sus servicios o su catálogo.
 *
 * Params: { tipo, activar? }
 */

import { useRef, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';

import { C, PillButton, sombra } from '../../components/paseador/PaseadorUI';
import ZonaMapaPicker from '../../components/paseador/ZonaMapaPicker';
import HorariosEditor, { validarHorarios } from '../../components/negocio/HorariosEditor';
import {
  HORARIOS_NEGOCIO_DEFAULT, MEDIOS_PAGO_NEGOCIO, TAMANOS, configNegocio,
} from '../../constants/negocios';
import {
  activarNegocio, fetchMiNegocio, registrarNegocio, subirLogoNegocio,
} from '../../services/negocioApi';
import { verificarDisponibilidad } from '../../services/authApi';
import { volverOLogin } from '../../utils/volverOLogin';
import { sanitizarDigitos } from '../../utils/sanitizar';
import { alerta } from '../../utils/dialogo';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ESPECIES = [{ key: 'perro', label: 'Perros' }, { key: 'gato', label: 'Gatos' }];

function Campo({ label, error, ayuda, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      {children}
      {ayuda && !error ? <Text style={s.ayuda}>{ayuda}</Text> : null}
      {error ? <Text style={s.errorCampo}>{error}</Text> : null}
    </View>
  );
}

function InputPassword({ value, onChangeText, placeholder, error }) {
  const [ver, setVer] = useState(false);
  return (
    <View style={[s.input, s.inputPassWrap, error && s.inputError]}>
      <TextInput style={s.inputPass} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={C.gris}
        secureTextEntry={!ver} autoCapitalize="none" autoCorrect={false}
        autoComplete="new-password" textContentType="newPassword" />
      <TouchableOpacity onPress={() => setVer((v) => !v)} hitSlop={8}
        accessibilityLabel={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        <Ionicons name={ver ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.texto2} />
      </TouchableOpacity>
    </View>
  );
}

/** Chips de selección múltiple. */
function Multi({ opciones, valor, onCambio, error }) {
  return (
    <View style={s.chips}>
      {opciones.map((o) => {
        const key = o.key ?? o;
        const on = valor.includes(key);
        return (
          <TouchableOpacity key={key} style={[s.chip, on && s.chipOn, error && !valor.length && s.inputError]}
            onPress={() => onCambio(on ? valor.filter((x) => x !== key) : [...valor, key])}
            accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
            {o.icono ? <Ionicons name={o.icono} size={14} color={on ? '#FFF' : C.teal} /> : null}
            <Text style={[s.chipTxt, on && s.chipTxtOn]}>{o.label ?? o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Toggle({ valor, onCambio, titulo, texto }) {
  return (
    <TouchableOpacity style={[s.toggle, valor && s.toggleOn]} onPress={() => onCambio(!valor)}
      accessibilityRole="switch" accessibilityState={{ checked: valor }} activeOpacity={0.85}>
      <Ionicons name={valor ? 'checkbox' : 'square-outline'} size={22} color={valor ? C.teal : C.gris} />
      <View style={{ flex: 1 }}>
        <Text style={s.toggleTitulo}>{titulo}</Text>
        {texto ? <Text style={s.toggleTxt}>{texto}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function datosIniciales(tipo) {
  if (tipo === 'veterinaria') {
    return { matricula: '', especialidades: ['Clínica general'], urgencias24h: false, aDomicilio: false };
  }
  if (tipo === 'peluqueria') {
    return { tamanos: TAMANOS.map((t) => t.key), especies: ['perro'], buscaYLleva: false };
  }
  return {
    envios: true, envioCosto: '', envioGratisDesde: '', radioEnvioKm: '3', pedidoMinimo: '',
    mediosPago: ['efectivo', 'transferencia', 'mercadopago'],
  };
}

export default function NegocioRegistroScreen() {
  const navigation = useNavigation();
  const { tipo = 'veterinaria', activar } = useRoute().params ?? {};
  const cfg = configNegocio(tipo);
  const sinPaso1 = !!activar;

  const [paso, setPaso] = useState(sinPaso1 ? 2 : 1);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [cargando, setCargando] = useState(false);
  const scrollRef = useRef(null);
  const cuentaCreadaRef = useRef(false);

  const [usuario, setUsuario] = useState({
    nombre: '', apellido: '', email: '', telefono: '', password: '', password2: '',
  });
  const [negocio, setNegocio] = useState({
    nombre: '', descripcion: '', direccion: '', telefono: '',
    lat: null, lng: null, barrio: '', horarios: HORARIOS_NEGOCIO_DEFAULT(),
  });
  const [datos, setDatos] = useState(() => datosIniciales(tipo));
  const [logo, setLogo] = useState(null);

  const limpiar = (k) => setErrores((e) => ({ ...e, [k]: null }));
  const setU = (k, v) => { setUsuario((p) => ({ ...p, [k]: v })); limpiar(k); };
  const setN = (k, v) => { setNegocio((p) => ({ ...p, [k]: v })); limpiar(k); };
  const setD = (k, v) => { setDatos((p) => ({ ...p, [k]: v })); limpiar(k); };

  const elegirLogo = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      alerta('Sin permiso', 'Habilitá el acceso a la galería desde la configuración del dispositivo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1],
    });
    if (!res.canceled && res.assets?.[0]?.uri) setLogo(res.assets[0].uri);
  };

  const validarPaso1 = async () => {
    const e = {};
    if (usuario.nombre.trim().length < 2) e.nombre = 'El nombre es obligatorio';
    if (usuario.apellido.trim().length < 2) e.apellido = 'El apellido es obligatorio';
    if (!EMAIL_REGEX.test(usuario.email.trim())) e.email = 'Es necesario un email válido';
    if (usuario.telefono.length < 8) e.telefono = 'El teléfono es obligatorio (mínimo 8 números)';
    if (usuario.password.length < 7) e.password = 'La contraseña necesita al menos 7 caracteres';
    else if (usuario.password !== usuario.password2) e.password2 = 'Las contraseñas no coinciden';
    if (!e.email) {
      const { mailTomado } = await Promise.race([
        verificarDisponibilidad({ email: usuario.email }).catch(() => ({ mailTomado: false })),
        new Promise((resolve) => setTimeout(() => resolve({ mailTomado: false }), 3000)),
      ]);
      if (mailTomado) e.email = `Ya hay una cuenta con este mail. Iniciá sesión y sumá tu ${cfg.label.toLowerCase()}.`;
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const validarPaso2 = () => {
    const e = {};
    if (negocio.nombre.trim().length < 2) e.nombreNegocio = `Es necesario el nombre de tu ${cfg.label.toLowerCase()}`;
    if (negocio.direccion.trim().length < 5) e.direccion = 'Es necesaria la dirección (calle y número)';
    if (negocio.lat == null) e.ubicacion = 'Es necesario marcar tu local en el mapa';
    const errHorarios = validarHorarios(negocio.horarios);
    if (errHorarios) e.horarios = errHorarios;
    if (tipo === 'veterinaria') {
      if (datos.matricula.trim().length < 3) e.matricula = 'Es necesaria la matrícula profesional';
      if (!datos.especialidades.length) e.especialidades = 'Elegí al menos una especialidad';
    }
    if (tipo === 'peluqueria') {
      if (!datos.tamanos.length) e.tamanos = 'Elegí al menos un tamaño';
      if (!datos.especies.length) e.especies = 'Elegí perros, gatos o los dos';
    }
    if (tipo === 'petshop') {
      if (!datos.mediosPago.length) e.mediosPago = 'Elegí al menos un medio de pago';
      if (datos.envios && datos.envioCosto === '') e.envioCosto = 'Escribí cuánto cobrás el envío (0 si es gratis)';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const datosParaGuardar = () => {
    if (tipo === 'veterinaria') return { ...datos, matricula: datos.matricula.trim() };
    if (tipo === 'petshop') {
      return {
        ...datos,
        envioCosto: Number(datos.envioCosto) || 0,
        envioGratisDesde: Number(datos.envioGratisDesde) || 0,
        radioEnvioKm: Number(datos.radioEnvioKm) || 0,
        pedidoMinimo: Number(datos.pedidoMinimo) || 0,
      };
    }
    return datos;
  };

  const continuar = async () => {
    setErrorGeneral(null);
    if (paso === 1) {
      setCargando(true);
      const ok = await validarPaso1().finally(() => setCargando(false));
      if (ok) {
        // El teléfono del local arranca con el del responsable
        setNegocio((n) => ({ ...n, telefono: n.telefono || usuario.telefono }));
        setPaso(2);
      }
      scrollRef.current?.scrollTo({ y: 0, animated: !ok });
      return;
    }
    if (!validarPaso2()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    const datosNegocio = { ...negocio, tipo, datos: datosParaGuardar() };
    setCargando(true);
    try {
      if (!cuentaCreadaRef.current) {
        if (activar) await activarNegocio({ email: activar.email, hash: activar.hash, negocio: datosNegocio });
        else await registrarNegocio({ usuario, negocio: datosNegocio });
        cuentaCreadaRef.current = true;
      }
      if (logo) {
        try {
          const creado = await fetchMiNegocio(tipo);
          if (creado) await subirLogoNegocio(creado, logo);
        } catch (errLogo) {
          // El negocio ya quedó: el logo se puede subir después desde "Mi negocio"
          console.error('[Registro negocio] logo', errLogo);
        }
      }
      navigation.reset({ index: 0, routes: [{ name: 'NegocioApp', params: { tipo, bienvenida: true } }] });
    } catch (err) {
      const msg = err?.message;
      console.error('[Registro negocio]', msg, err?.detalle ?? err);
      const detalle = err?.detalle ? `\n\nDetalle: ${err.detalle}` : '';
      if (msg === 'email_existente') {
        setPaso(1);
        setErrores({ email: 'Ya hay una cuenta con este mail.' });
      } else if (msg === 'credenciales') {
        setErrorGeneral('Es necesario volver a iniciar sesión: tu contraseña no coincide.');
      } else if (msg === 'ubicacion_invalida') {
        setErrores({ ubicacion: 'Revisá la dirección y el punto en el mapa' });
      } else if (msg === 'migracion_pendiente') {
        setErrorGeneral(`A la base de datos le falta Zooni Negocios: es necesario correr la migración 046 en el SQL Editor de Supabase.${detalle}`);
      } else {
        setErrorGeneral(`No se pudo registrar tu ${cfg.label.toLowerCase()}.${detalle || `\n\nDetalle: ${msg ?? 'error desconocido'}`}`);
      }
    } finally {
      setCargando(false);
    }
  };

  const volver = () => {
    if (paso === 2 && !sinPaso1) setPaso(1);
    else volverOLogin(navigation, 'ProveedorTipo');
  };

  const totalPasos = sinPaso1 ? 1 : 2;
  const pasoVisible = sinPaso1 ? 1 : paso;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.menta} />
      <View style={s.top}>
        <TouchableOpacity onPress={volver} style={s.volver} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={26} color={C.teal} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.topTitulo}>{paso === 1 ? 'Tus datos' : `Tu ${cfg.label.toLowerCase()}`}</Text>
          <Text style={s.topSub}>Paso {pasoVisible} de {totalPasos} · {cfg.app}</Text>
        </View>
        <View style={[s.topIcono, { backgroundColor: cfg.fondoIcono }]}>
          <Ionicons name={cfg.icono} size={20} color={cfg.color} />
        </View>
      </View>
      <View style={s.progreso}>
        <View style={[s.progresoFill, { width: `${(pasoVisible / totalPasos) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {paso === 1 ? (
            <View style={s.card}>
              <Text style={s.intro}>
                Primero, quién maneja la cuenta. Después cargás los datos de tu {cfg.label.toLowerCase()}.
              </Text>
              <View style={s.fila}>
                <View style={{ flex: 1 }}>
                  <Campo label="Nombre" error={errores.nombre}>
                    <TextInput style={[s.input, errores.nombre && s.inputError]} value={usuario.nombre}
                      onChangeText={(v) => setU('nombre', v.slice(0, 50))} placeholder="Ana" placeholderTextColor={C.gris} />
                  </Campo>
                </View>
                <View style={{ flex: 1 }}>
                  <Campo label="Apellido" error={errores.apellido}>
                    <TextInput style={[s.input, errores.apellido && s.inputError]} value={usuario.apellido}
                      onChangeText={(v) => setU('apellido', v.slice(0, 50))} placeholder="Gómez" placeholderTextColor={C.gris} />
                  </Campo>
                </View>
              </View>
              <Campo label="Correo electrónico" error={errores.email}>
                <TextInput style={[s.input, errores.email && s.inputError]} value={usuario.email}
                  onChangeText={(v) => setU('email', v.trim())} placeholder="vos@mail.com" placeholderTextColor={C.gris}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                  autoComplete="username" textContentType="username" />
              </Campo>
              <Campo label="Teléfono" error={errores.telefono}>
                <TextInput style={[s.input, errores.telefono && s.inputError]} value={usuario.telefono}
                  onChangeText={(v) => setU('telefono', sanitizarDigitos(v, 15))} placeholder="11 2345 6789" placeholderTextColor={C.gris}
                  keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
              </Campo>
              <Campo label="Contraseña" error={errores.password}>
                <InputPassword value={usuario.password} error={errores.password}
                  onChangeText={(v) => setU('password', v)} placeholder="Mínimo 7 caracteres" />
              </Campo>
              <Campo label="Repetí la contraseña" error={errores.password2}>
                <InputPassword value={usuario.password2} error={errores.password2}
                  onChangeText={(v) => setU('password2', v)} placeholder="Repetila" />
              </Campo>
            </View>
          ) : (
            <>
              <View style={s.card}>
                {activar ? (
                  <Text style={s.intro}>
                    ¡Genial{activar.nombre ? `, ${activar.nombre}` : ''}! Cargá los datos de tu {cfg.label.toLowerCase()} y
                    listo: vas a poder cambiar de app con la misma cuenta.
                  </Text>
                ) : null}

                <View style={s.logoFila}>
                  <TouchableOpacity style={s.logo} onPress={elegirLogo} accessibilityLabel="Elegir logo">
                    {logo
                      ? <Image source={{ uri: logo }} style={s.logoImg} />
                      : <Ionicons name={cfg.icono} size={34} color={cfg.color} />}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Logo o foto del local</Text>
                    <Text style={s.ayuda}>Opcional, pero ayuda a que te reconozcan en el mapa.</Text>
                    <TouchableOpacity style={s.logoBtn} onPress={elegirLogo}>
                      <Ionicons name="image-outline" size={16} color={C.teal} />
                      <Text style={s.logoBtnTxt}>{logo ? 'Cambiar' : 'Elegir imagen'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Campo label={`Nombre de tu ${cfg.label.toLowerCase()}`} error={errores.nombreNegocio}>
                  <TextInput style={[s.input, errores.nombreNegocio && s.inputError]} value={negocio.nombre}
                    onChangeText={(v) => { setN('nombre', v.slice(0, 150)); limpiar('nombreNegocio'); }}
                    placeholder={cfg.placeholderNombre} placeholderTextColor={C.gris} />
                </Campo>
                <Campo label="Contales a los clientes qué hacen (opcional)">
                  <TextInput style={[s.input, s.textarea]} value={negocio.descripcion} multiline maxLength={600}
                    onChangeText={(v) => setN('descripcion', v)} placeholderTextColor={C.gris}
                    placeholder={cfg.placeholderDescripcion} />
                </Campo>
                <Campo label="Teléfono del local" ayuda="Lo ven los clientes en tu ficha.">
                  <TextInput style={s.input} value={negocio.telefono}
                    onChangeText={(v) => setN('telefono', sanitizarDigitos(v, 15))} placeholder="11 2345 6789"
                    placeholderTextColor={C.gris} keyboardType="phone-pad" />
                </Campo>
              </View>

              <View style={[s.card, { marginTop: 14 }]}>
                <Text style={s.cardTitulo}>¿Dónde está?</Text>
                <Campo label="Dirección" error={errores.direccion}>
                  <TextInput style={[s.input, errores.direccion && s.inputError]} value={negocio.direccion}
                    onChangeText={(v) => setN('direccion', v.slice(0, 300))} placeholder="Ej: Av. Díaz Vélez 3820"
                    placeholderTextColor={C.gris} />
                </Campo>
                <ZonaMapaPicker
                  conRadio={false}
                  valor={{ lat: negocio.lat, lng: negocio.lng, radioKm: null, zona: negocio.barrio }}
                  onCambio={(z) => {
                    setNegocio((n) => ({ ...n, lat: z.lat, lng: z.lng, barrio: z.zona ?? n.barrio }));
                    limpiar('ubicacion');
                  }}
                />
                {errores.ubicacion ? <Text style={s.errorCampo}>{errores.ubicacion}</Text> : null}
              </View>

              <View style={[s.card, { marginTop: 14 }]}>
                <Text style={s.cardTitulo}>Horarios de atención</Text>
                <Text style={s.ayuda}>
                  {cfg.usaTurnos
                    ? 'Con estos horarios armamos los turnos libres que ven tus clientes.'
                    : 'Tus clientes ven si estás abierto ahora.'}
                </Text>
                <View style={{ height: 8 }} />
                <HorariosEditor valor={negocio.horarios} error={errores.horarios}
                  onCambio={(h) => { setN('horarios', h); limpiar('horarios'); }} />
              </View>

              {/* ─── Lo propio de cada tipo ─── */}
              {tipo === 'veterinaria' && (
                <View style={[s.card, { marginTop: 14 }]}>
                  <Text style={s.cardTitulo}>Tu práctica</Text>
                  <Campo label="Matrícula profesional" error={errores.matricula} ayuda="Ej: MN 12345 · Se muestra en tu ficha.">
                    <TextInput style={[s.input, errores.matricula && s.inputError]} value={datos.matricula}
                      onChangeText={(v) => setD('matricula', v.slice(0, 40))} placeholder="MN / MP"
                      placeholderTextColor={C.gris} autoCapitalize="characters" />
                  </Campo>
                  <Campo label="Especialidades" error={errores.especialidades}>
                    <Multi opciones={cfg.especialidades} valor={datos.especialidades} error={errores.especialidades}
                      onCambio={(v) => setD('especialidades', v)} />
                  </Campo>
                  <Toggle valor={datos.urgencias24h} onCambio={(v) => setD('urgencias24h', v)}
                    titulo="Atendemos urgencias 24 h" texto="Los dueños pueden marcar su pedido como urgente y te llega destacado." />
                  <Toggle valor={datos.aDomicilio} onCambio={(v) => setD('aDomicilio', v)}
                    titulo="Atención a domicilio" texto="El dueño puede pedir que vayas a su casa." />
                </View>
              )}

              {tipo === 'peluqueria' && (
                <View style={[s.card, { marginTop: 14 }]}>
                  <Text style={s.cardTitulo}>A quiénes atendés</Text>
                  <Campo label="Especies" error={errores.especies}>
                    <Multi opciones={ESPECIES} valor={datos.especies} error={errores.especies}
                      onCambio={(v) => setD('especies', v)} />
                  </Campo>
                  <Campo label="Tamaños" error={errores.tamanos}>
                    <Multi opciones={TAMANOS.map((t) => ({ key: t.key, label: `${t.label} (${t.detalle})` }))}
                      valor={datos.tamanos} error={errores.tamanos} onCambio={(v) => setD('tamanos', v)} />
                  </Campo>
                  <Toggle valor={datos.buscaYLleva} onCambio={(v) => setD('buscaYLleva', v)}
                    titulo="Buscamos y llevamos" texto="Pasás a buscar la mascota y la devolvés en su casa." />
                </View>
              )}

              {tipo === 'petshop' && (
                <View style={[s.card, { marginTop: 14 }]}>
                  <Text style={s.cardTitulo}>Ventas y envíos</Text>
                  <Toggle valor={datos.envios} onCambio={(v) => setD('envios', v)}
                    titulo="Hacemos envíos a domicilio" texto="Si no, los clientes retiran en el local." />
                  {datos.envios && (
                    <View style={s.fila}>
                      <View style={{ flex: 1 }}>
                        <Campo label="Costo del envío" error={errores.envioCosto}>
                          <View style={[s.input, s.monto, errores.envioCosto && s.inputError]}>
                            <Text style={s.signo}>$</Text>
                            <TextInput style={s.montoInput} value={datos.envioCosto} keyboardType="number-pad"
                              placeholder="0" placeholderTextColor={C.gris}
                              onChangeText={(v) => setD('envioCosto', sanitizarDigitos(v, 7))} />
                          </View>
                        </Campo>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Campo label="Gratis desde">
                          <View style={[s.input, s.monto]}>
                            <Text style={s.signo}>$</Text>
                            <TextInput style={s.montoInput} value={datos.envioGratisDesde} keyboardType="number-pad"
                              placeholder="Nunca" placeholderTextColor={C.gris}
                              onChangeText={(v) => setD('envioGratisDesde', sanitizarDigitos(v, 8))} />
                          </View>
                        </Campo>
                      </View>
                    </View>
                  )}
                  {datos.envios && (
                    <Campo label="Hasta cuántos km enviás">
                      <View style={[s.input, s.monto]}>
                        <TextInput style={s.montoInput} value={datos.radioEnvioKm} keyboardType="number-pad"
                          placeholder="3" placeholderTextColor={C.gris}
                          onChangeText={(v) => setD('radioEnvioKm', sanitizarDigitos(v, 2))} />
                        <Text style={s.unidad}>km</Text>
                      </View>
                    </Campo>
                  )}
                  <Campo label="Pedido mínimo (opcional)">
                    <View style={[s.input, s.monto]}>
                      <Text style={s.signo}>$</Text>
                      <TextInput style={s.montoInput} value={datos.pedidoMinimo} keyboardType="number-pad"
                        placeholder="Sin mínimo" placeholderTextColor={C.gris}
                        onChangeText={(v) => setD('pedidoMinimo', sanitizarDigitos(v, 8))} />
                    </View>
                  </Campo>
                  <Campo label="Medios de pago que aceptás" error={errores.mediosPago}>
                    <Multi opciones={MEDIOS_PAGO_NEGOCIO} valor={datos.mediosPago} error={errores.mediosPago}
                      onCambio={(v) => setD('mediosPago', v)} />
                  </Campo>
                </View>
              )}
            </>
          )}

          {Object.values(errores).some(Boolean) && (
            <View style={s.resumen}>
              <Text style={s.resumenTitulo}>Para continuar es necesario:</Text>
              {Object.values(errores).filter(Boolean).map((m) => (
                <Text key={m} style={s.resumenItem}>• {m}</Text>
              ))}
            </View>
          )}
          {errorGeneral && <Text style={s.errorGeneral}>{errorGeneral}</Text>}

          <PillButton
            titulo={paso === 1 ? 'Continuar' : `¡Abrir mi ${cfg.label.toLowerCase()}!`}
            onPress={continuar}
            cargando={cargando}
            style={{ marginTop: 18 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fondo, overflow: 'hidden' },
  top: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.menta, paddingHorizontal: 12, paddingVertical: 12,
  },
  volver: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitulo: { fontSize: 20, fontWeight: '800', color: C.texto },
  topSub: { fontSize: 12, fontWeight: '600', color: C.teal, marginTop: 1 },
  topIcono: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  progreso: { height: 4, backgroundColor: C.menta },
  progresoFill: { height: 4, backgroundColor: C.teal, borderTopRightRadius: 2, borderBottomRightRadius: 2 },

  scroll: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 18, ...sombra },
  cardTitulo: { fontSize: 17, fontWeight: '900', color: C.texto, marginBottom: 10 },
  intro: { fontSize: 14, color: C.texto2, lineHeight: 20, marginBottom: 16 },
  fila: { flexDirection: 'row', gap: 10 },

  label: { fontSize: 13, fontWeight: '700', color: C.texto, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.texto, backgroundColor: '#FFFFFF',
  },
  inputError: { borderColor: C.rojo },
  inputPassWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 },
  inputPass: { flex: 1, paddingVertical: 12, fontSize: 15, color: C.texto },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  errorCampo: { fontSize: 12, color: C.rojo, marginTop: 4 },
  ayuda: { fontSize: 12, color: C.texto2, marginTop: 4 },

  monto: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 },
  signo: { fontSize: 16, fontWeight: '900', color: C.texto, marginRight: 4 },
  montoInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: C.texto, minWidth: 0 },
  unidad: { fontSize: 13, fontWeight: '700', color: C.texto2 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1.5, borderColor: C.menta,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF',
  },
  chipOn: { backgroundColor: C.teal, borderColor: C.teal },
  chipTxt: { fontSize: 13, fontWeight: '700', color: C.texto },
  chipTxtOn: { color: '#FFFFFF' },

  toggle: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1.5,
    borderColor: '#EEEEEE', padding: 12, marginBottom: 10,
  },
  toggleOn: { borderColor: C.menta, backgroundColor: '#F6FFF9' },
  toggleTitulo: { fontSize: 14, fontWeight: '800', color: C.texto },
  toggleTxt: { fontSize: 12, color: C.texto2, marginTop: 2, lineHeight: 17 },

  logoFila: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  logo: {
    width: 88, height: 88, borderRadius: 22, borderWidth: 2, borderColor: C.teal, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: C.fondo,
  },
  logoImg: { width: '100%', height: '100%' },
  logoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, marginTop: 8,
    borderRadius: 18, borderWidth: 1.5, borderColor: C.teal, alignSelf: 'flex-start',
  },
  logoBtnTxt: { fontSize: 13, fontWeight: '800', color: C.teal },

  errorGeneral: {
    fontSize: 13, color: C.rojo, marginTop: 14, padding: 12, borderRadius: 12,
    backgroundColor: '#FDECEE', borderWidth: 1, borderColor: '#F5B7BD',
  },
  resumen: {
    marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: '#FDECEE',
    borderWidth: 1, borderColor: '#F5B7BD',
  },
  resumenTitulo: { fontSize: 13, fontWeight: '800', color: C.rojo, marginBottom: 4 },
  resumenItem: { fontSize: 13, color: C.texto, marginTop: 2 },
});
