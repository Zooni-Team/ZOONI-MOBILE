/**
 * authApi.js — Login y Registro contra Supabase (tabla "User" + "Mascota")
 *
 * No hay backend propio ni Supabase Auth todavía: el login es contra la
 * columna "User"."Contrasena". Las contraseñas se guardan hasheadas con
 * SHA-256 (expo-crypto) — es un interim razonable mientras no hay servidor
 * donde correr bcrypt; al migrar a Supabase Auth esto se reemplaza entero.
 *
 * Nota sobre el "registro transaccional": supabase-js no puede abrir
 * transacciones desde el cliente, así que si el INSERT de la mascota falla
 * después de crear el usuario, se hace un rollback manual (DELETE del
 * usuario recién creado) para no dejar cuentas huérfanas.
 */

import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { setCurrentUserId } from '../config/session';
import { toISODateLocal } from '../utils/fechaLocal';
import { subirImagenPublica } from '../utils/imagenStorage';
import { marcarPresencia } from './presenciaApi';

export async function hashPassword(password) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
}

// ─────────────────────────────────────────────
// RAZAS (catálogo para el Registro Paso 2)
// ─────────────────────────────────────────────

/** Devuelve las razas activas de una especie, ordenadas. */
export async function fetchRazas(especie) {
  const { data, error } = await supabase
    .from('razas')
    .select('id, nombre')
    .eq('especie', especie)
    .eq('activo', true)
    .order('orden', { ascending: true });
  if (error) throw error;
  return { razas: data ?? [] };
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

/**
 * Autentica contra la tabla "User". Si es correcto, guarda la sesión
 * (setCurrentUserId) y devuelve { usuario, mascotaActiva }.
 * Lanza Error('credenciales') si el mail o la contraseña no coinciden.
 */
export async function login(email, password) {
  const mail = email.trim().toLowerCase();
  const hash = await hashPassword(password);

  // Camino seguro: la comparación de hash se hace en el SERVIDOR
  // (RPC login_user de 021_seguridad.sql). El cliente nunca ve el hash
  // guardado. Devuelve null si mail o contraseña no coinciden, sin
  // distinguir cuál (no se revela si el mail existe).
  let usuario = null;
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('login_user', { p_mail: mail, p_hash: hash });

  if (!rpcError) {
    if (!rpcData) throw new Error('credenciales');
    usuario = rpcData;
  } else if (esFuncionInexistente(rpcError)) {
    // Fallback LEGACY: el 021 todavía no se ejecutó en esta base.
    // Se mantiene solo para no romper el login en bases viejas — borrar
    // este bloque cuando la migración esté corrida en todos lados.
    const { data: filaUser, error } = await supabase
      .from('User')
      .select('*')
      .ilike('Mail', mail)
      .maybeSingle();
    if (error) throw error;
    if (!filaUser) throw new Error('credenciales');
    const coincide = filaUser.Contrasena === hash || filaUser.Contrasena === password;
    if (!coincide) throw new Error('credenciales');
    usuario = {
      id: filaUser.Id_User,
      nombre: filaUser.Nombre,
      apellido: filaUser.Apellido,
      email: filaUser.Mail,
      fotoPerfil: filaUser.FotoPerfil ?? null,
    };
  } else {
    throw rpcError;
  }

  await setCurrentUserId(usuario.id);

  // Primer latido de presencia apenas entra: si no, hasta el próximo tick del
  // intervalo figuraría desconectado en Comunidad.
  marcarPresencia(true);

  const { data: mascotas } = await supabase
    .from('Mascota')
    .select('*')
    .eq('Id_User', usuario.id)
    .order('EsActiva', { ascending: false });

  const mascotaActiva = mascotas?.[0] ?? null;

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      fotoPerfil: usuario.fotoPerfil ?? null,
    },
    mascotaActiva: mascotaActiva
      ? {
          id: mascotaActiva.Id_Mascota,
          nombre: mascotaActiva.Nombre,
          especie: mascotaActiva.Especie,
          raza: mascotaActiva.Raza,
          imagen_asset: mascotaActiva.ImagenAsset ?? 'perro_default',
        }
      : null,
  };
}

/** PGRST202 = la función RPC no existe (todavía no se corrió el 021). */
function esFuncionInexistente(error) {
  return error?.code === 'PGRST202' || /function .* does not exist/i.test(error?.message ?? '');
}

/** 23505 = unique_violation: chocó con el índice único del mail (migración 032). */
function esMailDuplicado(error) {
  const msg = String(error?.message ?? '');
  return error?.code === '23505'
    && (/idx_user_mail_unico/i.test(msg) || /mail/i.test(msg));
}

/**
 * ¿Ya existe una cuenta con ese mail?
 *
 * Ojo con dos cosas que hacían que el chequeo viejo dejara pasar duplicados:
 *   · .maybeSingle() DEVUELVE ERROR si hay más de una fila — como el error se
 *     ignoraba, `data` quedaba en null y parecía que el mail estaba libre.
 *   · .ilike() trata `%` y `_` como comodines; un mail con guion bajo
 *     (juan_perez@…) matcheaba cualquier otra cosa. Se compara con .eq() sobre
 *     el mail ya normalizado a minúsculas (la app siempre guarda en minúscula).
 *
 * Filas viejas guardadas con otra capitalización se le escapan a este chequeo,
 * pero no al servidor: la RPC compara con lower(trim(Mail)) y el índice único
 * de la 032 está sobre esa misma expresión.
 */
async function mailYaRegistrado(mail) {
  const { data, error } = await supabase
    .from('User').select('Id_User').eq('Mail', mail).limit(1);
  if (error) return false; // sin conexión: que decida el índice único del servidor
  return (data?.length ?? 0) > 0;
}

// ─────────────────────────────────────────────
// REGISTRO
// ─────────────────────────────────────────────

/**
 * Fecha de nacimiento de la mascota. El registro ahora la pide directamente
 * (Paso 2); `edadMeses` queda solo como respaldo para cualquier pantalla vieja
 * que todavía mande una edad en meses.
 */
function resolverFechaNacimiento(mascota) {
  if (mascota.fechaNacimiento) return mascota.fechaNacimiento;
  if (mascota.edadMeses == null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - mascota.edadMeses);
  // toISOString usa UTC: de noche (UTC-3) devolvía el día siguiente
  return toISODateLocal(d);
}

const IMAGEN_ASSET_POR_ESPECIE = {
  perro: 'perro_default',
  gato: 'gato_default',
  conejo: 'conejo_default',
  ave: 'pajaro_default',
  reptil: 'perro_default',   // sin asset propio todavía — ver Instruction-CargarImagenes.md
  pez: 'perro_default',
  hamster: 'hamster_default',
  raton: 'hamster_default',
};

/**
 * Registra usuario + primera mascota.
 * @param {object} datos
 *   {
 *     mascota: { nombre, especie, sexo, razaNombre, pesoKg, fechaNacimiento, fotoUri },
 *     usuario: { nombre, apellido, email, password, pais, paisCodigo,
 *                provincia, ciudad, codigoTelefono, telefono }
 *   }
 * Lanza Error('email_existente') si ya hay una cuenta con ese mail.
 * NO inicia sesión: el flujo vuelve al Login con banner de éxito.
 */
export async function registro(datos) {
  const { mascota, usuario } = datos;
  const mail = usuario.email.trim().toLowerCase();

  if ((usuario.password ?? '').length < 7) throw new Error('password_corta');

  // Chequeo temprano del mail: corta el registro ANTES de subir la foto a
  // Storage (si no, cada intento repetido dejaba una imagen huérfana).
  // No es la garantía — esa es el índice único de la 032 — pero da el mensaje
  // correcto en el caso normal.
  if (await mailYaRegistrado(mail)) throw new Error('email_existente');

  const hash = await hashPassword(usuario.password);
  const ubicacionDisplay = [usuario.ciudad, usuario.provincia].filter(Boolean).join(', ') || null;

  // @usuario: chequeo de disponibilidad previo (el índice único del 025 es la
  // garantía final). En el registro NO se setea NombreUsuarioCambiadoEn: el
  // cooldown de 30 días es solo para cambios desde Configuración.
  const nombreUsuario = usuario.nombreUsuario?.trim().replace(/^@/, '') || null;
  if (nombreUsuario) {
    const { data: usado } = await supabase
      .from('User').select('Id_User').ilike('NombreUsuario', nombreUsuario).maybeSingle();
    if (usado) throw new Error('usuario_existente');
  }

  // Setea el @usuario recién creado; si chocó con el índice único, avisa
  const setUsuario = async (userId) => {
    if (!nombreUsuario) return;
    const { error } = await supabase.from('User')
      .update({ NombreUsuario: nombreUsuario }).eq('Id_User', userId);
    if (error && String(error.message ?? '').includes('idx_user_nombreusuario')) {
      throw new Error('usuario_existente');
    }
  };

  // Foto REAL de la mascota: se sube a Storage y se guarda en Mascota.Foto
  // (obligatoria — la valida el Paso 2 del registro). Es la que muestra Match.
  const fotoMascotaUrl = mascota.fotoUri
    ? await subirImagenPublica(mascota.fotoUri, 'mascotas')
    : null;
  const setFotoMascota = async (userId) => {
    if (!fotoMascotaUrl) return;
    await supabase.from('Mascota').update({ Foto: fotoMascotaUrl }).eq('Id_User', userId);
  };

  // Camino seguro: RPC atómica del servidor (021_seguridad.sql).
  // Usuario + credencial + mascota + rol en una sola transacción: si algo
  // falla, Postgres revierte todo solo — sin rollback manual con DELETEs.
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'registrar_usuario_con_mascota',
    {
      p_usuario: {
        nombre: usuario.nombre.trim(),
        apellido: usuario.apellido.trim(),
        email: mail,
        telefono: usuario.telefono?.trim() || null,
        codigoTelefono: usuario.codigoTelefono?.trim() || null,
        pais: usuario.pais ?? null,
        paisCodigo: usuario.paisCodigo ?? null,
        provincia: usuario.provincia?.trim() || null,
        ciudad: usuario.ciudad?.trim() || null,
        ubicacion: ubicacionDisplay,
      },
      p_hash: hash,
      p_mascota: {
        nombre: mascota.nombre.trim(),
        especie: mascota.especie,
        sexo: mascota.sexo,
        raza: mascota.razaNombre,
        peso: mascota.pesoKg ?? null,
        fechaNacimiento: resolverFechaNacimiento(mascota),
        imagenAsset: IMAGEN_ASSET_POR_ESPECIE[mascota.especie] ?? 'perro_default',
      },
    }
  );

  if (!rpcError) {
    await setUsuario(rpcData.id);
    await setFotoMascota(rpcData.id);
    return {
      mensaje: 'Cuenta creada exitosamente',
      usuario: {
        id: rpcData.id,
        nombre: usuario.nombre.trim(),
        apellido: usuario.apellido.trim(),
        email: rpcData.email,
      },
    };
  }

  if (String(rpcError.message ?? '').includes('email_existente') || esMailDuplicado(rpcError)) {
    throw new Error('email_existente');
  }
  if (!esFuncionInexistente(rpcError)) throw rpcError;

  // Fallback LEGACY (el 021 no está corrido): flujo viejo con rollback
  // manual. Borrar cuando la migración esté aplicada en todos lados.
  if (await mailYaRegistrado(mail)) throw new Error('email_existente');

  const { data: nuevoUsuario, error: errUsuario } = await supabase
    .from('User')
    .insert({
      Nombre: usuario.nombre.trim(),
      Apellido: usuario.apellido.trim(),
      Mail: mail,
      Contrasena: hash,
      Telefono: usuario.telefono?.trim() || null,
      CodigoTelefono: usuario.codigoTelefono?.trim() || null,
      Pais: usuario.pais ?? null,
      PaisCodigo: usuario.paisCodigo ?? null,
      Provincia: usuario.provincia?.trim() || null,
      Ciudad: usuario.ciudad?.trim() || null,
      Ubicacion: ubicacionDisplay,
    })
    .select()
    .single();
  // El índice único de la 032 es lo que realmente impide dos cuentas con el
  // mismo mail; acá su error se traduce al mensaje que muestra la pantalla.
  if (errUsuario) throw esMailDuplicado(errUsuario) ? new Error('email_existente') : errUsuario;

  const nuevoUserId = nuevoUsuario.Id_User;

  try {
    const { error: errMascota } = await supabase.from('Mascota').insert({
      Id_User: nuevoUserId,
      Foto: fotoMascotaUrl,
      Nombre: mascota.nombre.trim(),
      Especie: mascota.especie,
      Sexo: mascota.sexo,
      Raza: mascota.razaNombre,
      Peso: mascota.pesoKg,
      FechaNacimiento: resolverFechaNacimiento(mascota),
      ImagenAsset: IMAGEN_ASSET_POR_ESPECIE[mascota.especie] ?? 'perro_default',
      EsActiva: true,
    });
    if (errMascota) throw errMascota;

    await supabase.from('UserRole').insert({ Id_User: nuevoUserId, Id_Role: 1 });
    await setUsuario(nuevoUserId);
  } catch (err) {
    await supabase.from('UserRole').delete().eq('Id_User', nuevoUserId);
    await supabase.from('Mascota').delete().eq('Id_User', nuevoUserId);
    await supabase.from('User').delete().eq('Id_User', nuevoUserId);
    throw err;
  }

  return {
    mensaje: 'Cuenta creada exitosamente',
    usuario: {
      id: nuevoUserId,
      nombre: nuevoUsuario.Nombre,
      apellido: nuevoUsuario.Apellido,
      email: nuevoUsuario.Mail,
    },
  };
}
