const ascii = (b, desde, largo) => String.fromCharCode(...b.subarray(desde, desde + largo));

const MARCAS_HEIC = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];
const MARCAS_VIDEO = {
  qt: 'video/quicktime',
  M4V: 'video/x-m4v',
  M4VH: 'video/x-m4v',
  M4VP: 'video/x-m4v',
};

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
    if (marca === 'avif' || marca === 'avis') return null;
    return { mime: 'video/mp4', ext: 'mp4' };
  }
  return null;
}

function bytesAlAzar(n) {
  const b = new Uint8Array(n);
  const cripto = globalThis.crypto;
  if (cripto?.getRandomValues) {
    cripto.getRandomValues(b);
  } else {
    for (let i = 0; i < n; i += 1) b[i] = Math.floor(Math.random() * 256);
  }
  return b;
}

export function nombreAlAzar(ext) {
  const hex = Array.from(bytesAlAzar(16), (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex}.${ext}`;
}
