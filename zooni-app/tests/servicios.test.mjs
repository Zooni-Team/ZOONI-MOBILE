// Servicios (src/services) contra el doble de Supabase (tests/dobles/supabase.mjs).
// Prueban QUÉ le piden a la base y cómo traducen sus respuestas y errores.
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { fake } from './dobles/supabase.mjs';
import { errorApp, errorBase, esEsquemaFaltante, notificar, resumir } from '../src/services/comun.js';
import { consultarPerfiles, perfilesPorId } from '../src/services/perfilesPublicos.js';
import { crearCuentaConPassword, iniciarSesionConPassword, login, verificarDisponibilidad } from '../src/services/authApi.js';
import { postMatchLike, postMatchSkip } from '../src/services/matchApi.js';
import { preguntarZooniVet } from '../src/services/zoonivetApi.js';
import {
  ACCIONES_TURNO, cambiarEstadoPedido, costoEnvio, crearPedido, crearTurno, precioItem, precioTurno,
  recargoDomicilio, siguienteEstadoPedido,
} from '../src/services/negocioApi.js';
import { getCurrentUserId, restaurarSesion, setCurrentUserId } from '../src/config/session.js';

beforeEach(() => fake.reiniciar());

describe('comun', () => {
  test('errorApp guarda el código y el detalle real de Supabase', () => {
    const e = errorApp('sin_stock', { message: 'm', details: 'd', code: 'P0001' });
    assert.equal(e.message, 'sin_stock');
    assert.equal(e.detalle, 'm · d · código P0001');
  });
  test('errorBase distingue migración pendiente de error genérico', () => {
    assert.equal(errorBase({ code: '42P01' }).message, 'migracion_pendiente');
    assert.equal(errorBase({ code: '23505' }).message, 'error_base');
    assert.ok(esEsquemaFaltante({ message: 'column x does not exist' }));
  });
  test('notificar inserta en Notificacion y nunca falla', async () => {
    await notificar(7, 'Hola', 'Mensaje', { tipo: 'pedido', destino: 'pedidos' });
    const [op] = fake.de('tabla');
    assert.equal(op.tabla, 'Notificacion');
    assert.equal(op.accion, 'insert');
    assert.deepEqual(op.datos.DataExtra, { destino: 'pedidos' });
    await notificar(null, 'x', 'y'); // sin destinatario: no hace nada
    assert.equal(fake.de('tabla').length, 1);
    assert.equal(resumir('a'.repeat(100)).length, 81);
  });
});

describe('perfilesPublicos (mínimo dato)', () => {
  test('lee de la vista perfil_publico con las columnas pedidas', async () => {
    fake.responder(() => ({ data: [{ Id_User: 2, Nombre: 'Ana' }] }));
    const filas = await perfilesPorId([2, 2, null], 'Id_User, Nombre');
    assert.deepEqual(filas, [{ Id_User: 2, Nombre: 'Ana' }]);
    const [op] = fake.de('tabla');
    assert.equal(op.tabla, 'perfil_publico');
    assert.equal(op.columnas, 'Id_User, Nombre');
    assert.deepEqual(op.filtros[0], ['in', 'Id_User', [2]]);
  });
  test('sin la vista (061 sin correr) usa "User" y calcula la edad', async () => {
    fake.responder((op) => (op.tabla === 'perfil_publico'
      ? { error: { code: 'PGRST205' } }
      : { data: [{ Id_User: 3, FechaNacimiento: '2000-01-01' }] }));
    const [u] = await consultarPerfiles('Id_User, Edad', (q) => q.eq('Id_User', 3));
    assert.equal(fake.de('tabla')[1].columnas, 'Id_User, FechaNacimiento');
    assert.equal(typeof u.Edad, 'number');
    assert.equal('FechaNacimiento' in u, false);
  });
  test('sin ids no consulta', async () => {
    assert.deepEqual(await perfilesPorId([]), []);
    assert.equal(fake.llamadas.length, 0);
  });
});

describe('authApi (Supabase Auth)', () => {
  const cuenta = { id: 9, nombre: 'Ana', apellido: 'P', email: 'ana@x.com', fotoPerfil: null };

  test('login correcto: signInWithPassword + login_social', async () => {
    fake.auth('signInWithPassword', { data: {}, error: null });
    fake.rpc('login_social', { data: cuenta });
    const u = await iniciarSesionConPassword(' ANA@x.com ', 'secreta1');
    assert.equal(u.id, 9);
    assert.equal(fake.de('auth')[0].args[0].email, 'ana@x.com');
  });

  test('cuenta vieja: migra con la función de la base (065) sin tocar la Edge Function', async () => {
    let intentos = 0;
    fake.auth('signInWithPassword', () => (intentos++ === 0
      ? { error: { code: 'invalid_credentials', message: 'Invalid login credentials' } }
      : { data: {}, error: null }));
    fake.rpc('migrar_cuenta_legada', { data: true });
    fake.rpc('login_social', { data: cuenta });
    const u = await iniciarSesionConPassword('ana@x.com', 'secreta1');
    assert.equal(u.id, 9);
    assert.equal(intentos, 2);
    assert.deepEqual(fake.de('rpc')[0].params, { p_mail: 'ana@x.com', p_password: 'secreta1' });
    assert.equal(fake.de('funcion').length, 0);
  });

  test('contraseña mala con 065: credenciales, sin login viejo', async () => {
    fake.auth('signInWithPassword', { error: { message: 'Invalid login credentials' } });
    fake.rpc('migrar_cuenta_legada', { data: false });
    await assert.rejects(iniciarSesionConPassword('ana@x.com', 'mala'), /credenciales/);
    assert.equal(fake.de('rpc').some((r) => r.nombre === 'login_user'), false);
  });

  test('base sin 065: migra con la Edge Function y reintenta', async () => {
    let intentos = 0;
    fake.auth('signInWithPassword', () => (intentos++ === 0
      ? { error: { code: 'invalid_credentials', message: 'Invalid login credentials' } }
      : { data: {}, error: null }));
    fake.funcion('migrar-cuenta', { data: { migrada: true } });
    fake.rpc('login_social', { data: cuenta });
    const u = await iniciarSesionConPassword('ana@x.com', 'secreta1');
    assert.equal(u.id, 9);
    assert.equal(intentos, 2);
    assert.deepEqual(fake.de('funcion')[0].body, { email: 'ana@x.com', password: 'secreta1' });
  });

  test('contraseña mala: Error("credenciales") sin decir si el mail existe', async () => {
    fake.auth('signInWithPassword', { error: { message: 'Invalid login credentials' } });
    fake.funcion('migrar-cuenta', { data: { migrada: false } });
    await assert.rejects(iniciarSesionConPassword('ana@x.com', 'mala'), /credenciales/);
  });

  test('sin la Edge Function desplegada: cae al login viejo (transición)', async () => {
    fake.auth('signInWithPassword', { error: { message: 'Invalid login credentials' } });
    fake.rpc('login_user', { data: cuenta });
    const u = await iniciarSesionConPassword('ana@x.com', 'secreta1');
    assert.equal(u.legado, true);
    const hash = fake.de('rpc').find((r) => r.nombre === 'login_user').params.p_hash;
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  test('registro con "Confirm email" activo: avisa confirmar_mail', async () => {
    fake.auth('signUp', { data: { session: null }, error: null });
    await assert.rejects(crearCuentaConPassword('n@x.com', 'secreta1'), /confirmar_mail/);
    await assert.rejects(crearCuentaConPassword('n@x.com', '123'), /password_corta/);
  });

  test('registro con mail ya usado (y otra contraseña): email_existente', async () => {
    fake.auth('signUp', { error: { message: 'User already registered' } });
    fake.auth('signInWithPassword', { error: { message: 'Invalid login credentials' } });
    await assert.rejects(crearCuentaConPassword('n@x.com', 'secreta1'), /email_existente/);
  });

  test('verificarDisponibilidad usa la RPC y ante error deja seguir', async () => {
    fake.rpc('disponibilidad_registro', { data: { mailTomado: true, usuarioTomado: false } });
    assert.deepEqual(await verificarDisponibilidad({ email: 'A@x.com', nombreUsuario: '@ana' }), { mailTomado: true, usuarioTomado: false });
    assert.deepEqual(fake.de('rpc')[0].params, { p_mail: 'a@x.com', p_usuario: 'ana' });
    fake.rpc('disponibilidad_registro', { error: { message: 'x' } });
    assert.deepEqual(await verificarDisponibilidad({ email: 'a@x.com' }), { mailTomado: false, usuarioTomado: false });
  });

  test('login de dueños deja la sesión y devuelve la mascota activa', async () => {
    fake.auth('signInWithPassword', { data: {}, error: null });
    fake.rpc('login_social', { data: cuenta });
    fake.responder((op) => (op.tabla === 'Mascota'
      ? { data: [{ Id_Mascota: 4, Nombre: 'Toby', Especie: 'perro', Raza: 'Mestizo', ImagenAsset: null }] }
      : {}));
    const r = await login('ana@x.com', 'secreta1');
    assert.equal(getCurrentUserId(), 9);
    assert.equal(r.mascotaActiva.imagen_asset, 'perro_default');
  });
});

describe('session', () => {
  test('restaurarSesion: con sesión de Auth pregunta la cuenta; sin sesión, null', async () => {
    fake.sesion({ user: { id: 'uuid' } });
    fake.rpc('login_social', { data: { id: 5, nuevo: false } });
    assert.equal(await restaurarSesion(), 5);
    fake.reiniciar();
    assert.equal(await restaurarSesion(), null);
  });
});

describe('matchApi', () => {
  test('like: lo decide la RPC votar_mascota con la mascota activa', async () => {
    setCurrentUserId(1);
    fake.responder((op) => (op.tabla === 'Mascota' ? { data: { Id_Mascota: 10 } } : {}));
    fake.rpc('votar_mascota', { data: { match: true, match_id: 3 } });
    const r = await postMatchLike(20);
    assert.equal(r.match_id, 3);
    assert.deepEqual(fake.de('rpc')[0].params, { p_origen: 10, p_destino: 20, p_le_gusta: true });
    await postMatchSkip(21);
    assert.equal(fake.de('rpc')[1].params.p_le_gusta, false);
    assert.equal(fake.de('tabla').some((op) => op.tabla === 'Match'), false, 'el cliente no crea Match');
  });
});

describe('zoonivetApi', () => {
  const ctx = { id: 4 };
  test('manda la pregunta a la Edge Function (sin clave en el cliente)', async () => {
    fake.funcion('zoonivet-chat', { data: { texto: 'Hola', emergencia: false } });
    const r = await preguntarZooniVet({ ctx, historial: [{ role: 'user', content: 'a', extra: 1 }], mensaje: 'b' });
    assert.deepEqual(r, { texto: 'Hola', emergencia: false });
    const { body } = fake.de('funcion')[0];
    assert.equal(body.petId, 4);
    assert.deepEqual(body.historial, [{ role: 'user', content: 'a' }]);
  });
  test('función sin desplegar → SERVICIO_NO_DISPONIBLE; error con código → ese código', async () => {
    await assert.rejects(preguntarZooniVet({ ctx, mensaje: 'x' }), (e) => e.code === 'SERVICIO_NO_DISPONIBLE');
    fake.funcion('zoonivet-chat', { error: { name: 'FunctionsHttpError', context: { status: 429, json: async () => ({ error: 'RATE_LIMIT' }) } } });
    await assert.rejects(preguntarZooniVet({ ctx, mensaje: 'x' }), (e) => e.code === 'RATE_LIMIT');
  });
});

describe('negocioApi', () => {
  const petshop = { id: 1, idUser: 50, nombre: 'Pet', abierto: true, tipo: 'petshop',
    datos: { envios: true, envioCosto: 500, envioGratisDesde: 10000, pedidoMinimo: 0 } };

  test('precios: por tamaño, mínimo, recargo a domicilio', () => {
    assert.equal(precioItem({ precio: 100 }), 100);
    assert.equal(precioItem({ precios: { chico: 80, grande: 120 } }, 'grande'), 120);
    assert.equal(precioItem({ precios: { chico: 80, grande: 120 } }, 'mediano'), 80);
    const pelu = { tipo: 'peluqueria', datos: { buscaYLlevaCosto: 300 } };
    assert.equal(recargoDomicilio(pelu, true), 300);
    assert.equal(recargoDomicilio({ ...pelu, tipo: 'veterinaria' }, true), 0);
    assert.equal(precioTurno(pelu, { precio: 1000.004 }, null, true), 1300);
  });

  test('envío: gratis desde un monto; sin envíos → null', () => {
    assert.equal(costoEnvio(petshop, 2000), 500);
    assert.equal(costoEnvio(petshop, 10000), 0);
    assert.equal(costoEnvio({ datos: {} }, 10), null);
  });

  test('estados de pedido y turno', () => {
    assert.equal(siguienteEstadoPedido({ estado: 'nuevo' }), 'preparando');
    assert.equal(siguienteEstadoPedido({ estado: 'preparando', entrega: 'envio' }), 'en_camino');
    assert.equal(siguienteEstadoPedido({ estado: 'preparando', entrega: 'retiro' }), 'listo');
    assert.equal(siguienteEstadoPedido({ estado: 'entregado' }), null);
    assert.deepEqual(ACCIONES_TURNO.pendiente, ['confirmado', 'rechazado']);
  });

  test('crearPedido: si la base dice sin_stock, la pantalla recibe qué productos', async () => {
    setCurrentUserId(7);
    fake.responder((op) => {
      if (op.tabla === 'negocio_items') return { data: [{ id: 1, nombre: 'Alimento', precio: 1000, stock: 5, activo: true }] };
      if (op.tabla === 'negocio_pedidos') return { error: { message: 'sin_stock', details: 'Alimento' } };
      return {};
    });
    await assert.rejects(
      crearPedido({ negocio: petshop, carrito: [{ item: { id: 1, nombre: 'Alimento' }, cantidad: 1 }], entrega: 'retiro' }),
      (e) => e.message === 'sin_stock' && e.productos[0] === 'Alimento',
    );
  });

  test('crearPedido: el cliente ya no descuenta stock (lo hace la base)', async () => {
    setCurrentUserId(7);
    fake.responder((op) => {
      if (op.tabla === 'negocio_items') return { data: [{ id: 1, nombre: 'A', precio: 1000, stock: 5, activo: true }] };
      if (op.tabla === 'negocio_pedidos') return { data: { id: 99, total: 1500 } };
      return {};
    });
    const id = await crearPedido({ negocio: petshop, carrito: [{ item: { id: 1, nombre: 'A' }, cantidad: 1 }], entrega: 'envio', direccion: 'x' });
    assert.equal(id, 99);
    assert.equal(fake.de('tabla').some((op) => op.tabla === 'negocio_items' && op.accion === 'update'), false);
  });

  test('cambiarEstadoPedido: transición inválida se frena antes de ir a la base', async () => {
    await assert.rejects(cambiarEstadoPedido(petshop, { id: 1, estado: 'entregado', items: [] }, 'preparando'), /transicion_invalida/);
    assert.equal(fake.llamadas.length, 0);
  });

  test('crearTurno: horario tomado por otro entre medio → horario_ocupado', async () => {
    setCurrentUserId(7);
    fake.responder((op) => (op.tabla === 'negocio_turnos' && op.accion === 'insert'
      ? { error: { message: 'horario_ocupado' } }
      : { data: [] }));
    await assert.rejects(crearTurno({
      negocio: { ...petshop, tipo: 'veterinaria' }, item: { id: 2, nombre: 'Consulta', duracionMin: 30, precio: 8000 },
      mascota: { id: 4, nombre: 'Toby' }, fecha: new Date(2030, 0, 1, 10),
    }), /horario_ocupado/);
  });
});
