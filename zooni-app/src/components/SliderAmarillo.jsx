/**
 * SliderAmarillo.jsx — Slider (thumb + track activo #F5C842) sin dependencias
 *
 * Con flechas de −/+ a los costados: en un celular arrastrar el thumb para
 * ajustar medio kilo es incómodo; con las flechas se afina de a un paso.
 * Mantener apretada una flecha repite el paso.
 *
 * Lo usan el Paso 2 del registro y el alta de mascota de Configuración (antes
 * estaba copiado en las dos pantallas).
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SliderAmarillo({
  value, min, max, step, onChange, etiquetaMenos, etiquetaMas,
}) {
  const [trackWidth, setTrackWidth] = useState(1);
  const repeatTimer = useRef(null);

  // El valor vive también en un ref: el setInterval de la repetición captura el
  // closure una sola vez y con `value` a secas se quedaría clavado en el valor
  // que tenía al apretar.
  const valorActual = useRef(value);
  valorActual.current = value;

  // Los pasos chicos (0,005 kg para un canario) arrastran error de coma
  // flotante: 7 * 0.005 da 0.035000000000000003 y eso terminaba en la base.
  // Se redondea a los decimales que tenga el propio paso.
  const decimales = (String(step).split('.')[1] ?? '').length;
  const clamp = (v) => Number(
    Math.max(min, Math.min(max, Math.round(v / step) * step)).toFixed(decimales)
  );
  const paso  = (signo) => onChange(clamp(valorActual.current + signo * step));

  const frenar = () => {
    if (repeatTimer.current) { clearInterval(repeatTimer.current); repeatTimer.current = null; }
  };

  const arrancar = (signo) => {
    paso(signo);
    frenar();
    repeatTimer.current = setInterval(() => paso(signo), 120);
  };

  useEffect(() => frenar, []);

  const updateFromX = (x) => {
    if (trackWidth <= 1) return;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    onChange(clamp(min + ratio * (max - min)));
  };

  const ratio = (value - min) / (max - min);

  return (
    <View style={sl.row}>
      <TouchableOpacity
        style={sl.flecha}
        onPressIn={() => arrancar(-1)}
        onPressOut={frenar}
        accessibilityLabel={etiquetaMenos ?? 'Restar'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="remove" size={20} color="#2C2C2C" />
      </TouchableOpacity>

      <View
        style={sl.hit}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => updateFromX(e.nativeEvent.locationX)}
        onResponderMove={(e) => updateFromX(e.nativeEvent.locationX)}
      >
        <View style={sl.track}>
          <View style={[sl.fill, { width: `${ratio * 100}%` }]} />
          <View style={[sl.thumb, { left: `${ratio * 100}%`, marginLeft: -11 }]} />
        </View>
      </View>

      <TouchableOpacity
        style={sl.flecha}
        onPressIn={() => arrancar(1)}
        onPressOut={frenar}
        accessibilityLabel={etiquetaMas ?? 'Sumar'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="add" size={20} color="#2C2C2C" />
      </TouchableOpacity>
    </View>
  );
}

const sl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  flecha: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5C842',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  hit: { flex: 1, height: 40, justifyContent: 'center' },
  track: { height: 6, backgroundColor: '#DDDDDD', borderRadius: 3, width: '100%' },
  fill: { position: 'absolute', left: 0, height: 6, backgroundColor: '#F5C842', borderRadius: 3 },
  thumb: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#F5C842', borderWidth: 2, borderColor: '#FFFFFF', top: -8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3,
  },
});
