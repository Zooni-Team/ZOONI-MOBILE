/**
 * SelectorMascota.jsx — Tira de pastillas para cambiar de mascota
 *
 * Las pantallas que muestran datos de UNA mascota (Ficha Médica, Vacunas,
 * Tratamientos, Consultas, Consejos, Closet) recibían el `petId` por parámetro
 * de navegación y lo dejaban fijo. Con más de una mascota no había forma de
 * mirar otra sin volver al Home, cambiarla con las flechas del hero y entrar de
 * nuevo — y encima había que repetirlo en cada sección.
 *
 * El cambio es LOCAL a la pantalla, igual que en Calendario, Eventos y
 * VirtualVet: no toca la mascota activa del usuario (esa solo se cambia desde
 * el Home, que es lo que sigue el resto de la app).
 *
 * Con una sola mascota no se renderiza nada: no tiene sentido ofrecer un
 * selector de un solo elemento.
 *
 * Uso:
 *   const [petId, setPetId] = useState(route.params?.petId ?? null);
 *   <SelectorMascota valor={petId} onCambiar={setPetId} />
 */

import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';

import { useMisMascotas } from '../hooks/useMisMascotas';

export default function SelectorMascota({ valor, onCambiar, style }) {
  const { mascotas } = useMisMascotas();

  /*
    Si la pantalla se abrió sin `petId` (por ejemplo entrando desde un atajo que
    no lo pasa), se elige sola la mascota activa. Sin esto el selector quedaba
    sin ninguna pastilla marcada y no se entendía qué se estaba mirando.
  */
  useEffect(() => {
    if (valor != null || !mascotas.length) return;
    onCambiar?.((mascotas.find((m) => m.esActiva) ?? mascotas[0]).id);
  }, [valor, mascotas, onCambiar]);

  if (mascotas.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[s.tira, style]}
      contentContainerStyle={s.contenido}
    >
      {mascotas.map((m) => {
        const activa = valor === m.id;
        return (
          <TouchableOpacity
            key={m.id}
            style={[s.pastilla, activa && s.pastillaOn]}
            onPress={() => onCambiar?.(m.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: activa }}
            accessibilityLabel={`Ver los datos de ${m.nombre}`}
          >
            <Text style={[s.txt, activa && s.txtOn]} numberOfLines={1}>{m.nombre}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tira: { flexGrow: 0 },
  contenido: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  pastilla: {
    paddingHorizontal: 16, height: 34, borderRadius: 17, justifyContent: 'center',
    backgroundColor: '#F2F5F3', borderWidth: 1.5, borderColor: 'transparent',
    // flexShrink: 0 — dentro de un ScrollView horizontal las pastillas se
    // encogen hasta dejar solo el padding y el nombre (numberOfLines={1}, con
    // overflow oculto) se recorta a nada: quedan bloques vacíos.
    flexShrink: 0,
  },
  pastillaOn: { backgroundColor: '#2DBD72', borderColor: '#2DBD72' },
  txt: { fontSize: 13, color: '#6B6B6B', fontWeight: '600', maxWidth: 140 },
  txtOn: { color: '#FFFFFF', fontWeight: '700' },
});
