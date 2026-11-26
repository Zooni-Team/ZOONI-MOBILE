import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TODAS_LAS_SECCIONES } from '../services/secciones';
import { colores } from '../theme';

const SECCIONES_DISPONIBLES = TODAS_LAS_SECCIONES.filter((s) => s.key !== 'inicio');

export default function AddButtonModal({ visible, onClose, botonesActivos, onAdd }) {
  const activeKeys = new Set(botonesActivos.filter((b) => b.visible).map((b) => b.seccion));
  const atLimit = botonesActivos.filter((b) => b.visible).length >= 4;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Agregar sección</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colores.texto} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={SECCIONES_DISPONIBLES}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => {
              const isActive = activeKeys.has(item.key);
              const isDisabled = isActive || atLimit;
              return (
                <TouchableOpacity
                  style={[styles.item, isDisabled && styles.itemDisabled]}
                  onPress={() => { if (!isDisabled) { onAdd(item.key); onClose(); } }}
                  disabled={isDisabled}
                >
                  <Ionicons
                    name={item.icono}
                    size={22}
                    color={isDisabled ? colores.textoTenue : colores.verde}
                    style={styles.itemIcon}
                  />
                  <Text style={[styles.itemLabel, isDisabled && styles.itemLabelDisabled]}>
                    {item.label}
                  </Text>
                  {isActive && <Ionicons name="checkmark-circle" size={20} color={colores.textoTenue} />}
                  {!isActive && atLimit && <Text style={styles.limitText}>Límite</Text>}
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
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colores.blanco, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, maxHeight: '75%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colores.gris410, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colores.gris300 },
  title: { fontSize: 17, fontWeight: '700', color: colores.texto },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colores.gris50 },
  itemDisabled: { opacity: 0.5 },
  itemIcon: { marginRight: 14 },
  itemLabel: { flex: 1, fontSize: 15, color: colores.texto, fontWeight: '500' },
  itemLabelDisabled: { color: colores.textoTenue },
  limitText: { fontSize: 11, color: colores.textoTenue, fontStyle: 'italic' },
});
