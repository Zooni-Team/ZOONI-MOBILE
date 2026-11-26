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
  const petSwapX = useRef(new Animated.Value(0)).current;
  const petSwapOpacity = useRef(new Animated.Value(1)).current;
  const cambiandoMascota = useRef(false);
  const giroImagen = useRef(new Animated.Value(0)).current;
  const girandoImagen = useRef(false);

  useEffect(() => {
    if (reduceMotion) { petFloatY.setValue(0); return; }
    if (!cargando) {
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

    girandoImagen.current = true;
    Animated.timing(giroImagen, { toValue: 1, duration: 190, useNativeDriver: true })
      .start(() => {
        aplicar();
        giroImagen.setValue(-1);
        Animated.timing(giroImagen, { toValue: 0, duration: 190, useNativeDriver: true })
          .start(() => { girandoImagen.current = false; });
      });
  };

  const idxMascota = mascota ? mascotas.findIndex((m) => m.id === mascota.id) : -1;

  const irAMascota = (siguiente, direccion) => {
    if (!siguiente || !mascota || siguiente.id === mascota.id || cambiandoMascota.current) return;

    if (reduceMotion) {
      onElegirMascota(siguiente);
      return;
    }

    cambiandoMascota.current = true;
    const salida = direccion > 0 ? -70 : 70;
    Animated.parallel([
      Animated.timing(petSwapX, { toValue: salida, duration: 170, useNativeDriver: true }),
      Animated.timing(petSwapOpacity, { toValue: 0, duration: 170, useNativeDriver: true }),
      Animated.timing(petNameOpacity, { toValue: 0, duration: 170, useNativeDriver: true }),
    ]).start(() => {
      onElegirMascota(siguiente);
      petSwapX.setValue(-salida);
      Animated.spring(petSwapX, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }).start();
      Animated.parallel([
        Animated.timing(petSwapOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(petNameOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start(() => { cambiandoMascota.current = false; });
    });
  };

  const cambiarMascota = (direccion) => {
    if (mascotas.length < 2) return;
    const desde = idxMascota < 0 ? 0 : idxMascota;
    irAMascota(mascotas[(desde + direccion + mascotas.length) % mascotas.length], direccion);
  };

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
          <View>
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
                  source={resolveMascotaVisual(mascota ?? {})}
                  esFoto={mostrandoFoto}
                  label={mascota ? `Imagen de ${mascota.nombre}` : 'Mascota'}
                />
              </TouchableOpacity>
            </Animated.View>

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
  heroZone: {
    overflow: 'visible',
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingTop: 4,
    height: HERO_HEIGHT,
  },
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
  petFoto: {
    borderRadius: 26,
    shadowColor: '#1a7a45',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
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
  petImageWrap: {
    position: 'absolute',
    bottom: -21,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
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
