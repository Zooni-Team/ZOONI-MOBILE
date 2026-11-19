/**
 * BotonesHome.jsx — Los accesos del Inicio: los botones amarillos que eligió
 * el usuario (se reordenan arrastrando y se quitan en modo edición) y, siempre
 * último, el SOS Veterinario.
 *
 * Qué botones hay y en qué orden lo maneja hooks/useHome; acá sólo se dibujan.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import DraggableList from '../DraggableList';
import NavButton from '../NavButton';
import { SkeletonBloque } from '../ui/Skeleton';
import { getSeccion } from '../../services/secciones';
import { colores, sombras } from '../../theme';

/**
 * @param {Array}     botones      [{ seccion }] visibles, en orden
 * @param {boolean}   editMode     arrastrar y quitar habilitados; tocar no navega
 * @param {function}  onAbrir      (claveSeccion, seccion) al tocar un botón
 * @param {function}  onSos        al tocar SOS Veterinario
 */
export default function BotonesHome({ botones, cargando, editMode, onReordenar, onQuitar, onGuardar, onAbrir, onSos }) {
  return (
    <View style={styles.buttonsZone}>

      {/* Botón guardar — arriba, verde, solo en modo edición */}
      {editMode && (
        <TouchableOpacity style={styles.saveBtn} onPress={onGuardar} accessibilityRole="button">
          <Text style={styles.saveBtnText}>Guardar</Text>
        </TouchableOpacity>
      )}

      {cargando ? (
        // Sin etiquetas: todavía no se sabe qué botones eligió el usuario.
        <View style={styles.cargando}>
          <SkeletonBloque width="100%" height={56} borderRadius={16} />
          <SkeletonBloque width="100%" height={56} borderRadius={16} />
          <SkeletonBloque width="100%" height={56} borderRadius={16} />
          <SkeletonBloque width="100%" height={56} borderRadius={16} />
        </View>
      ) : (
        <>
          {/* Botones dinámicos con drag & drop */}
          <DraggableList
            items={botones}
            disabled={!editMode}
            onReorder={onReordenar}
            renderItem={({ item: boton, isDragging }) => {
              const seccion = getSeccion(boton.seccion);
              if (!seccion) return null;
              return (
                <NavButton
                  label={seccion.label}
                  iconName={seccion.icono}
                  editMode={editMode}
                  style={{ width: '100%', opacity: isDragging ? 0.85 : 1 }}
                  onDelete={() => onQuitar(boton.seccion)}
                  onPress={() => { if (!editMode) onAbrir(boton.seccion, seccion); }}
                  accessibilityLabel={`Ir a ${seccion.label}`}
                />
              );
            }}
          />

          {/* SOS — siempre visible, siempre último */}
          <NavButton
            label="SOS Veterinario"
            iconName="medical"
            variant="danger"
            onPress={onSos}
            accessibilityLabel="Emergencia veterinaria"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cargando: { gap: 12 },
  buttonsZone: { paddingHorizontal: 24, paddingTop: 72, paddingBottom: 100 },
  saveBtn: {
    backgroundColor: colores.verde, borderRadius: 30, height: 54,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    ...sombras.tarjeta,
  },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: colores.blanco },
});
