import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores } from '../../theme';

/**
 * Puntaje de 1 a 5 estrellas, de sólo lectura (admite medias estrellas para
 * promedios). Antes duplicado en `resenas/ResenasPaseadorModal`,
 * `Paseador/tabs/PerfilTab` y `MisPaseosScreen` (faltaporhacer.md §2).
 */
export default function Estrellas({ valor, size = 14 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          size={size}
          color={colores.amarillo}
          name={valor >= i ? 'star' : valor >= i - 0.5 ? 'star-half' : 'star-outline'}
        />
      ))}
    </View>
  );
}

/**
 * Puntaje de 1 a 5 estrellas, para elegir tocando (sin medias estrellas).
 * `borrable`: tocar la estrella ya elegida la vuelve a 0.
 */
export function EstrellasInput({ valor, onCambio, size = 30, borrable = false }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onCambio(borrable && valor === i ? 0 : i)}
          hitSlop={4}
          accessibilityLabel={`${i} ${i === 1 ? 'estrella' : 'estrellas'}`}
        >
          <Ionicons name={valor >= i ? 'star' : 'star-outline'} size={size} color={colores.amarillo} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
