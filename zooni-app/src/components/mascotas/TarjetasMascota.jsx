import React from 'react';
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { resolveMascotaVisual } from '../../constants/petImages';
import { formatearPeso } from '../../constants/pesoPorEspecie';
import { labelMotivo } from '../../services/petsApi';

import { colores } from '../../theme';

import { formatearFecha, parseFechaLocal } from '../../utils/fechaLocal';
import { capitalizar } from '../../utils/texto';

export const P = {
  bgTop: '#E4F9EA',
  surface: colores.blanco,
  surfaceArchived: '#F1F7F3',
  text: colores.texto,
  textSoft: colores.textoSecundario,
  textSoftMint: colores.verdeGrisaceo,
  brand: colores.verde,
  brandText: colores.verdeOscuro,
  ringArchived: '#7E9089',
  chipArchivedBg: '#E2EAE5',
  chipArchivedText: '#4A5550',
  cta: colores.amarillo,
  neutralBtn: '#EDF3EF',
  sosRedText: colores.rojoOscuro,
  divider: colores.mentaGris,
  amberText: '#A05F00',
  ringMemorial: '#E8D9A8',
};

export function CardActiva({ m, onPress, onEditar, onArchivar, onMenu, disabled }) {
  const img = resolveMascotaVisual(m);
  const chips = [
    m.especie ? { icono: 'paw-outline', txt: capitalizar(m.especie) } : null,
    m.raza ? { icono: 'ribbon-outline', txt: m.raza } : null,
    m.edadTexto ? { icono: 'calendar-outline', txt: m.edadTexto } : null,
    m.peso != null ? { icono: 'barbell-outline', txt: formatearPeso(m.peso) } : null,
  ].filter(Boolean);

  return (
    <Pressable
      style={[s.card, m.esPrincipal && s.cardPrincipal]}
      onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${m.nombre}${m.esPrincipal ? ', mascota principal' : ''}, ver detalle`}>

      {m.esPrincipal && (
        <View style={s.cintaPrincipal}>
          <Ionicons name="star" size={11} color={colores.blanco} />
          <Text style={s.cintaPrincipalTxt}>Principal</Text>
        </View>
      )}

      <TouchableOpacity style={s.cardMenu} onPress={onMenu} accessibilityRole="button"
        accessibilityLabel={`Más opciones de ${m.nombre}`}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="ellipsis-vertical" size={20} color={P.textSoft} />
      </TouchableOpacity>

      <View style={s.cardCuerpo}>
        <Image source={img}
          style={[s.avatarActiva, m.esPrincipal && s.avatarPrincipal]} resizeMode="cover" />
        <View style={s.cardDatos}>
          <Text style={s.nombreActiva} numberOfLines={1}>{m.nombre}</Text>
          <View style={s.chipsWrap}>
            {chips.map((c) => (
              <View key={c.txt} style={s.chipDato}>
                <Ionicons name={c.icono} size={11} color={P.textSoftMint} />
                <Text style={s.chipDatoTxt} numberOfLines={1}>{c.txt}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={s.botonesFila}>
        <TouchableOpacity style={[s.btnEditar, disabled && s.btnDisabled]} onPress={onEditar}
          disabled={disabled} accessibilityRole="button" accessibilityLabel={`Editar a ${m.nombre}`}>
          <Ionicons name="pencil" size={15} color={P.text} />
          <Text style={s.btnEditarTxt}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btnArchivar, disabled && s.btnDisabled]} onPress={onArchivar}
          disabled={disabled} accessibilityRole="button" accessibilityLabel={`Archivar a ${m.nombre}`}>
          <Ionicons name="archive-outline" size={15} color={P.brandText} />
          <Text style={s.btnArchivarTxt}>Archivar</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

export function CardArchivada({ m, onPress, onRecuperar, onMenu, disabled }) {
  const img = resolveMascotaVisual(m);
  const motivo = m.motivoArchivo === 'other' && m.motivoArchivoTexto
    ? m.motivoArchivoTexto
    : labelMotivo(m.motivoArchivo);
  return (
    <Pressable style={s.cardArchivada} onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${m.nombre}, archivada, ver detalle`}>
      <View style={s.chipArchivada}>
        <Ionicons name="archive-outline" size={12} color={P.chipArchivedText} />
        <Text style={s.chipArchivadaTxt}>Archivada</Text>
      </View>
      <TouchableOpacity style={s.cardMenu} onPress={onMenu} accessibilityRole="button"
        accessibilityLabel={`Más opciones de ${m.nombre}`}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="ellipsis-vertical" size={20} color={P.textSoft} />
      </TouchableOpacity>

      <View style={s.cardCuerpo}>
        <Image source={img} style={s.avatarArchivada} resizeMode="cover" />
        <View style={s.cardDatos}>
          <Text style={s.nombreArchivada} numberOfLines={1}>{m.nombre}</Text>
          <Text style={s.especieRazaFila} numberOfLines={1}>
            {capitalizar(m.especie)}{m.raza ? ` · ${m.raza}` : ''}
          </Text>
          {m.archivadaEn && (
            <Text style={s.fechaArchivo}>Archivada el {formatearFecha(m.archivadaEn, 'numericaCeros')}</Text>
          )}
          {motivo ? <Text style={s.motivoArchivo}>{motivo}</Text> : null}
        </View>
      </View>

      <TouchableOpacity style={[s.btnRecuperar, disabled && s.btnDisabled]} onPress={onRecuperar}
        disabled={disabled} accessibilityRole="button" accessibilityLabel={`Recuperar a ${m.nombre}`}>
        <Ionicons name="refresh-circle-outline" size={17} color={colores.blanco} />
        <Text style={s.btnRecuperarTxt}>Recuperar</Text>
      </TouchableOpacity>
    </Pressable>
  );
}

export function CardMemoria({ m, onPress, onMenu }) {
  const img = resolveMascotaVisual(m);
  const anioNac = parseFechaLocal(m.fechaNacimiento)?.getFullYear() ?? null;
  const anioFin = parseFechaLocal(m.fechaFallecimiento)?.getFullYear() ?? null;
  return (
    <View style={s.cardArchivada}>
      <TouchableOpacity style={s.cardMenu} onPress={onMenu} accessibilityRole="button"
        accessibilityLabel={`Más opciones de ${m.nombre}`}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="ellipsis-vertical" size={20} color={P.textSoft} />
      </TouchableOpacity>
      <View style={s.cardCuerpo}>
        <Image source={img} style={s.avatarMemoria} resizeMode="cover" />
        <View style={s.cardDatos}>
          <Text style={s.nombreArchivada} numberOfLines={1}>{m.nombre}</Text>
          {anioNac && anioFin && (
            <Text style={s.fechaArchivo}>{anioNac} – {anioFin}</Text>
          )}
        </View>
      </View>
      <TouchableOpacity style={s.btnRecuerdos} onPress={onPress}
        accessibilityRole="button" accessibilityLabel={`Ver recuerdos de ${m.nombre}`}>
        <Ionicons name="images-outline" size={16} color={P.brandText} />
        <Text style={s.btnRecuerdosTxt}>Ver recuerdos</Text>
      </TouchableOpacity>
    </View>
  );
}

export function TituloSeccion({ titulo, contador, icono }) {
  return (
    <View style={s.seccion}>
      <View style={s.seccionFila}>
        <Text style={s.seccionTitulo}>{titulo}</Text>
        {icono && <Ionicons name={icono} size={16} color={P.textSoftMint} style={{ marginLeft: 6 }} />}
        <View style={{ flex: 1 }} />
        <Text style={s.seccionContador}>({contador})</Text>
      </View>
      <View style={s.seccionLinea} />
    </View>
  );
}

export function SkeletonCard() {
  return <View style={s.skeleton} />;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: P.surface, borderRadius: 20, padding: 16,
    marginBottom: 12,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  cardPrincipal: { borderColor: P.brand, backgroundColor: '#F6FFFA', paddingTop: 26 },
  cintaPrincipal: {
    position: 'absolute', top: 0, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: P.brandText,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  cintaPrincipalTxt: { fontSize: 11, fontWeight: '700', color: colores.blanco },
  cardMenu: { position: 'absolute', top: 10, right: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  cardCuerpo: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 36 },
  avatarActiva: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: P.divider,
    backgroundColor: P.bgTop,
  },
  avatarPrincipal: { borderColor: P.brand, borderWidth: 3 },
  cardDatos:  { flex: 1, minWidth: 0 },
  nombreActiva: { fontSize: 19, fontWeight: '800', color: P.text },
  chipsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chipDato: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: P.neutralBtn, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
    maxWidth: '100%',
  },
  chipDatoTxt: { fontSize: 12, fontWeight: '600', color: P.textSoftMint, flexShrink: 1 },
  botonesFila: { flexDirection: 'row', gap: 12, marginTop: 14, alignSelf: 'stretch' },
  btnEditar: {
    flex: 1, height: 40, borderRadius: 20, backgroundColor: P.cta,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnDisabled:    { opacity: 0.45 },
  btnEditarTxt: { fontSize: 15, fontWeight: '700', color: P.text },
  btnArchivar: {
    flex: 1, height: 40, borderRadius: 20, backgroundColor: P.neutralBtn,
    borderWidth: 1.5, borderColor: P.brandText,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnArchivarTxt: { fontSize: 15, fontWeight: '700', color: P.brandText },
  cardArchivada: {
    backgroundColor: P.surfaceArchived, borderRadius: 20, padding: 16, paddingTop: 44,
    marginBottom: 12,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  chipArchivada: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: P.chipArchivedBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  chipArchivadaTxt: { fontSize: 11, fontWeight: '700', color: P.chipArchivedText },
  avatarArchivada: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: P.ringArchived,
    backgroundColor: P.bgTop, opacity: 0.9,
  },
  nombreArchivada: { fontSize: 18, fontWeight: '700', color: P.text },
  especieRazaFila: { fontSize: 13, color: P.textSoft, marginTop: 2 },
  fechaArchivo:    { fontSize: 12, color: P.textSoft, marginTop: 4 },
  motivoArchivo:   { fontSize: 12, fontWeight: '600', color: P.textSoftMint, marginTop: 2 },
  btnRecuperar: {
    alignSelf: 'stretch', height: 40, borderRadius: 20, backgroundColor: P.brandText,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14,
  },
  btnRecuperarTxt: { fontSize: 15, fontWeight: '700', color: colores.blanco },
  avatarMemoria: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: P.ringMemorial,
    backgroundColor: P.bgTop,
  },
  btnRecuerdos: {
    alignSelf: 'stretch', height: 40, borderRadius: 20, backgroundColor: colores.blanco,
    borderWidth: 1.5, borderColor: P.ringMemorial,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14,
  },
  btnRecuerdosTxt: { fontSize: 15, fontWeight: '700', color: P.brandText },
  seccion:         { marginTop: 22, marginBottom: 12 },
  seccionFila:     { flexDirection: 'row', alignItems: 'center' },
  seccionTitulo:   { fontSize: 17, fontWeight: '700', color: P.text },
  seccionContador: { fontSize: 14, fontWeight: '600', color: P.textSoftMint },
  seccionLinea:    { height: 2, backgroundColor: P.brandText, marginTop: 6, borderRadius: 1 },
  skeleton: { height: 240, borderRadius: 20, backgroundColor: '#EDF3EF', marginBottom: 12 },
});
