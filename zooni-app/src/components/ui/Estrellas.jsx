/**
 * Estrellas.jsx — Calificación de 1 a 5 estrellas (antes había 4 copias).
 *
 *   <Estrellas valor={4.5} size={14} />                       // sólo mostrar (admite medias)
 *   <EstrellasInput valor={rating} onCambio={setRating} />      // elegir
 *   <EstrellasInput valor={v} onCambio={…} borrable />          // tocar la misma la borra (0)
 */

import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colores } from '../../theme';

const UNO_A_CINCO = [1, 2, 3, 4, 5];

/** Muestra un promedio: estrella llena, media o vacía. */
export function Estrellas({ valor = 0, size = 14, gap = 1 }) {
  return (
    <View style={{ flexDirection: 'row', gap }} accessibilityLabel={`${valor} de 5 estrellas`}>
      {UNO_A_CINCO.map((i) => (
        <Ionicons key={i} size={size} color={colores.amarillo}
          name={valor >= i ? 'star' : valor >= i - 0.5 ? 'star-half' : 'star-outline'} />
      ))}
    </View>
  );
}

/** Para elegir una calificación. Con `borrable`, tocar la elegida vuelve a 0. */
export function EstrellasInput({ valor = 0, onCambio, size = 34, borrable = false }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {UNO_A_CINCO.map((i) => (
        <TouchableOpacity key={i} onPress={() => onCambio(borrable && valor === i ? 0 : i)} hitSlop={4}
          accessibilityLabel={`${i} ${i === 1 ? 'estrella' : 'estrellas'}`}>
          <Ionicons name={valor >= i ? 'star' : 'star-outline'} size={size} color={colores.amarillo} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
