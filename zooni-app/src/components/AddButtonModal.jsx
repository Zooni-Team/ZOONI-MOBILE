/**
 * AddButtonModal.jsx — Modal para agregar secciones a la Home
 *
 * Se abre al tocar el FAB "+" (derecho) en la Home.
 * Muestra todas las secciones disponibles de la app.
 * Las que ya están activas en la Home aparecen en gris con tilde ✓.
 * Al tocar una sección disponible → se agrega como botón en la Home.
 *
 * Props:
 *   visible        → boolean que controla si el modal está abierto
 *   onClose        → función para cerrar el modal
 *   botonesActivos → array de botones actualmente en la Home
 *   onAdd          → función que recibe el key de la sección a agregar
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TODAS_LAS_SECCIONES } from '../services/secciones';

// Filtra "inicio" porque no tiene sentido agregarlo como botón (ya es la Home)
const SECCIONES_DISPONIBLES = TODAS_LAS_SECCIONES.filter((s) => s.key !== 'inicio');

export default function AddButtonModal({ visible, onClose, botonesActivos, onAdd }) {
  // Set con los keys de los botones que ya están activos en la Home
  const activeKeys = new Set(botonesActivos.filter((b) => b.visible).map((b) => b.seccion));

  return (
    // transparent: true → permite ver el fondo oscuro detrás del sheet
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Overlay oscuro — toca afuera para cerrar */}
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Manija visual del bottom sheet */}
          <View style={styles.handle} />

          {/* Header del modal */}
          <View style={styles.header}>
            <Text style={styles.title}>Agregar sección</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#2C2C2C" />
            </TouchableOpacity>
          </View>

          {/* Lista de secciones disponibles */}
          <FlatList
            data={SECCIONES_DISPONIBLES}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => {
              const isActive = activeKeys.has(item.key); // Ya está en la Home?
              return (
                <TouchableOpacity
                  style={[styles.item, isActive && styles.itemDisabled]}
                  // Si ya está activa, no hace nada al tocar
                  onPress={() => { if (!isActive) { onAdd(item.key); onClose(); } }}
                  disabled={isActive}
                >
                  {/* Ícono verde si disponible, gris si ya está activa */}
                  <Ionicons
                    name={item.icono}
                    size={22}
                    color={isActive ? '#AAAAAA' : '#2DBD72'}
                    style={styles.itemIcon}
                  />
                  <Text style={[styles.itemLabel, isActive && styles.itemLabelDisabled]}>
                    {item.label}
                  </Text>
                  {/* Tilde ✓ si ya está en la Home */}
                  {isActive && <Ionicons name="checkmark-circle" size={20} color="#AAAAAA" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Fondo oscuro semitransparente
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  // Hoja blanca que sube desde abajo
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, maxHeight: '75%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D0D0', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 17, fontWeight: '700', color: '#2C2C2C' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  itemDisabled: { opacity: 0.5 },  // Gris para secciones ya activas
  itemIcon: { marginRight: 14 },
  itemLabel: { flex: 1, fontSize: 15, color: '#2C2C2C', fontWeight: '500' },
  itemLabelDisabled: { color: '#AAAAAA' },
});
