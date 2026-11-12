import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores } from '../../theme';

/**
 * Tarjeta de un ítem "sugerido" del calendario (vacuna o tratamiento), con
 * dos layouts según la pantalla (antes eran dos componentes duplicados en
 * VacunasScreen y TratamientosScreen, faltaporhacer.md §2):
 * - `layout="simple"` (Tratamientos): fila única, nombre + frecuencia a la
 *   izquierda, badge o botón "Registrar" a la derecha.
 * - `layout="detallado"` (Vacunas): nombre + dosis a la izquierda, estado +
 *   frecuencia + badge/botón "Marcar" a la derecha, con animación de rebote
 *   al tocar el botón.
 *
 * @param {object} styles - el `s` de la pantalla que llama.
 */
export default function CardSugerido({
  styles: s,
  index,
  nombre,
  subtitulo,
  estado,
  frecuencia,
  aplicado,
  botonTexto,
  onPress,
  layout = 'simple',
}) {
  const translateY = useRef(new Animated.Value(12)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scaleBtn = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 280, delay: index * 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, translateY, opacity]);

  const presionar = () => {
    if (layout === 'detallado') {
      Animated.sequence([
        Animated.timing(scaleBtn, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleBtn, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
    onPress();
  };

  const accion = aplicado ? (
    <View style={s.badgeAplicada}>
      <Ionicons name="checkmark" size={12} color={colores.verde} />
      <Text style={s.badgeAplicadaTxt}>Aplicada</Text>
    </View>
  ) : layout === 'detallado' ? (
    <Animated.View style={{ transform: [{ scale: scaleBtn }] }}>
      <Pressable style={s.btnMarcar} onPress={presionar}>
        <Text style={s.btnMarcarTxt}>{botonTexto}</Text>
      </Pressable>
    </Animated.View>
  ) : (
    <TouchableOpacity style={s.btnRegistrar} onPress={presionar} accessibilityLabel={`${botonTexto} ${nombre}`}>
      <Text style={s.btnRegistrarTxt}>{botonTexto}</Text>
    </TouchableOpacity>
  );

  if (layout === 'detallado') {
    return (
      <Animated.View style={[s.cardSugerido, { transform: [{ translateY }], opacity }]}>
        <View style={s.cardSugeridoLeft}>
          <Text style={s.sugeridoNombre}>{nombre}</Text>
          {subtitulo ? <Text style={s.sugeridoDosis}>{subtitulo}</Text> : null}
        </View>
        <View style={s.cardSugeridoRight}>
          {estado ? <Text style={[s.sugeridoEstado, { color: estado.color }]}>{estado.texto}</Text> : null}
          {frecuencia ? <Text style={s.sugeridoFrec}>{frecuencia}</Text> : null}
          {accion}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[s.cardSugerido, { transform: [{ translateY }], opacity }]}>
      <View style={s.cardSugeridoInfo}>
        <Text style={s.sugeridoNombre}>{nombre}</Text>
        {frecuencia ? <Text style={s.sugeridoFrecInline}>{frecuencia}</Text> : null}
      </View>
      {accion}
    </Animated.View>
  );
}
