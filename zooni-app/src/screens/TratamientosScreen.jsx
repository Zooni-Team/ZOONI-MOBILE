/**
 * TratamientosScreen.jsx — Tratamientos de una mascota (desparasitaciones,
 * medicación, controles).
 *
 * Llega desde la Ficha Médica con { petId } (o usa la mascota activa). Muestra
 * los tratamientos cargados (se pueden agregar, editar y eliminar) y los
 * sugeridos para la especie, que se registran con un toque.
 *
 * El armazón y las tarjetas son los mismos que en Vacunas (components/salud).
 */

import { useState } from 'react';

import FechaPicker from '../components/FechaPicker';
import AvisoError from '../components/salud/AvisoError';
import ModalFormulario, { CampoFecha, CampoTexto } from '../components/salud/ModalFormulario';
import PantallaSalud from '../components/salud/PantallaSalud';
import SeccionSalud from '../components/salud/SeccionSalud';
import TarjetaRegistro from '../components/salud/TarjetaRegistro';
import TarjetaSugerido from '../components/salud/TarjetaSugerido';
import { useRegistrosSalud } from '../hooks/useRegistrosSalud';
import { useToast } from '../hooks/useToast';
import {
  crearTratamiento, editarTratamiento, eliminarTratamiento, fetchTratamientos,
} from '../services/fichaMedicaApi';
import { colores } from '../theme';
import { confirmar } from '../utils/dialogo';
import { cuentaRegresiva, formatearFecha, parseFechaLocal, toISODateLocal } from '../utils/fechaLocal';

const traerTratamientos = async (idMascota) => {
  const { mascota, aplicados, sugeridos } = await fetchTratamientos(idMascota);
  return { mascota, aplicados, sugeridos };
};

const COLOR_VENCIMIENTO = { vencido: colores.rojo, pronto: colores.ambarOscuro, lejos: colores.texto };

const FORM_VACIO = { nombre: '', descripcion: '', inicio: null, control: null, veterinaria: '' };

export default function TratamientosScreen() {
  const salud = useRegistrosSalud(traerTratamientos);
  const { toast, mostrarToast } = useToast();

  // `edicion`: { tratamiento } si se edita uno, { sugerido } si se registra
  // uno sugerido, {} si es uno nuevo. Una sola variable decide qué hace
  // "Guardar" (con dos se desincronizaban y "Guardar cambios" creaba un duplicado).
  const [edicion, setEdicion] = useState({});
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(null);
  const [eligiendo, setEligiendo] = useState(null); // 'inicio' | 'control' | null

  const cambiar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: null } : e));
  };

  const abrir = (nuevaEdicion, valores) => {
    setEdicion(nuevaEdicion);
    setForm({ ...FORM_VACIO, inicio: new Date(), ...valores });
    setErrores({});
    setErrorGuardar(null);
    setVisible(true);
  };
  const abrirNuevo = () => abrir({});
  const abrirSugerido = (sugerido) => abrir({ sugerido }, { nombre: sugerido.nombre });
  const abrirEditar = (t) => abrir({ tratamiento: t }, {
    nombre: t.nombre ?? '',
    descripcion: t.descripcion ?? '',
    inicio: parseFechaLocal(t.fecha_inicio),
    control: parseFechaLocal(t.proximo_control),
    veterinaria: t.veterinaria ?? '',
  });

  async function guardar() {
    const faltan = {};
    if (!form.nombre.trim()) faltan.nombre = 'Escribí el nombre del tratamiento';
    if (!form.inicio) faltan.inicio = 'Elegí cuándo empezó';
    else if (form.control && form.control < form.inicio) faltan.control = 'El control no puede ser antes del inicio';
    if (Object.keys(faltan).length) { setErrores(faltan); return; }

    const datos = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      fecha_inicio: toISODateLocal(form.inicio),
      proximo_control: form.control ? toISODateLocal(form.control) : null,
      veterinaria: form.veterinaria.trim() || null,
    };
    setGuardando(true);
    setErrorGuardar(null);
    try {
      if (edicion.tratamiento) {
        const editado = await editarTratamiento(edicion.tratamiento.id, datos);
        salud.setAplicados((prev) => prev.map((t) => (t.id === editado.id ? editado : t)));
        mostrarToast('Tratamiento actualizado', colores.verde);
      } else {
        const nuevo = await crearTratamiento(salud.idMascota, datos);
        salud.setAplicados((prev) => [nuevo, ...prev]);
        if (edicion.sugerido) {
          salud.setSugeridos((prev) => prev.map((sg) => (
            sg.id === edicion.sugerido.id ? { ...sg, applied: true, tratamiento_aplicado_id: nuevo.id } : sg
          )));
        }
        mostrarToast('Tratamiento registrado', colores.verde);
      }
      setVisible(false);
    } catch {
      setErrorGuardar('No se pudo guardar el tratamiento. Revisá tu conexión y probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(tratamiento) {
    const ok = await confirmar(`¿Eliminar ${tratamiento.nombre}?`, 'Esta acción no se puede deshacer.',
      { textoOk: 'Eliminar', destructivo: true });
    if (!ok) return;
    try {
      await eliminarTratamiento(tratamiento.id);
      salud.setAplicados((prev) => prev.filter((t) => t.id !== tratamiento.id));
      // Si venía de un sugerido, su tarjeta vuelve a ofrecer "Registrar".
      salud.setSugeridos((prev) => prev.map((sg) => (
        sg.tratamiento_aplicado_id === tratamiento.id ? { ...sg, applied: false, tratamiento_aplicado_id: null } : sg
      )));
      mostrarToast('Tratamiento eliminado', colores.texto);
    } catch {
      mostrarToast('No se pudo eliminar el tratamiento. Probá de nuevo.', colores.rojo);
    }
  }

  const editando = !!edicion.tratamiento;

  return (
    <>
      <PantallaSalud titulo="Tratamientos" mascota={salud.mascota} petId={salud.petId} onCambiarMascota={salud.setPetId}
        cargando={salud.cargando} refrescando={salud.refrescando} onRefrescar={salud.refrescar} toast={toast}>

        {salud.error ? <AvisoError onReintentar={() => salud.reintentar()} /> : null}

        <SeccionSalud titulo="Tratamientos" onAnadir={salud.idMascota ? abrirNuevo : undefined} placeholders={3}
          cargando={salud.cargando} items={salud.aplicados}
          vacio={salud.error ? '' : 'Todavía no cargaste ningún tratamiento'}
          renderItem={(t) => {
            const cuenta = cuentaRegresiva(t.proximo_control);
            const destacado = cuenta && { texto: cuenta.texto, color: COLOR_VENCIMIENTO[cuenta.tono] };
            return (
              <TarjetaRegistro key={t.id} queEs="tratamiento" nombre={t.nombre} descripcion={t.descripcion}
                lineas={[
                  { texto: `Inicio: ${formatearFecha(t.fecha_inicio) ?? '—'}` },
                  { texto: `Próximo control: ${t.proximo_control ? formatearFecha(t.proximo_control) : 'Sin fecha'}` },
                  { texto: `Veterinaria: ${t.veterinaria ?? 'Sin registro'}` },
                ]}
                destacado={destacado}
                onEditar={() => abrirEditar(t)} onEliminar={() => eliminar(t)} />
            );
          }} />

        <SeccionSalud titulo="Tratamientos sugeridos" icono="clipboard-outline"
          cargando={salud.cargando} items={salud.sugeridos}
          vacio={salud.error ? '' : 'No hay tratamientos sugeridos para esta especie'}
          renderItem={(sg, i) => (
            <TarjetaSugerido key={sg.id} orden={i} nombre={sg.nombre} frecuencia={sg.frecuencia_descripcion}
              aplicada={sg.applied} onRegistrar={() => abrirSugerido(sg)} />
          )} />
      </PantallaSalud>

      <ModalFormulario visible={visible}
        titulo={editando ? 'Editar tratamiento' : 'Registrar tratamiento'}
        textoGuardar={editando ? 'Guardar cambios' : 'Guardar'}
        guardando={guardando} error={errorGuardar} onGuardar={guardar} onCerrar={() => setVisible(false)}>
        <CampoTexto etiqueta="Tratamiento" placeholder="Ej.: Desparasitación interna" value={form.nombre}
          error={errores.nombre} onChangeText={(v) => cambiar('nombre', v)} returnKeyType="next" maxLength={120} />
        <CampoFecha etiqueta="Fecha de inicio" valor={form.inicio} error={errores.inicio}
          onAbrir={() => setEligiendo('inicio')} />
        <CampoFecha etiqueta="Próximo control (opcional)" valor={form.control} vacio="Sin fecha" error={errores.control}
          onAbrir={() => setEligiendo('control')} />
        <CampoTexto etiqueta="Veterinaria (opcional)" placeholder="Quién lo indicó" value={form.veterinaria}
          onChangeText={(v) => cambiar('veterinaria', v)} returnKeyType="next" maxLength={120} />
        <CampoTexto etiqueta="Notas (opcional)" placeholder="Dosis, cada cuánto, hasta cuándo…" value={form.descripcion}
          onChangeText={(v) => cambiar('descripcion', v)} multilinea maxLength={400} />
      </ModalFormulario>

      {/* A diferencia de las vacunas, acá sí hay fechas futuras (el control). */}
      <FechaPicker visible={eligiendo != null} aniosAdelante={5}
        titulo={eligiendo === 'control' ? 'Próximo control' : 'Fecha de inicio'}
        valor={(eligiendo === 'control' ? form.control : form.inicio) ?? new Date()}
        onConfirmar={(d) => { cambiar(eligiendo, d); setEligiendo(null); }}
        onCancelar={() => setEligiendo(null)} />
    </>
  );
}
