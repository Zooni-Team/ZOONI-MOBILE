import { Image, Platform } from 'react-native';

/**
 * Imagen de la mascota (ilustración o foto real), con la sombra siguiendo su
 * silueta en vez de un cuadrado del contenedor. Antes duplicado en
 * HomeScreen y FichaMedicaScreen (faltaporhacer.md §2) — FichaMedica nunca
 * quería sombra (el mismo problema que resuelve acá `sombra=false`, que es
 * el valor por defecto), así que sigue sin pedirla.
 *
 * `esFoto`: una foto real es rectangular y opaca, va recortada/con marco
 * (`estiloFoto`) en vez del tratamiento con sombra.
 * `sombra`: sólo tiene sentido con ilustraciones (PNG transparente); en web
 * usa `estiloSombraWeb` (drop-shadow de CSS), en iOS `estiloSombraIOS`
 * (shadow de RN) y en Android no se agrega nada (`elevation` dibuja un
 * rectángulo detrás del PNG transparente, no sigue el alfa).
 */
export default function PetIllustration({
  source,
  label,
  style,
  esFoto = false,
  estiloFoto,
  sombra = false,
  estiloSombraWeb,
  estiloSombraIOS,
}) {
  if (esFoto) {
    return <Image source={source} style={[style, estiloFoto]} resizeMode="cover" accessibilityLabel={label} />;
  }

  if (sombra && Platform.OS === 'web') {
    return <Image source={source} style={[style, estiloSombraWeb]} resizeMode="contain" accessibilityLabel={label} />;
  }

  if (sombra && Platform.OS === 'ios') {
    return <Image source={source} style={[style, estiloSombraIOS]} resizeMode="contain" accessibilityLabel={label} />;
  }

  return <Image source={source} style={style} resizeMode="contain" accessibilityLabel={label} />;
}
