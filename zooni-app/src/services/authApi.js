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

async function hashPassword(password) {
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

  const { data: usuario, error } = await supabase
    .from('User')
    .select('*')
    .ilike('Mail', mail)
    .maybeSingle();
  if (error) throw error;
  if (!usuario) throw new Error('credenciales');

  const hash = await hashPassword(password);
  // Fallback a texto plano para los usuarios demo sembrados por SQL
  // (ej: 'demo-sin-login'), que no pasaron por el registro de la app.
  const coincide = usuario.Contrasena === hash || usuario.Contrasena === password;
  if (!coincide) throw new Error('credenciales');

  await setCurrentUserId(usuario.Id_User);

  const { data: mascotas } = await supabase
    .from('Mascota')
    .select('*')
    .eq('Id_User', usuario.Id_User)
    .order('EsActiva', { ascending: false });

  const mascotaActiva = mascotas?.[0] ?? null;

  return {
    usuario: {
      id: usuario.Id_User,
      nombre: usuario.Nombre,
      apellido: usuario.Apellido,
      email: usuario.Mail,
      fotoPerfil: usuario.FotoPerfil ?? null,
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

// ─────────────────────────────────────────────
// REGISTRO
// ─────────────────────────────────────────────

function fechaNacimientoDesdeMeses(edadMeses) {
  const d = new Date();
  d.setMonth(d.getMonth() - (edadMeses ?? 0));
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
 *     mascota: { nombre, especie, sexo, razaNombre, pesoKg, edadMeses, fotoUri },
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

  // a) email único
  const { data: existente } = await supabase
    .from('User')
    .select('Id_User')
    .ilike('Mail', mail)
    .maybeSingle();
  if (existente) throw new Error('email_existente');

  // b) crear usuario
  const hash = await hashPassword(usuario.password);
  const ubicacionDisplay = [usuario.ciudad, usuario.provincia].filter(Boolean).join(', ') || null;

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
  if (errUsuario) throw errUsuario;

  const nuevoUserId = nuevoUsuario.Id_User;

  try {
    // c) crear mascota (activa, es la primera)
    const { error: errMascota } = await supabase.from('Mascota').insert({
      Id_User: nuevoUserId,
      Nombre: mascota.nombre.trim(),
      Especie: mascota.especie,
      Sexo: mascota.sexo,
      Raza: mascota.razaNombre,
      Peso: mascota.pesoKg,
      FechaNacimiento: fechaNacimientoDesdeMeses(mascota.edadMeses),
      ImagenAsset: IMAGEN_ASSET_POR_ESPECIE[mascota.especie] ?? 'perro_default',
      EsActiva: true,
      // Foto: la subida a Supabase Storage no está integrada todavía;
      // mascota.fotoUri queda solo en el dispositivo por ahora.
    });
    if (errMascota) throw errMascota;

    // d) rol OWNER (id 1 en el seed de Role)
    await supabase.from('UserRole').insert({ Id_User: nuevoUserId, Id_Role: 1 });
  } catch (err) {
    // Rollback manual: no dejar el usuario sin mascota
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
