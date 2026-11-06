import { createHash } from 'node:crypto';
export const CryptoDigestAlgorithm = { SHA256: 'sha256' };
export const digestStringAsync = async (alg, texto) => createHash(alg).update(texto).digest('hex');
