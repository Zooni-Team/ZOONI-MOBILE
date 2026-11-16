/**
 * SeccionSalud.jsx — Una sección de la hoja de Vacunas / Tratamientos: título
 * (con ícono o con el botón "Añadir") y debajo la lista, que resuelve sola sus
 * tres estados: cargando (placeholders), vacía (mensaje) o con tarjetas.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Skeleton from '../ui/Skeleton';
import { colores, sombras } from '../../theme';

function TarjetaCargando() {
  return (
    <Skeleton style={s.skeleton}>
      <View style={[s.skeletonLinea, { height: 14, width: '60%' }]} />
      <View style={[s.skeletonLinea, { width: '80%' }]} />
      <View style={[s.skeletonLinea, { width: '50%' }]} />
    </Skeleton>
  );
}

/**
 * @param {string}    titulo
 * @param {string}    [icono]        Ionicons a la izquierda del título (secciones secundarias)
 * @param {function}  [onAnadir]     si viene, muestra el botón "Añadir" a la derecha
 * @param {boolean}   cargando
 * @param {Array}     items
 * @param {string}    vacio          mensaje cuando no hay items
 * @param {function}  renderItem     (item, index) => tarjeta
 */
export default function SeccionSalud({
  titulo, icono, onAnadir, cargando, items, vacio, renderItem, placeholders = 2,
}) {
  const principal = !icono;
  return (
    <View>
      <View style={principal ? s.filaPrincipal : s.filaSecundaria}>
        {icono ? <Ionicons name={icono} size={16} color={colores.texto} /> : null}
        <Text style={principal ? s.tituloPrincipal : s.tituloSecundario} accessibilityRole="header">{titulo}</Text>
        {onAnadir ? (
          <TouchableOpacity style={s.btnAnadir} onPress={onAnadir} activeOpacity={0.85}
            accessibilityRole="button" accessibilityLabel={`Añadir a ${titulo}`}>
            <Ionicons name="add" size={16} color={colores.blanco} />
            <Text style={s.btnAnadirTxt}>Añadir</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {cargando ? (
        Array.from({ length: placeholders }, (_, i) => <TarjetaCargando key={i} />)
      ) : items.length === 0 ? (
        <Text style={s.vacio}>{vacio}</Text>
      ) : (
        items.map(renderItem)
      )}
    </View>
  );
}

const s = StyleSheet.create({
  filaPrincipal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  filaSecundaria: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 },
  tituloPrincipal: { fontSize: 18, fontWeight: '700', color: colores.texto },
  tituloSecundario: { fontSize: 16, fontWeight: '700', color: colores.texto },
  btnAnadir: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colores.verde, borderRadius: 20,
    minHeight: 36, paddingVertical: 8, paddingHorizontal: 16,
    ...sombras.suave,
  },
  btnAnadirTxt: { fontSize: 14, fontWeight: '700', color: colores.blanco },
  vacio: { fontSize: 14, color: colores.textoSecundario, textAlign: 'center', marginTop: 4, marginBottom: 18 },
  skeleton: { backgroundColor: colores.gris200, borderRadius: 12, padding: 16, marginBottom: 10, gap: 8 },
  skeletonLinea: { height: 11, backgroundColor: colores.gris400, borderRadius: 6 },
});
