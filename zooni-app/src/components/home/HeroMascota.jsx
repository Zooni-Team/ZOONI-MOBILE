/**
 * HeroMascota.jsx — La parte de arriba del Inicio: el nombre y la imagen de la
 * mascota activa, flotando apenas, con las flechas y los puntitos para pasar
 * de una mascota a otra y el botón para alternar entre su foto y su avatar.
 *
 * Acá viven sólo las animaciones. Los cambios de verdad (cuál es la mascota
 * activa, si se muestra la foto) los hace quien lo usa:
 *
 *   onElegirMascota(mascota)        el usuario pasó a otra mascota
 *   onMostrarFoto(idMascota, bool)  eligió ver la foto (true) o el avatar (false)
 */

import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SkeletonBloque } from '../ui/Skeleton';
import { resolveMascotaVisual } from '../../constants/petImages';
import { colores, useTheme } from '../../theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = Math.min(SCREEN_HEIGHT * 0.40, 340);
const PET_IMAGE_SIZE = 250;

export default function HeroMascota({ mascota, mascotas, cargando, onElegirMascota, onMostrarFoto }) {
  const { reduceMotion } = useTheme();

  const petNameOpacity = useRef(new Animated.Value(1)).current;
  const petFloatY = useRef(new Animated.Value(0)).current;
  // Transición al pasar de mascota (deslizar + fundir la ilustración y el nombre)
  const petSwapX = useRef(new Animated.Value(0)).current;
  const petSwapOpacity = useRef(new Animated.Value(1)).current;
  const cambiandoMascota = useRef(false);
  // Giro al alternar entre la foto y el avatar (-1..1 → -90°..90°)
  const giroImagen = useRef(new Animated.Value(0)).current;
  const girandoImagen = useRef(false);

  useEffect(() => {
    // "Reducir movimiento" activo: la mascota queda quieta
    if (reduceMotion) { petFloatY.setValue(0); return; }
    // Solo iniciar la animación flotante después de que termine la carga inicial
    if (!cargando) {
      /*
        Flotación suave: 5 px de recorrido y 3,4 s por tramo.

        Antes eran 10 px cada 2 s, un vaivén bastante marcado que llamaba la
        atención sobre sí mismo en vez de dar la sensación de que la mascota
        "respira". Con la mitad de recorrido y casi el doble de tiempo se nota
        el movimiento pero no distrae.
      */
      const bob = Animated.loop(
        Animated.sequence([
          Animated.timing(petFloatY, {
            toValue: 5,
            duration: 3400,
            useNativeDriver: true,
          }),
          Animated.timing(petFloatY, {
            toValue: 0,
            duration: 3400,
            useNativeDriver: true,
          }),
        ]),
      );
      bob.start();
      return () => bob.stop();
    }
  }, [petFloatY, cargando, reduceMotion]);

  /*
    Alternar entre la foto real y el avatar del Closet.

    Solo tiene sentido si la mascota TIENE foto: sin foto siempre se ve el
    avatar y el botón no aparece.
  */
  const puedeAlternarImagen = !!mascota?.fotoUrl;
  const mostrandoFoto = puedeAlternarImagen && mascota.mostrarFoto !== false;

  const alternarImagen = () => {
    if (!puedeAlternarImagen || girandoImagen.current) return;
    const nuevo = !mostrandoFoto;
    const idMascota = mascota.id;

    const aplicar = () => {
      onMostrarFoto(idMascota, nuevo);
    };

    if (reduceMotion) { aplicar(); return; }

    /*
      Giro tipo carta: la imagen rota sobre su eje vertical hasta quedar de
      canto (90°), ahí —invisible— se cambia la fuente, y vuelve desde el otro
      lado (-90° → 0°). Se hace en dos tramos y no en uno de 180° para que la
      imagen no termine espejada.
    */
    girandoImagen.current = true;
    Animated.timing(giroImagen, { toValue: 1, duration: 190, useNativeDriver: true })
      .start(() => {
        aplicar();
        giroImagen.setValue(-1);
        Animated.timing(giroImagen, { toValue: 0, duration: 190, useNativeDriver: true })
          .start(() => { girandoImagen.current = false; });
      });
  };

  /** Posición de la mascota que se está mostrando dentro de la lista. */
  const idxMascota = mascota ? mascotas.findIndex((m) => m.id === mascota.id) : -1;

  /**
   * Pasa a mostrar `siguiente`. `direccion` es solo para la animación: marca
   * por qué lado sale la que estaba y por cuál entra la nueva.
   */
  const irAMascota = (siguiente, direccion) => {
    if (!siguiente || !mascota || siguiente.id === mascota.id || cambiandoMascota.current) return;

    // Sin animación (accesibilidad "reducir movimiento"): swap directo.
    if (reduceMotion) {
      onElegirMascota(siguiente);
      return;
    }

    // La ilustración/nombre salen hacia el lado del gesto, se cambia la mascota
    // fuera de cuadro y entra desde el lado opuesto (fundido + deslizamiento).
    cambiandoMascota.current = true;
    const salida = direccion > 0 ? -70 : 70;
    Animated.parallel([
      Animated.timing(petSwapX, { toValue: salida, duration: 170, useNativeDriver: true }),
      Animated.timing(petSwapOpacity, { toValue: 0, duration: 170, useNativeDriver: true }),
      Animated.timing(petNameOpacity, { toValue: 0, duration: 170, useNativeDriver: true }),
    ]).start(() => {
      onElegirMascota(siguiente);
      petSwapX.setValue(-salida);
      // El resorte tarda más de un segundo en quedarse quieto del todo: si las
      // flechas esperaran a eso, quedarían sin responder. Se liberan cuando
      // termina el fundido.
      Animated.spring(petSwapX, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }).start();
      Animated.parallel([
        Animated.timing(petSwapOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(petNameOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start(() => { cambiandoMascota.current = false; });
    });
  };

  /** Flechas de los costados: una mascota para adelante o para atrás, en círculo. */
  const cambiarMascota = (direccion) => {
    if (mascotas.length < 2) return;
    // Si la activa no apareciera en la lista (idx -1), se arranca por la primera
    // en vez de dejar las flechas sin hacer nada.
    const desde = idxMascota < 0 ? 0 : idxMascota;
    irAMascota(mascotas[(desde + direccion + mascotas.length) % mascotas.length], direccion);
  };

  /** Puntitos: salto directo a una mascota, entrando por el lado que corresponde. */
  const saltarAMascota = (destino) => {
    if (mascotas.length < 2 || destino === idxMascota) return;
    irAMascota(mascotas[destino], destino > idxMascota ? 1 : -1);
  };

  return (
    <View style={styles.heroZone}>
      {(mascota || cargando) && (
        <Animated.View style={[styles.petNameWrap, { opacity: petNameOpacity, transform: [{ translateX: petSwapX }] }]}>
          {cargando ? (
            <SkeletonBloque width={140} height={36} borderRadius={10} />
          ) : (
            <Text style={styles.petName} numberOfLines={1}>
              {mascota.nombre.length > 20
                ? mascota.nombre.slice(0, 20) + '…'
                : mascota.nombre}
            </Text>
          )}
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.petImageWrap,
          { opacity: petSwapOpacity, transform: [{ translateY: petFloatY }, { translateX: petSwapX }] },
        ]}
      >
        {cargando ? (
          <SkeletonBloque width={PET_IMAGE_SIZE} height={PET_IMAGE_SIZE} borderRadius={20} />
        ) : (
          /*
            Se toca la imagen para alternar entre la foto real y el avatar
            del Closet. La preferencia también está en Editar mascota, pero
            enterrada en Configuración → Mis Mascotas → Editar → Fotos: acá
            está donde de verdad mirás a la mascota, que es donde uno quiere
            cambiar cómo se ve.
          */
          <View>
            {/* La rotación va acá y no en el wrap de afuera: si envolviera
                todo, los puntitos girarían junto con la imagen. */}
            <Animated.View
              style={{
                transform: [
                  { perspective: 900 },
                  {
                    rotateY: giroImagen.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: ['-90deg', '0deg', '90deg'],
                    }),
                  },
                ],
              }}
            >
              <TouchableOpacity
                activeOpacity={puedeAlternarImagen ? 0.85 : 1}
                onPress={puedeAlternarImagen ? alternarImagen : undefined}
                disabled={!puedeAlternarImagen}
                accessibilityRole={puedeAlternarImagen ? 'button' : 'image'}
                accessibilityLabel={puedeAlternarImagen
                  ? (mostrandoFoto
                    ? `Ver el avatar de ${mascota.nombre} en vez de su foto`
                    : `Ver la foto de ${mascota.nombre} en vez de su avatar`)
                  : (mascota ? `Imagen de ${mascota.nombre}` : 'Mascota')}
              >
                <IlustracionMascota
                  // Foto real subida si tiene y así lo eligió el usuario; si no,
                  // el look/avatar aplicado en Closet (ver resolveMascotaVisual).
                  source={resolveMascotaVisual(mascota ?? {})}
                  esFoto={mostrandoFoto}
                  label={mascota ? `Imagen de ${mascota.nombre}` : 'Mascota'}
                />
              </TouchableOpacity>
            </Animated.View>

            {/*
              Alternar foto/avatar.

              Fue primero una pastilla suelta (caía entre el nombre y la
              imagen, porque petImageWrap es absolute), después un botón
              amarillo grande en la esquina que competía con la foto, y
              después dos puntitos debajo. Los puntitos se leían como el
              carrusel de mascotas —que es lo que ahora ocupa ese lugar—:
              con dos mascotas cargadas había dos puntos por un motivo y
              dos por otro, sin forma de distinguirlos. Ahora es un botón
              chico sobre la esquina de la imagen y el ícono muestra lo que
              vas a ver si lo tocás.
            */}
            {puedeAlternarImagen && (
              <TouchableOpacity style={styles.btnAlternarImagen} onPress={alternarImagen}
                accessibilityRole="button"
                accessibilityState={{ selected: mostrandoFoto }}
                accessibilityLabel={mostrandoFoto
                  ? `Estás viendo la foto de ${mascota.nombre}. Tocá para ver su avatar.`
                  : `Estás viendo el avatar de ${mascota.nombre}. Tocá para ver su foto.`}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.btnAlternarImagenTxt}>
                  {mostrandoFoto ? 'Ver avatar' : 'Ver foto'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>

      {/*
        Puntitos del carrusel: uno por mascota cargada, marcando en cuál
        estás. Se puede tocar uno para saltar directo a esa mascota.

        Van acá afuera y no dentro del bloque animado de la imagen: ese
        bloque se desliza y se desvanece al cambiar de mascota, y el
        indicador tiene que quedarse quieto para que se vea de dónde a
        dónde saltaste.
      */}
      {!cargando && mascotas.length > 1 && (
        <View style={styles.puntosMascotas}>
          {mascotas.map((m, i) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => saltarAMascota(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: i === idxMascota }}
              accessibilityLabel={`Ver a ${m.nombre}`}
              hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
            >
              <View style={[styles.punto, i === idxMascota && styles.puntoOn]} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Flechas para alternar entre mascotas (solo si hay más de una) */}
      {!cargando && mascotas.length > 1 && (
        <>
          <TouchableOpacity
            style={[styles.petArrow, styles.petArrowLeft]}
            onPress={() => cambiarMascota(-1)}
            accessibilityRole="button"
            accessibilityLabel="Mascota anterior"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color={colores.texto} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.petArrow, styles.petArrowRight]}
            onPress={() => cambiarMascota(1)}
            accessibilityRole="button"
            accessibilityLabel="Mascota siguiente"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward" size={26} color={colores.texto} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

/**
 * Sombra que sigue la silueta del PNG (no un cuadrado del contenedor).
 *
 * `esFoto` cambia el tratamiento: una foto real es rectangular y opaca, así que
 * va recortada en redondo y con marco blanco — sin eso quedaba un rectángulo
 * pegado sobre el fondo, muy distinto del resto del Home. Los avatares del
 * Closet son PNG transparentes y siguen yendo tal cual, con `contain`.
 */
function IlustracionMascota({ source, label, esFoto }) {
  if (esFoto) {
    return (
      <Image
        source={source}
        style={[styles.petImage, styles.petFoto]}
        resizeMode="cover"
        accessibilityLabel={label}
      />
    );
  }

  if (Platform.OS === 'web') {
    return (
      <Image
        source={source}
        style={[styles.petImage, styles.petImageDropShadow]}
        resizeMode="contain"
        accessibilityLabel={label}
      />
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <Image
        source={source}
        style={[styles.petImage, styles.petImageWithShadow]}
        resizeMode="contain"
        accessibilityLabel={label}
      />
    );
  }

  // Android: `elevation` dibuja la sombra como un rectángulo detrás del PNG
  // transparente (no sigue el alfa), así que se omite para no mostrar un cuadrado.
  return (
    <Image
      source={source}
      style={styles.petImage}
      resizeMode="contain"
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  // Hero — ~45% pantalla (Instruction-Home)
  heroZone: {
    overflow: 'visible',
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingTop: 4,
    height: HERO_HEIGHT,
  },
  /*
    El nombre va cerca de la imagen y no arriba de todo del hero.

    La imagen es `position: absolute` anclada al pie del hero (que tiene alto
    fijo), así que el nombre no la arrastra: para acercarlos hay que empujar el
    nombre hacia abajo con marginTop. Con 8 quedaban ~60 px de aire en el medio.
  */
  petNameWrap: { marginTop: 34, marginBottom: 6, alignItems: 'center', zIndex: 3, paddingHorizontal: 20 },
  petName: {
    fontSize: 40,
    fontWeight: '800',
    color: colores.blanco,
    textAlign: 'center',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.28)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  /*
    Foto real: cuadrada y sin marco.

    Estuvo un rato como círculo con borde blanco grueso y quedaba genérica —
    el avatar de cualquier app— además de recortar mucho de la foto. Cuadrada
    con las esquinas redondeadas es el mismo lenguaje que las tarjetas del
    resto de Zooni (whiteCard, cards de Ficha Médica), y la sombra verde es la
    misma familia que la del hero.
  */
  petFoto: {
    borderRadius: 26,
    /*
      SIN backgroundColor. Estaba en blanco y, como el estilo se aplica al mismo
      <Image>, ese blanco se veía a través de las zonas transparentes: el avatar
      quedaba con un cuadrado claro detrás. La foto es opaca y no lo necesita.

      La sombra también va solo acá: en web se convierte en box-shadow, que es
      RECTANGULAR. Sobre una foto opaca con esquinas redondeadas queda bien;
      sobre el PNG transparente del avatar dibujaría justamente el cuadrado que
      se quería evitar (por eso el avatar usa drop-shadow, que sigue el alfa).
    */
    shadowColor: '#1a7a45',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  // Alternar foto/avatar: botón chico sobre la esquina inferior de la imagen.
  /*
    Sin sombra, sin verde de marca y sin negrita: es una etiqueta de servicio
    sobre la mascota, no un botón de acción. Tiene que poder ignorarse hasta
    que la buscás — la foto es lo que importa en esta zona.
  */
  btnAlternarImagen: {
    position: 'absolute',
    right: 6,
    bottom: 16,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 5,
  },
  btnAlternarImagenTxt: {
    fontSize: 10.5, fontWeight: '600', color: '#5A6660', letterSpacing: 0.2,
  },
  /*
    Puntitos del carrusel de mascotas.

    `bottom: -48` es exactamente donde estaban los puntitos de foto/avatar
    cuando colgaban de petImageWrap (que ahora termina en -21): quedan 12px
    debajo del borde de la imagen, que es donde el ojo ya los busca.
  */
  puntosMascotas: {
    position: 'absolute',
    bottom: -48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
    zIndex: 3,
  },
  punto: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  puntoOn: { backgroundColor: colores.verde },
  petImageDropShadow: {
    filter: 'drop-shadow(4px 10px 14px rgba(36, 90, 66, 0.35))',
  },
  petImageWithShadow: {
    shadowColor: '#245a42',
    shadowOffset: { width: 4, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  /*
    `bottom: -21` y no -48: los puntitos vivían ADENTRO de este bloque, debajo
    de la imagen, y sumaban 27px (12 de separación + 15 de la fila). Al sacarlos
    afuera —para que no se deslicen al cambiar de mascota— el bloque perdió esos
    27px y la imagen se fue 27px para abajo. Se compensan acá, así la mascota
    queda exactamente donde estaba y los puntitos entran justo debajo.
  */
  petImageWrap: {
    position: 'absolute',
    bottom: -21,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  // Flechas del selector de mascota (a la altura de la ilustración)
  petArrow: {
    position: 'absolute',
    bottom: PET_IMAGE_SIZE / 2 - 70,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    shadowColor: colores.negro,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  petArrowLeft:  { left: 14 },
  petArrowRight: { right: 14 },
  petImage: {
    width: PET_IMAGE_SIZE,
    height: PET_IMAGE_SIZE,
    maxWidth: SCREEN_WIDTH * 0.68,
    maxHeight: PET_IMAGE_SIZE,
    backgroundColor: 'transparent',
  },
});
