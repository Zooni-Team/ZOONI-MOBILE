/**
 * SettingsKit.jsx — Componentes compartidos de Configuración (Instruction-Configuracion v1.0)
 *
 * Única fuente de tokens y controles para el índice y las 11 sub-pantallas.
 * Reglas duras que este kit garantiza:
 *   - Texto sobre menta usa --text-soft-mint (#6B6B6B no llega a 4.5:1).
 *   - Chevron #8A8A8A (el #AAAAAA no llega al 3:1 de gráficos).
 *   - Switch encendido en --brand-text #177046 (el #2DBD72 con knob blanco
 *     da 2.43:1 y no distingue estados).
 *   - Filas con cambio de fondo al presionar, nunca scale.
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../config/theme';

// ─── TOKENS (§3.1) ───────────────────────────────────────────────────────────

export const T = {
  bgMain: '#C8F0D8',
  bgMainSoft: '#D9F6E4',
  surface: '#FFFFFF',
  text: '#2C2C2C',
  textSoft: '#6B6B6B',
  textSoftMint: '#5A6B60',
  chevron: '#8A8A8A',
  divider: '#E8EFE9',
  brand: '#2DBD72',
  brandText: '#177046',
  amberText: '#A05F00',
  amberTint: '#FEF3E0',
  sosRedText: '#B3121D',
  sosRedTint: '#FDECEE',
  cta: '#F5C842',
  switchOff: '#D8DEDA',
  pressedRow: '#F2F7F4',
};

// Tintes de ícono por grupo temático (§3.1)
export const TINTS = {
  cuenta:        { bg: '#E8EEFB', glifo: '#3A5CA8' },
  apariencia:    { bg: '#FDEAF2', glifo: '#A83A6B' },
  medios:        { bg: '#EAF1F7', glifo: '#2F6B8F' },
  tiempo:        { bg: '#F1EDFB', glifo: '#5A3AA8' },
  mascotas:      { bg: '#E8F7EE', glifo: '#177046' },
  privacidad:    { bg: '#FEF3E0', glifo: '#8A5A00' },
  permisos:      { bg: '#EDEBFA', glifo: '#4A3AA0' },
  notificaciones:{ bg: '#FEF6DC', glifo: '#8A6A00' },
  pagos:         { bg: '#E6F4FB', glifo: '#1A6A8F' },
  legal:         { bg: '#EFF1F3', glifo: '#4A5560' },
  ayuda:         { bg: '#FDECEE', glifo: '#B3121D' },
};

// ─── CHASIS DE SUB-PANTALLA (§3.5) ──────────────────────────────────────────

export function SettingsScreen({ title, children }) {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={k.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={k.subHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={k.subHeaderBtn}
          accessibilityRole="button" accessibilityLabel="Volver"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={k.subHeaderTitle} numberOfLines={1}>{title}</Text>
        <View style={k.subHeaderBtn} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={k.subContent}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── GRUPO (label + card blanca) ─────────────────────────────────────────────

export function SettingsGroup({ label, children }) {
  const { highContrast } = useTheme();
  const hijos = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={k.group}>
      {label ? <Text style={k.groupLabel}>{label}</Text> : null}
      {/* Alto contraste: la tarjeta suma borde y los divisores se oscurecen */}
      <View style={[k.groupCard, highContrast && k.groupCardHC]} accessibilityRole="list">
        {hijos.map((child, i) => (
          <View key={i}>
            {child}
            {i < hijos.length - 1 && <View style={[k.rowDivider, highContrast && k.rowDividerHC]} />}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── FILA DE NAVEGACIÓN (§3.3.D) ─────────────────────────────────────────────

export function SettingsRow({ icon, tint, label, value, badge, disabled, onPress }) {
  const [pressed, setPressed] = useState(false);
  const tinte = tint ? TINTS[tint] : null;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[k.row, pressed && !disabled && { backgroundColor: T.pressedRow }, disabled && { opacity: 0.45 }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, botón`}
      accessibilityHint={`Abre ${label}`}
      accessibilityState={{ disabled: !!disabled }}
    >
      {tinte && (
        <View style={[k.rowIcon, { backgroundColor: tinte.bg }]}>
          <Ionicons name={icon} size={18} color={tinte.glifo} />
        </View>
      )}
      <Text style={k.rowLabel} numberOfLines={1}>{label}</Text>
      {value != null && <Text style={k.rowValue} numberOfLines={1}>{value}</Text>}
      {badge && <View style={k.rowBadge} />}
      {!disabled && <Ionicons name="chevron-forward" size={16} color={T.chevron} />}
    </Pressable>
  );
}

// ─── SWITCH (§3.5 SettingsToggle) ────────────────────────────────────────────

function Knob({ on }) {
  const { reduceMotion } = useTheme();
  const x = useRef(new Animated.Value(on ? 20 : 0)).current;
  React.useEffect(() => {
    // Con "reducir movimiento" el knob salta sin animar
    Animated.timing(x, {
      toValue: on ? 20 : 0,
      duration: reduceMotion ? 0 : 180,
      useNativeDriver: true,
    }).start();
  }, [on, x, reduceMotion]);
  return <Animated.View style={[k.knob, { transform: [{ translateX: x }] }]} />;
}

export function SettingsToggle({ label, apoyo, value, onChange, disabled }) {
  return (
    <Pressable
      onPress={disabled ? undefined : () => onChange(!value)}
      style={[k.toggleRow, disabled && { opacity: 0.45 }]}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: !!value, disabled: !!disabled }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={k.rowLabel}>{label}</Text>
        {apoyo ? <Text style={k.apoyo}>{apoyo}</Text> : null}
      </View>
      <View style={[k.rail, { backgroundColor: value ? T.brandText : T.switchOff }]}>
        <Knob on={!!value} />
      </View>
    </Pressable>
  );
}

// ─── SELECT (bottom sheet con radio list) ────────────────────────────────────

export function SettingsSelect({ label, apoyo, options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const actual = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        onPress={disabled ? undefined : () => setOpen(true)}
        style={[k.toggleRow, disabled && { opacity: 0.45 }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${actual?.label ?? ''}`}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={k.rowLabel}>{label}</Text>
          {apoyo ? <Text style={k.apoyo}>{apoyo}</Text> : null}
        </View>
        <Text style={k.rowValue}>{actual?.label ?? '—'}</Text>
        <Ionicons name="chevron-forward" size={16} color={T.chevron} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={k.sheetScrim} onPress={() => setOpen(false)}>
          <Pressable style={k.sheet} onPress={() => {}}>
            <View style={k.sheetHandle} />
            <Text style={k.sheetTitle}>{label}</Text>
            {options.map((o) => (
              <TouchableOpacity key={String(o.value)} style={k.sheetOption}
                onPress={() => { onChange(o.value); setOpen(false); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: o.value === value }}>
                <View style={{ flex: 1 }}>
                  <Text style={k.rowLabel}>{o.label}</Text>
                  {o.apoyo ? <Text style={k.apoyo}>{o.apoyo}</Text> : null}
                </View>
                {o.value === value && <Ionicons name="checkmark" size={20} color={T.brandText} />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── SLIDER ESCALONADO (marcas discretas tocables) ───────────────────────────

export function SettingsSlider({ label, steps, value, onChange }) {
  const idx = Math.max(0, steps.findIndex((s) => s.value === value));
  return (
    <View style={k.toggleRow}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={k.rowLabel}>{label}</Text>
          <Text style={k.rowValue}>{steps[idx]?.label}</Text>
        </View>
        <View style={k.sliderTrackWrap}>
          {steps.map((s, i) => (
            <TouchableOpacity key={String(s.value)} style={k.sliderStepHit}
              onPress={() => onChange(s.value)}
              accessibilityRole="adjustable" accessibilityLabel={`${label}: ${s.label}`}>
              <View style={[k.sliderMark, i <= idx && { backgroundColor: T.brandText }]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── ACCIÓN Y SOLO-LECTURA ───────────────────────────────────────────────────

export function SettingsAction({ label, apoyo, destructive, centered, onPress, disabled }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable onPress={disabled ? undefined : onPress}
      onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
      style={[k.row, pressed && !disabled && { backgroundColor: T.pressedRow }, disabled && { opacity: 0.45 }]}
      accessibilityRole="button" accessibilityLabel={label}>
      <View style={{ flex: 1, alignItems: centered ? 'center' : 'flex-start' }}>
        <Text style={[k.actionLabel, { color: destructive ? T.sosRedText : T.brandText }]}>{label}</Text>
        {apoyo ? <Text style={k.apoyo}>{apoyo}</Text> : null}
      </View>
    </Pressable>
  );
}

export function SettingsInfo({ label, value, apoyo }) {
  return (
    <View style={k.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={k.rowLabel}>{label}</Text>
        {apoyo ? <Text style={k.apoyo}>{apoyo}</Text> : null}
      </View>
      <Text style={k.rowValue}>{value}</Text>
    </View>
  );
}

// ─── BANNER DE ATENCIÓN (V3 / V4) ────────────────────────────────────────────

export function SettingsBanner({ icon, text, color = T.amberText, bg = T.amberTint, action, onAction }) {
  return (
    <View style={[k.banner, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[k.bannerTxt, { color }]}>{text}</Text>
      {action && (
        <TouchableOpacity onPress={onAction} accessibilityRole="button" accessibilityLabel={action}>
          <Text style={[k.bannerAction, { color }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const k = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.bgMain },

  subHeader: {
    height: 52, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
    marginTop: Platform.OS === 'android' ? 24 : 0,
  },
  subHeaderBtn:   { width: 40, alignItems: 'center', justifyContent: 'center' },
  subHeaderTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: T.text, textAlign: 'center' },
  subContent:     { paddingHorizontal: 16, paddingBottom: 40 },

  group:      { marginTop: 16 },
  groupLabel: { fontSize: 13, fontWeight: '700', color: T.textSoftMint, marginLeft: 4, marginBottom: 8 },
  groupCard: {
    backgroundColor: T.surface, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  groupCardHC: { borderWidth: 1.5, borderColor: T.text },
  rowDivider: { height: 1, backgroundColor: T.divider, marginLeft: 60 },
  rowDividerHC: { height: 1.5, backgroundColor: '#9AA5A0' },

  row: {
    minHeight: 56, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, gap: 12,
  },
  rowIcon:  { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 16, fontWeight: '600', color: T.text },
  rowValue: { fontSize: 14, color: T.textSoft, maxWidth: 150 },
  rowBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.amberText },
  apoyo:    { fontSize: 13, color: T.textSoft, marginTop: 3, lineHeight: 18 },

  toggleRow: {
    minHeight: 56, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  rail: { width: 50, height: 30, borderRadius: 15, padding: 2, justifyContent: 'center' },
  knob: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2,
  },

  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 24, paddingTop: 8,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: T.divider, marginBottom: 8 },
  sheetTitle:  { fontSize: 16, fontWeight: '700', color: T.text, textAlign: 'center', marginBottom: 8 },
  sheetOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 },

  sliderTrackWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 4 },
  sliderStepHit:   { flex: 1, height: 32, alignItems: 'center', justifyContent: 'center' },
  sliderMark:      { height: 8, width: '100%', borderRadius: 4, backgroundColor: T.switchOff },

  actionLabel: { fontSize: 16, fontWeight: '700' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12, marginTop: 16,
  },
  bannerTxt:    { flex: 1, fontSize: 13, lineHeight: 18 },
  bannerAction: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});
