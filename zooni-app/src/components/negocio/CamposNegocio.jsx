/**
 * CamposNegocio.jsx — Piezas de formulario de Zooni Negocios
 *
 * Lo usan el registro (NegocioRegistroScreen) y "Mi negocio" (MiNegocioTab),
 * así los dos piden exactamente lo mismo:
 *
 *   Campo · Multi · Toggle · CampoMonto   piezas sueltas con el diseño de Zooni
 *   DatosTipoNegocio                       la card con lo propio de cada tipo
 *   datosInicialesNegocio(tipo, datos?)    estado del formulario (números como texto)
 *   validarDatosNegocio(tipo, datos)       { campo: mensaje } de lo que falta
 *   datosNegocioParaGuardar(tipo, datos)   lo que va a negocio_perfil.datos
 *
 * Lo propio de cada tipo:
 *   · Veterinaria: matrícula (obligatoria), especialidades, especies que
 *     atiende, urgencias 24 h (con teléfono de guardia) y atención a domicilio.
 *   · Peluquería: especies y tamaños que atiende, busca y lleva (con su costo)
 *     y si usa productos hipoalergénicos.
 *   · Pet shop: envíos (costo, gratis desde, radio y demora), pedido mínimo y
 *     medios de pago.
 */

import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C, sombra } from '../paseador/PaseadorUI';
import { MEDIOS_PAGO_NEGOCIO, TAMANOS, configNegocio } from '../../constants/negocios';
import { sanitizarDigitos } from '../../utils/sanitizar';

export const ESPECIES_NEGOCIO = [
  { key: 'perro', label: 'Perros', icono: 'paw' },
  { key: 'gato', label: 'Gatos', icono: 'paw-outline' },
  { key: 'exoticos', label: 'Exóticos', icono: 'leaf-outline' },
];

export const DEMORAS_ENVIO = ['En el día', '24 h', '48 h', 'A coordinar'];

// ─── Piezas sueltas ─────────────────────────────────────────────────────────

export function Campo({ label, error, ayuda, children, style }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Text style={f.label}>{label}</Text> : null}
      {children}
      {ayuda && !error ? <Text style={f.ayuda}>{ayuda}</Text> : null}
      {error ? <Text style={f.error}>{error}</Text> : null}
    </View>
  );
}

/** Chips de selección múltiple. `opciones`: strings u objetos { key, label, icono }. */
export function Multi({ opciones, valor, onCambio, error }) {
  return (
    <View style={f.chips}>
      {opciones.map((o) => {
        const key = o.key ?? o;
        const on = valor.includes(key);
        return (
          <TouchableOpacity key={key} style={[f.chip, on && f.chipOn, error && !valor.length && f.inputError]}
            onPress={() => onCambio(on ? valor.filter((x) => x !== key) : [...valor, key])}
            accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
            {o.icono ? <Ionicons name={o.icono} size={14} color={on ? '#FFF' : C.teal} /> : null}
            <Text style={[f.chipTxt, on && f.chipTxtOn]}>{o.label ?? o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Chips de selección única. */
export function Unico({ opciones, valor, onCambio }) {
  return (
    <View style={f.chips}>
      {opciones.map((o) => {
        const key = o.key ?? o;
        const on = valor === key;
        return (
          <TouchableOpacity key={key} style={[f.chip, on && f.chipOn]} onPress={() => onCambio(key)}
            accessibilityRole="radio" accessibilityState={{ selected: on }}>
            {o.icono ? <Ionicons name={o.icono} size={14} color={on ? '#FFF' : C.teal} /> : null}
            <Text style={[f.chipTxt, on && f.chipTxtOn]}>{o.label ?? o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Toggle({ valor, onCambio, titulo, texto }) {
  return (
    <TouchableOpacity style={[f.toggle, valor && f.toggleOn]} onPress={() => onCambio(!valor)}
      accessibilityRole="switch" accessibilityState={{ checked: valor }} activeOpacity={0.85}>
      <Ionicons name={valor ? 'checkbox' : 'square-outline'} size={22} color={valor ? C.teal : C.gris} />
      <View style={{ flex: 1 }}>
        <Text style={f.toggleTitulo}>{titulo}</Text>
        {texto ? <Text style={f.toggleTxt}>{texto}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

/** Input de plata ("$ 1200") o de una cantidad con unidad ("3 km"). */
export function CampoMonto({ valor, onCambio, placeholder = '0', error, unidad, signo = '$', maxDigitos = 8 }) {
  return (
    <View style={[f.input, f.monto, error && f.inputError]}>
      {signo ? <Text style={f.signo}>{signo}</Text> : null}
      <TextInput style={f.montoInput} value={valor} keyboardType="number-pad"
        placeholder={placeholder} placeholderTextColor={C.gris}
        onChangeText={(v) => onCambio(sanitizarDigitos(v, maxDigitos))} />
      {unidad ? <Text style={f.unidad}>{unidad}</Text> : null}
    </View>
  );
}

export function InputTexto({ error, style, ...props }) {
  return (
    <TextInput style={[f.input, error && f.inputError, style]} placeholderTextColor={C.gris} {...props} />
  );
}

// ─── Estado, validación y guardado de lo propio de cada tipo ────────────────

const aTexto = (n) => (n === null || n === undefined || n === '' ? '' : String(n));
const aNumero = (t) => Number(t) || 0;

/** Estado del formulario. Con `datos` (los guardados) arranca con esos valores. */
export function datosInicialesNegocio(tipo, datos = {}) {
  const d = datos ?? {};
  if (tipo === 'veterinaria') {
    return {
      ...d,
      matricula: d.matricula ?? '',
      especialidades: d.especialidades ?? ['Clínica general'],
      especies: d.especies ?? ['perro', 'gato'],
      urgencias24h: !!d.urgencias24h,
      telefonoUrgencias: d.telefonoUrgencias ?? '',
      aDomicilio: !!d.aDomicilio,
    };
  }
  if (tipo === 'peluqueria') {
    return {
      ...d,
      especies: d.especies ?? ['perro'],
      tamanos: d.tamanos ?? TAMANOS.map((t) => t.key),
      buscaYLleva: !!d.buscaYLleva,
      buscaYLlevaCosto: aTexto(d.buscaYLlevaCosto),
      hipoalergenicos: !!d.hipoalergenicos,
    };
  }
  return {
    ...d,
    envios: d.envios ?? true,
    envioCosto: aTexto(d.envioCosto),
    envioGratisDesde: d.envioGratisDesde ? aTexto(d.envioGratisDesde) : '',
    radioEnvioKm: aTexto(d.radioEnvioKm ?? 3),
    demoraEnvio: d.demoraEnvio ?? 'En el día',
    pedidoMinimo: d.pedidoMinimo ? aTexto(d.pedidoMinimo) : '',
    mediosPago: d.mediosPago ?? ['efectivo', 'transferencia', 'mercadopago'],
  };
}

export function validarDatosNegocio(tipo, d) {
  const e = {};
  if (tipo === 'veterinaria') {
    if ((d.matricula ?? '').trim().length < 3) e.matricula = 'Es necesaria la matrícula profesional';
    if (!d.especialidades?.length) e.especialidades = 'Elegí al menos una especialidad';
    if (!d.especies?.length) e.especies = 'Elegí qué animales atendés';
    if (d.urgencias24h && (d.telefonoUrgencias ?? '').length < 8) {
      e.telefonoUrgencias = 'Para urgencias 24 h es necesario un teléfono de guardia';
    }
  }
  if (tipo === 'peluqueria') {
    if (!d.tamanos?.length) e.tamanos = 'Elegí al menos un tamaño';
    if (!d.especies?.length) e.especies = 'Elegí perros, gatos o los dos';
  }
  if (tipo === 'petshop') {
    if (!d.mediosPago?.length) e.mediosPago = 'Elegí al menos un medio de pago';
    if (d.envios && d.envioCosto === '') e.envioCosto = 'Escribí cuánto cobrás el envío (0 si es gratis)';
    if (d.envios && !(aNumero(d.radioEnvioKm) > 0)) e.radioEnvioKm = 'Escribí hasta cuántos km enviás';
  }
  return e;
}

export function datosNegocioParaGuardar(tipo, d) {
  if (tipo === 'veterinaria') {
    return {
      ...d,
      matricula: d.matricula.trim(),
      telefonoUrgencias: d.urgencias24h ? d.telefonoUrgencias : '',
    };
  }
  if (tipo === 'peluqueria') {
    return { ...d, buscaYLlevaCosto: d.buscaYLleva ? aNumero(d.buscaYLlevaCosto) : 0 };
  }
  return {
    ...d,
    envioCosto: aNumero(d.envioCosto),
    envioGratisDesde: aNumero(d.envioGratisDesde),
    radioEnvioKm: aNumero(d.radioEnvioKm),
    pedidoMinimo: aNumero(d.pedidoMinimo),
  };
}

// ─── La card con lo propio de cada tipo ─────────────────────────────────────

/**
 * Props: tipo · datos (de datosInicialesNegocio) · onCambio(campo, valor) ·
 *        errores ({ campo: mensaje }) · style
 */
export function DatosTipoNegocio({ tipo, datos, onCambio, errores = {}, style }) {
  const cfg = configNegocio(tipo);

  if (tipo === 'veterinaria') {
    return (
      <View style={[f.card, style]}>
        <Text style={f.cardTitulo}>Tu práctica</Text>
        <Campo label="Matrícula profesional" error={errores.matricula} ayuda="Ej: MN 12345 · Se muestra en tu ficha.">
          <InputTexto value={datos.matricula} error={errores.matricula} autoCapitalize="characters"
            onChangeText={(v) => onCambio('matricula', v.slice(0, 40))} placeholder="MN / MP" />
        </Campo>
        <Campo label="Especialidades" error={errores.especialidades}>
          <Multi opciones={cfg.especialidades} valor={datos.especialidades} error={errores.especialidades}
            onCambio={(v) => onCambio('especialidades', v)} />
        </Campo>
        <Campo label="Qué animales atendés" error={errores.especies}>
          <Multi opciones={ESPECIES_NEGOCIO} valor={datos.especies} error={errores.especies}
            onCambio={(v) => onCambio('especies', v)} />
        </Campo>
        <Toggle valor={datos.urgencias24h} onCambio={(v) => onCambio('urgencias24h', v)}
          titulo="Atendemos urgencias 24 h"
          texto="Los dueños pueden pedir un turno urgente a cualquier hora y te llega destacado en rojo." />
        {datos.urgencias24h && (
          <Campo label="Teléfono de guardia" error={errores.telefonoUrgencias}
            ayuda="Aparece en tu ficha con un botón para llamar directo.">
            <InputTexto value={datos.telefonoUrgencias} error={errores.telefonoUrgencias} keyboardType="phone-pad"
              onChangeText={(v) => onCambio('telefonoUrgencias', sanitizarDigitos(v, 15))} placeholder="11 2345 6789" />
          </Campo>
        )}
        <Toggle valor={datos.aDomicilio} onCambio={(v) => onCambio('aDomicilio', v)}
          titulo="Atención a domicilio" texto="El dueño puede pedir que vayas a su casa al sacar el turno." />
      </View>
    );
  }

  if (tipo === 'peluqueria') {
    return (
      <View style={[f.card, style]}>
        <Text style={f.cardTitulo}>A quiénes atendés</Text>
        <Campo label="Especies" error={errores.especies}>
          <Multi opciones={ESPECIES_NEGOCIO.slice(0, 2)} valor={datos.especies} error={errores.especies}
            onCambio={(v) => onCambio('especies', v)} />
        </Campo>
        <Campo label="Tamaños" error={errores.tamanos} ayuda="Con el peso de la mascota calculamos el precio de cada turno.">
          <Multi opciones={TAMANOS.map((t) => ({ key: t.key, label: `${t.label} (${t.detalle})` }))}
            valor={datos.tamanos} error={errores.tamanos} onCambio={(v) => onCambio('tamanos', v)} />
        </Campo>
        <Toggle valor={datos.buscaYLleva} onCambio={(v) => onCambio('buscaYLleva', v)}
          titulo="Buscamos y llevamos" texto="Pasás a buscar la mascota y la devolvés en su casa." />
        {datos.buscaYLleva && (
          <Campo label="¿Cuánto cobrás el busca y lleva?" ayuda="0 si es gratis. Se suma al precio del turno.">
            <CampoMonto valor={datos.buscaYLlevaCosto} onCambio={(v) => onCambio('buscaYLlevaCosto', v)} maxDigitos={7} />
          </Campo>
        )}
        <Toggle valor={datos.hipoalergenicos} onCambio={(v) => onCambio('hipoalergenicos', v)}
          titulo="Usamos productos hipoalergénicos" texto="Se muestra como un sello en tu ficha." />
      </View>
    );
  }

  return (
    <View style={[f.card, style]}>
      <Text style={f.cardTitulo}>Ventas y envíos</Text>
      <Toggle valor={datos.envios} onCambio={(v) => onCambio('envios', v)}
        titulo="Hacemos envíos a domicilio" texto="Si no, los clientes retiran en el local." />
      {datos.envios && (
        <>
          <View style={f.fila}>
            <Campo label="Costo del envío" error={errores.envioCosto} style={{ flex: 1 }}>
              <CampoMonto valor={datos.envioCosto} error={errores.envioCosto} maxDigitos={7}
                onCambio={(v) => onCambio('envioCosto', v)} />
            </Campo>
            <Campo label="Gratis desde" style={{ flex: 1 }}>
              <CampoMonto valor={datos.envioGratisDesde} placeholder="Nunca"
                onCambio={(v) => onCambio('envioGratisDesde', v)} />
            </Campo>
          </View>
          <Campo label="Hasta cuántos km enviás" error={errores.radioEnvioKm}>
            <CampoMonto valor={datos.radioEnvioKm} error={errores.radioEnvioKm} signo={null} unidad="km"
              placeholder="3" maxDigitos={2} onCambio={(v) => onCambio('radioEnvioKm', v)} />
          </Campo>
          <Campo label="¿En cuánto llega?">
            <Unico opciones={DEMORAS_ENVIO} valor={datos.demoraEnvio} onCambio={(v) => onCambio('demoraEnvio', v)} />
          </Campo>
        </>
      )}
      <Campo label="Pedido mínimo (opcional)">
        <CampoMonto valor={datos.pedidoMinimo} placeholder="Sin mínimo" onCambio={(v) => onCambio('pedidoMinimo', v)} />
      </Campo>
      <Campo label="Medios de pago que aceptás" error={errores.mediosPago}>
        <Multi opciones={MEDIOS_PAGO_NEGOCIO} valor={datos.mediosPago} error={errores.mediosPago}
          onCambio={(v) => onCambio('mediosPago', v)} />
      </Campo>
    </View>
  );
}

/** Hook chico para el estado de DatosTipoNegocio con su limpieza de errores. */
export function useDatosNegocio(tipo, guardados) {
  const [datos, setDatos] = useState(() => datosInicialesNegocio(tipo, guardados));
  const [errores, setErrores] = useState({});
  const cambiar = (k, v) => {
    setDatos((d) => ({ ...d, [k]: v }));
    setErrores((e) => ({ ...e, [k]: null }));
  };
  const reiniciar = (nuevos) => { setDatos(datosInicialesNegocio(tipo, nuevos)); setErrores({}); };
  return { datos, cambiar, errores, setErrores, reiniciar };
}

const f = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 18, ...sombra },
  cardTitulo: { fontSize: 17, fontWeight: '900', color: C.texto, marginBottom: 10 },
  fila: { flexDirection: 'row', gap: 10 },

  label: { fontSize: 13, fontWeight: '700', color: C.texto, marginBottom: 6 },
  ayuda: { fontSize: 12, color: C.texto2, marginTop: 4 },
  error: { fontSize: 12, color: C.rojo, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.texto, backgroundColor: '#FFFFFF',
  },
  inputError: { borderColor: C.rojo },

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
});
