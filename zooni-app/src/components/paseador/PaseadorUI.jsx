/**
 * PaseadorUI.jsx — Piezas visuales de Zooni Paseadores
 *
 * Misma paleta y mismos botones pill que Zooni (ver Instruction-PaseadoresDiseño.md).
 * La diferencia está en la estructura: fondo blanco roto de "panel de control",
 * verde menta sólo como acento, y números grandes en el peso más pesado.
 */

import { useEffect, useRef } from 'react';
import {
  ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const C = {
  fondo: '#F9FFF9',
  menta: '#C8F0D8',
  card: '#FFFFFF',
  amarillo: '#F5C842',
  crema: '#F7D060',
  rojo: '#E63946',
  teal: '#2DBD72',
  texto: '#2C2C2C',
  texto2: '#6B6B6B',
  burbujaYo: '#A8E6C0',
  ambar: '#F5A623',
  gris: '#AAAAAA',
  borde: '#E6EFE9',
};

export const sombra = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 3,
};

// ─── Botón pill ─────────────────────────────────────────────────────────────
// variante: 'primario' (amarillo) | 'secundario' (outline teal) |
//           'peligro' (rojo) | 'teal' (verde sólido, ej. "Ingresar")
export function PillButton({
  titulo, onPress, variante = 'primario', icono, cargando = false, disabled = false,
  chico = false, style, accessibilityLabel,
}) {
  const v = VARIANTES[variante] ?? VARIANTES.primario;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || cargando}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? titulo}
      style={[
        ui.pill, chico && ui.pillChico, v.caja,
        (disabled && !cargando) && ui.pillDisabled, style,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={v.texto.color} />
      ) : (
        <View style={ui.pillFila}>
          {icono ? <Ionicons name={icono} size={chico ? 16 : 20} color={v.texto.color} /> : null}
          <Text style={[ui.pillTxt, chico && ui.pillTxtChico, v.texto]} numberOfLines={1}>{titulo}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const VARIANTES = {
  primario: { caja: { backgroundColor: C.amarillo }, texto: { color: C.texto } },
  secundario: {
    caja: { backgroundColor: C.card, borderWidth: 2, borderColor: C.teal, shadowOpacity: 0 },
    texto: { color: C.teal },
  },
  peligro: { caja: { backgroundColor: C.rojo }, texto: { color: '#FFFFFF' } },
  teal: { caja: { backgroundColor: C.teal }, texto: { color: '#FFFFFF' } },
};

// ─── Card ───────────────────────────────────────────────────────────────────
export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [ui.card, pressed && { opacity: 0.92 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[ui.card, style]}>{children}</View>;
}

// ─── Chip de estado ─────────────────────────────────────────────────────────
export function Chip({ texto, icono, color = C.teal, fondo = C.menta, style }) {
  return (
    <View style={[ui.chip, { backgroundColor: fondo }, style]}>
      {icono ? <Ionicons name={icono} size={13} color={color} /> : null}
      <Text style={[ui.chipTxt, { color }]}>{texto}</Text>
    </View>
  );
}

// ─── Stat: número grande + etiqueta ─────────────────────────────────────────
export function Stat({ valor, etiqueta, icono, grande = false, style }) {
  return (
    <View style={[ui.stat, style]}>
      {icono ? <Ionicons name={icono} size={18} color={C.teal} style={{ marginBottom: 4 }} /> : null}
      <Text style={[ui.statValor, grande && ui.statValorGrande]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={ui.statEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

// ─── Avatar redondo (foto real o iniciales) ─────────────────────────────────
export function Avatar({ fuente, uri, nombre = '', size = 44, borde = false }) {
  const src = fuente ?? (uri ? { uri } : null);
  const iniciales = nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
  const dim = { width: size, height: size, borderRadius: size / 2 };
  return src ? (
    <Image source={src} style={[dim, borde && ui.avatarBorde, { backgroundColor: C.menta }]} />
  ) : (
    <View style={[dim, ui.avatarIni, borde && ui.avatarBorde]}>
      <Text style={[ui.avatarIniTxt, { fontSize: size * 0.38 }]}>{iniciales}</Text>
    </View>
  );
}

// ─── Título de sección ──────────────────────────────────────────────────────
export function Seccion({ titulo, accion, onAccion }) {
  return (
    <View style={ui.seccion}>
      <Text style={ui.seccionTxt}>{titulo}</Text>
      {accion ? (
        <TouchableOpacity onPress={onAccion} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={ui.seccionAccion}>{accion}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Estado vacío ───────────────────────────────────────────────────────────
export function Vacio({ icono = 'paw-outline', titulo, texto, children }) {
  return (
    <View style={ui.vacio}>
      <View style={ui.vacioIcono}>
        <Ionicons name={icono} size={34} color={C.teal} />
      </View>
      <Text style={ui.vacioTitulo}>{titulo}</Text>
      {texto ? <Text style={ui.vacioTexto}>{texto}</Text> : null}
      {children}
    </View>
  );
}

// ─── Switch grande "Disponible" ─────────────────────────────────────────────
// Es el control más importante de la app: grande, con área de toque generosa.
export function SwitchGrande({ valor, onCambio, disabled }) {
  const anim = useRef(new Animated.Value(valor ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: valor ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [valor, anim]);

  const x = anim.interpolate({ inputRange: [0, 1], outputRange: [4, 34] });
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [C.gris, C.teal] });

  return (
    <Pressable
      onPress={() => !disabled && onCambio(!valor)}
      accessibilityRole="switch"
      accessibilityState={{ checked: valor, disabled }}
      hitSlop={10}
    >
      <Animated.View style={[ui.switch, { backgroundColor: bg }]}>
        <Animated.View style={[ui.switchBola, { transform: [{ translateX: x }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const ui = StyleSheet.create({
  pill: {
    height: 54, borderRadius: 30, paddingHorizontal: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  pillChico: { height: 44, paddingHorizontal: 16 },
  pillDisabled: { opacity: 0.45 },
  pillFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillTxt: { fontSize: 16, fontWeight: '800' },
  pillTxtChico: { fontSize: 14 },

  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, ...sombra },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  chipTxt: { fontSize: 12, fontWeight: '700' },

  stat: { flex: 1, alignItems: 'flex-start' },
  statValor: { fontSize: 22, fontWeight: '900', color: C.texto },
  statValorGrande: { fontSize: 32 },
  statEtiqueta: { fontSize: 12, color: C.texto2, fontWeight: '600', marginTop: 2 },

  avatarIni: { backgroundColor: C.menta, alignItems: 'center', justifyContent: 'center' },
  avatarIniTxt: { color: C.teal, fontWeight: '800' },
  avatarBorde: { borderWidth: 2.5, borderColor: C.teal },

  seccion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 22, marginBottom: 10,
  },
  seccionTxt: { fontSize: 17, fontWeight: '800', color: C.texto },
  seccionAccion: { fontSize: 14, fontWeight: '700', color: C.teal },

  vacio: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  vacioIcono: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.menta,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  vacioTitulo: { fontSize: 17, fontWeight: '800', color: C.texto, textAlign: 'center' },
  vacioTexto: { fontSize: 14, color: C.texto2, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  switch: { width: 72, height: 42, borderRadius: 21, justifyContent: 'center' },
  switchBola: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
  },
});
