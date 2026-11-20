/**
 * FichaNegocioUI.jsx — Piezas chicas de la ficha pública de un negocio
 * (NegocioPublicoScreen): el sello (chip con ícono), el título de sección, la
 * próxima apertura y qué sellos mostrar según el tipo de negocio.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DIA_DE_JS, DIAS_SEMANA, TAMANOS } from '../../constants/negocios';
import { ESPECIES_NEGOCIO } from './CamposNegocio';
import { formatoPlata } from '../../domain/paseos';

import { horarioDelDia } from '../../domain/negocios';

import { colores } from '../../theme';

/** "Abre mañana a las 09:00" / "Abre el lunes a las 09:00" (o null si nunca abre). */
export function proximaApertura(horarios, ahora = new Date()) {
  for (let i = 0; i < 8; i += 1) {
    const d = new Date(ahora);
    d.setDate(ahora.getDate() + i);
    const h = horarioDelDia(horarios, d);
    if (!h.activo) continue;
    const [hh, mm] = h.desde.split(':').map(Number);
    const abre = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
    if (abre <= ahora) continue;
    const cuando = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${DIAS_SEMANA.find((x) => x.key === DIA_DE_JS[d.getDay()]).label.toLowerCase()}`;
    return `Abre ${cuando} a las ${h.desde}`;
  }
  return null;
}

export function Sello({ icono, texto, color = colores.verde, fondo = colores.mentaTarjeta }) {
  return (
    <View style={[s.sello, { backgroundColor: fondo }]}>
      <Ionicons name={icono} size={13} color={color} />
      <Text style={[s.selloTxt, { color }]}>{texto}</Text>
    </View>
  );
}

export function Titulo({ children, extra }) {
  return (
    <View style={s.tituloFila}>
      <Text style={s.titulo}>{children}</Text>
      {extra}
    </View>
  );
}

/**
 * Sellos (chips) que se muestran en la ficha según el tipo de negocio:
 * urgencias, a domicilio, especies, envíos, mínimo de compra…
 * Puro (sin base ni pantalla): devuelve [{ icono, texto, color?, fondo? }].
 */
export function sellosDeNegocio(negocio) {
  const d = negocio?.datos ?? {};
  const sellos = [];
  if (negocio.tipo === 'veterinaria') {
    if (d.urgencias24h) sellos.push({ icono: 'alert-circle', texto: 'Urgencias 24 h', color: colores.rojo, fondo: colores.rojoFondo });
    if (d.aDomicilio) sellos.push({ icono: 'home', texto: 'Atiende a domicilio', color: colores.azul, fondo: colores.azulFondo });
    (d.especies ?? []).forEach((e) => {
      const esp = ESPECIES_NEGOCIO.find((x) => x.key === e);
      if (esp) sellos.push({ icono: esp.icono, texto: esp.label });
    });
  }
  if (negocio.tipo === 'peluqueria') {
    if (d.buscaYLleva) {
      sellos.push({
        icono: 'car',
        texto: `Busca y lleva${Number(d.buscaYLlevaCosto) ? ` · ${formatoPlata(d.buscaYLlevaCosto)}` : ' gratis'}`
          + (Number(d.buscaYLlevaRadioKm) > 0 ? ` · hasta ${d.buscaYLlevaRadioKm} km` : ''),
        color: colores.azul, fondo: colores.azulFondo,
      });
    }
    if (d.hipoalergenicos) sellos.push({ icono: 'leaf', texto: 'Productos hipoalergénicos' });
    (d.especies ?? []).forEach((e) => {
      const esp = ESPECIES_NEGOCIO.find((x) => x.key === e);
      if (esp) sellos.push({ icono: esp.icono, texto: esp.label });
    });
    if (d.tamanos?.length && d.tamanos.length < TAMANOS.length) {
      sellos.push({ icono: 'resize', texto: `Sólo ${d.tamanos.map((t) => TAMANOS.find((x) => x.key === t)?.label.toLowerCase()).join(' y ')}`, color: colores.textoSecundario, fondo: colores.gris100 });
    }
  }
  if (negocio.tipo === 'petshop') {
    if (d.envios) {
      sellos.push({
        icono: 'bicycle',
        texto: `Envíos ${Number(d.envioCosto) ? formatoPlata(d.envioCosto) : 'gratis'} · ${d.demoraEnvio ?? 'a coordinar'}`,
        color: colores.azul, fondo: colores.azulFondo,
      });
      if (Number(d.envioGratisDesde)) sellos.push({ icono: 'gift', texto: `Envío gratis desde ${formatoPlata(d.envioGratisDesde)}` });
    } else {
      sellos.push({ icono: 'storefront', texto: 'Sólo retiro en el local', color: colores.textoSecundario, fondo: colores.gris100 });
    }
    if (Number(d.pedidoMinimo)) sellos.push({ icono: 'cart', texto: `Mínimo ${formatoPlata(d.pedidoMinimo)}`, color: colores.textoSecundario, fondo: colores.gris100 });
  }
  return sellos;
}

const s = StyleSheet.create({
  sello: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  selloTxt: { fontSize: 12, fontWeight: '800' },
  tituloFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  titulo: { fontSize: 18, fontWeight: '900', color: colores.texto },
});
