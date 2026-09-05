/**
 * SelectorMascota.jsx — Tira de pastillas para cambiar de mascota
 *
 * ÚNICO selector de mascota de la app. Antes cada pantalla dibujaba el suyo y
 * no coincidían: Eventos y Match pintaban la elegida en verde lleno y
 * Calendario la dejaba en blanco con borde verde. Ahora todas usan esto, así
 * que el cambio de mascota se ve igual en cualquier lado.
 *
 * El diseño es el de Calendario (blanco translúcido, la elegida en blanco con
 * borde y texto verdes): es el que mejor se lee sobre los fondos verde claro
 * que usan estas pantallas.
 *
 * Con una sola mascota no se renderiza nada: no tiene sentido un selector de
 * un solo elemento.
 *
 * Props:
 *   valor        → id de la mascota elegida
 *   onCambiar    → (id) => void
 *   mascotas     → lista propia (opcional). Si no se pasa, el componente la
 *                  busca solo. Match la pasa porque su lista trae datos extra
 *                  (perfil de Match creado, foto real), y Calendario y Eventos
 *                  porque ya la tenían cargada para otra cosa.
 *   deshabilitado→ ignora los toques (Match lo usa mientras persiste el cambio)
 *
 * Uso típico:
 *   const [petId, setPetId] = useState(route.params?.petId || null);
 *   <SelectorMascota valor={petId} onCambiar={setPetId} />
 */

import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';

import { useMisMascotas } from '../hooks/useMisMascotas';

export default function SelectorMascota({
  valor,
  onCambiar,
  mascotas: mascotasProp,
  deshabilitado = false,
  style,
}) {
  const { mascotas: mascotasPropias } = useMisMascotas();
  const gestionaLista = mascotasProp == null;
  const mascotas = mascotasProp ?? mascotasPropias;

  /*
    Si la pantalla se abrió sin `valor` (por ejemplo entrando desde un atajo que
    no pasa el petId), se elige sola la mascota activa: sin esto el selector
    quedaba sin ninguna pastilla marcada y no se entendía qué se estaba mirando.

    Solo cuando el componente maneja su propia lista. Si la lista viene de
    afuera, la pantalla ya decide qué preseleccionar — y en Match `onCambiar`
    persiste el cambio contra el servidor, así que no puede dispararse solo.
  */
  useEffect(() => {
    if (!gestionaLista || valor != null || !mascotas.length) return;
    onCambiar?.((mascotas.find((m) => m.esActiva) ?? mascotas[0]).id);
  }, [gestionaLista, valor, mascotas, onCambiar]);

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
            disabled={deshabilitado}
            accessibilityRole="button"
            accessibilityState={{ selected: activa, disabled: deshabilitado }}
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
  contenido: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  pastilla: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1.5, borderColor: 'transparent',
    // flexShrink: 0 — dentro de un ScrollView horizontal las pastillas se
    // encogen hasta dejar solo el padding y el nombre (numberOfLines={1}, con
    // overflow oculto) se recorta a nada: quedan bloques vacíos.
    flexShrink: 0,
  },
  pastillaOn: { backgroundColor: '#FFFFFF', borderColor: '#2DBD72' },
  txt: { fontSize: 13, color: '#6B6B6B', fontWeight: '600', maxWidth: 130 },
  txtOn: { color: '#2DBD72', fontWeight: '700' },
});
