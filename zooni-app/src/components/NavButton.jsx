/**
 * NavButton.jsx — Botón de navegación reutilizable de la Home
 *
 * Usado en HomeScreen para los botones amarillos y el S.O.S rojo.
 *
 * Props:
 *   label            → texto del botón (ej: "Comunidad")
 *   iconName         → nombre del ícono Ionicons (ej: "people-outline")
 *   onPress          → función que se ejecuta al tocar
 *   variant          → 'primary' (amarillo) | 'danger' (rojo S.O.S)
 *   editMode         → si true, muestra ícono de drag y botón eliminar
 *   onDelete         → función para eliminar el botón en modo edición
 *   accessibilityLabel → texto para lectores de pantalla
 *
 * Animación: leve escala al presionar (0.97) usando Animated.spring
 */

import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NavButton({
  label,
  iconName,
  onPress,
  variant = 'primary',
  editMode = false,
  onDelete,
  accessibilityLabel,
}) {
  // Valor animado para el efecto de escala al presionar
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Al presionar: achica levemente el botón
  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();

  // Al soltar: vuelve al tamaño normal
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={accessibilityLabel ?? label}
        style={[styles.button, isPrimary ? styles.primary : styles.danger]}
      >
        {/* En modo edición: ícono de drag (⠿) en vez del ícono normal */}
        {editMode ? (
          <Ionicons name="reorder-three-outline" size={22} color="#888" style={styles.icon} />
        ) : (
          <Ionicons
            name={iconName}
            size={20}
            color={isPrimary ? '#2C2C2C' : '#FFFFFF'}
            style={styles.icon}
          />
        )}

        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelDanger]}>
          {label}
        </Text>

        {/* Botón eliminar (✖) — solo visible en modo edición */}
        {editMode && (
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={`Eliminar ${label}`}
          >
            <Ionicons name="close-circle" size={20} color="#E63946" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Estilo base compartido por todos los botones
  button: {
    height: 54,
    borderRadius: 30,           // Forma pill
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  primary: { backgroundColor: '#F5C842' },  // Amarillo dorado
  danger: {
    backgroundColor: '#E63946',             // Rojo S.O.S
    shadowColor: '#E63946',                 // Sombra roja
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  icon: { marginRight: 12 },
  label: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  labelPrimary: { color: '#2C2C2C' },
  labelDanger: { color: '#FFFFFF' },
});
