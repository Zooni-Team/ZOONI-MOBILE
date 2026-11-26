/**
 * tipoDeArchivo.js — Qué ES un archivo (por sus primeros bytes) y un nombre
 * imposible de adivinar para guardarlo.
 *
 * Por qué los bytes y no la extensión ni el mime que da el picker (informe de
 * seguridad #71): los dos los decide quien sube. Un .html renombrado a .jpg,
 * subido con contentType "image/jpeg", se servía desde nuestro dominio de
 * Storage. Ahora services/imagenStorage sólo sube lo que esta función
 * reconoce, y con el tipo que dicen los bytes.
 *
 * Límite: se comprueba en la app. Quien hable directo con la API de Storage
 * con su token se lo saltea; lo que sí frena siempre es el bucket (tamaño y
 * lista de tipos). Una verificación del lado del servidor necesitaría un
 * webhook de Storage que lea cada archivo.
 */

const ascii = (b, desde, largo) => String.fromCharCode(...b.subarray(desde, desde + largo));

// Marca de los contenedores ISO (bytes 8-11 después de "ftyp"): HEIC de
// iPhone y video MP4 / QuickTime / M4V / 3GP comparten el formato.
const MARCAS_HEIC = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];
const MARCAS_VIDEO = {
  qt: 'video/quicktime',
  M4V: 'video/x-m4v',
  M4VH: 'video/x-m4v',
  M4VP: 'video/x-m4v',
};

/**
 * Tipo real de un archivo a partir de sus primeros bytes.
 * @param {ArrayBuffer|Uint8Array} datos
 * @returns {{ mime: string, ext: string } | null} null si no es una imagen
 *   o un video de los que acepta Zooni.
 */
export function tipoReal(datos) {
  const b = datos instanceof Uint8Array ? datos : new Uint8Array(datos ?? new ArrayBuffer(0));
  if (b.length < 12) return null;

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a) return { mime: 'image/png', ext: 'png' };
  if (ascii(b, 0, 4) === 'GIF8') return { mime: 'image/gif', ext: 'gif' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: 'video/webm', ext: 'webm' };

  if (ascii(b, 4, 4) === 'ftyp') {
    const marca = ascii(b, 8, 4).trim();
    if (MARCAS_HEIC.includes(marca)) return { mime: 'image/heic', ext: 'heic' };
    if (marca.startsWith('3g')) return { mime: 'video/3gpp', ext: '3gp' };
    if (MARCAS_VIDEO[marca]) {
      const mime = MARCAS_VIDEO[marca];
      return { mime, ext: mime === 'video/quicktime' ? 'mov' : 'm4v' };
    }
    // isom, mp41, mp42, avc1, dash, iso2…: todos MP4. AVIF también es
    // "ftyp", pero ningún bucket lo acepta: se rechaza.
    if (marca === 'avif' || marca === 'avis') return null;
    return { mime: 'video/mp4', ext: 'mp4' };
  }
  return null;
}

/** 16 bytes al azar: del generador criptográfico si hay; si no, de Math.random. */
function bytesAlAzar(n) {
  const b = new Uint8Array(n);
  const cripto = globalThis.crypto;
  if (cripto?.getRandomValues) {
    cripto.getRandomValues(b);
  } else {
    // Hermes (iOS/Android) no trae crypto.getRandomValues. Math.random no es
    // criptográfico, pero 128 bits de él no se adivinan desde afuera, que es
    // lo único que hace falta acá (ver nombreAlAzar).
    for (let i = 0; i < n; i += 1) b[i] = Math.floor(Math.random() * 256);
  }
  return b;
}

/**
 * Nombre de archivo que no se puede adivinar (informe #135-#137). Antes era
 * `<Date.now()>-<0..999999>`: sabiendo más o menos cuándo subió alguien una
 * foto (y su carpeta, que es su id de Auth), se podía probar URLs hasta dar
 * con ella. Ahora: 32 caracteres hexadecimales al azar.
 */
export function nombreAlAzar(ext) {
  const hex = Array.from(bytesAlAzar(16), (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex}.${ext}`;
}
