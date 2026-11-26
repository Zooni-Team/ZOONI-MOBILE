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
  crearVacunaAplicada, editarVacunaAplicada, eliminarVacunaAplicada, fetchVacunas, marcarVacunaSugerida,
} from '../services/fichaMedicaApi';
import { colores } from '../theme';
import { confirmar } from '../utils/dialogo';
import { diasHasta, formatearFecha, parseFechaLocal, toISODateLocal } from '../utils/fechaLocal';

const traerVacunas = async (idMascota) => {
  const { mascota, aplicadas, sugeridas } = await fetchVacunas(idMascota);
  return { mascota, aplicados: aplicadas, sugeridos: sugeridas };
};

function colorProximaDosis(fechaISO) {
  const dias = fechaISO ? diasHasta(fechaISO) : null;
  if (dias == null) return undefined;
  if (dias < 0) return colores.rojo;
  if (dias <= 30) return colores.ambarOscuro;
  return undefined;
}

function estadoSugerida(sugerida) {
  if (!sugerida.applied) return { texto: 'Pendiente', color: colores.ambarOscuro };
  const dias = diasHasta(sugerida.proximo_refuerzo);
  if (dias != null && dias < 0) return { texto: 'Vencida', color: colores.rojo };
  if (dias != null && dias <= 30) return { texto: 'Refuerzo próximo', color: colores.ambarOscuro };
  return { texto: 'Al día', color: colores.verdeOscuro };
}

function proximoRefuerzo(fecha, sugerida) {
  const meses = sugerida?.frecuencia_descripcion?.includes('6 meses') ? 6 : 12;
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + meses);
  return toISODateLocal(d);
}

const FORM_VACIO = { nombre: '', descripcion: '', fecha: null, veterinaria: '' };

export default function VacunasScreen() {
  const salud = useRegistrosSalud(traerVacunas);
  const { toast, mostrarToast } = useToast();

  const [edicion, setEdicion] = useState(null);
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(null);
  const [eligiendoFecha, setEligiendoFecha] = useState(false);

  const cambiar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: null } : e));
  };

  const abrir = (nuevaEdicion, valores) => {
    setEdicion(nuevaEdicion);
    setForm({ ...FORM_VACIO, fecha: new Date(), ...valores });
    setErrores({});
    setErrorGuardar(null);
    setVisible(true);
  };
  const abrirNueva = () => abrir({ modo: 'nueva' });
  const abrirSugerida = (sugerida) => abrir({ modo: 'sugerida', sugerida }, { nombre: sugerida.nombre });
  const abrirEditar = (vacuna) => abrir({ modo: 'editar', vacuna }, {
    nombre: vacuna.nombre,
    descripcion: vacuna.descripcion ?? '',
    fecha: parseFechaLocal(vacuna.fecha_aplicacion),
    veterinaria: vacuna.veterinaria ?? '',
  });

  async function guardar() {
    const faltan = {};
    if (!form.nombre.trim()) faltan.nombre = 'Escribí el nombre de la vacuna';
    if (!form.fecha) faltan.fecha = 'Elegí la fecha en que se aplicó';
    if (Object.keys(faltan).length) { setErrores(faltan); return; }

    const datos = {
      descripcion: form.descripcion.trim() || null,
      fecha_aplicacion: toISODateLocal(form.fecha),
      tipo: edicion.vacuna?.tipo ?? 'Vacuna',
      veterinaria: form.veterinaria.trim() || null,
    };
    setGuardando(true);
    setErrorGuardar(null);
    try {
      if (edicion.modo === 'editar') {
        const editada = await editarVacunaAplicada(edicion.vacuna.id, { ...datos, nombre: form.nombre.trim() });
        salud.setAplicados((prev) => prev.map((v) => (v.id === editada.id ? editada : v)));
        mostrarToast('Vacuna actualizada', colores.verde);
      } else if (edicion.modo === 'sugerida') {
        const refuerzo = proximoRefuerzo(form.fecha, edicion.sugerida);
        const nueva = await marcarVacunaSugerida(salud.idMascota, edicion.sugerida.id, { ...datos, proximo_refuerzo: refuerzo });
        salud.setAplicados((prev) => [nueva, ...prev]);
        salud.setSugeridos((prev) => prev.map((sg) => (
          sg.id === edicion.sugerida.id ? { ...sg, applied: true, proximo_refuerzo: refuerzo } : sg
        )));
        mostrarToast('Vacuna registrada', colores.verde);
      } else {
        const nueva = await crearVacunaAplicada(salud.idMascota, { ...datos, nombre: form.nombre.trim(), proximo_refuerzo: null });
        salud.setAplicados((prev) => [nueva, ...prev]);
        mostrarToast('Vacuna registrada', colores.verde);
      }
      setVisible(false);
    } catch {
      setErrorGuardar('No se pudo guardar la vacuna. Revisá tu conexión y probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(vacuna) {
    const ok = await confirmar(`¿Eliminar ${vacuna.nombre}?`, 'Esta acción no se puede deshacer.',
      { textoOk: 'Eliminar', destructivo: true });
    if (!ok) return;
    try {
      await eliminarVacunaAplicada(vacuna.id);
      salud.setAplicados((prev) => prev.filter((v) => v.id !== vacuna.id));
      if (vacuna.vacuna_sugerida_id != null) {
        salud.setSugeridos((prev) => prev.map((sg) => (
          sg.id === vacuna.vacuna_sugerida_id ? { ...sg, applied: false, proximo_refuerzo: null } : sg
        )));
      }
      mostrarToast('Vacuna eliminada', colores.texto);
    } catch {
      mostrarToast('No se pudo eliminar la vacuna. Probá de nuevo.', colores.rojo);
    }
  }

  const editando = edicion?.modo === 'editar';

  return (
    <>
      <PantallaSalud titulo="Vacunas" mascota={salud.mascota} petId={salud.petId} onCambiarMascota={salud.setPetId}
        cargando={salud.cargando} refrescando={salud.refrescando} onRefrescar={salud.refrescar} toast={toast}>

        {salud.error ? <AvisoError onReintentar={() => salud.reintentar()} /> : null}

        <SeccionSalud titulo="Vacunas" onAnadir={salud.idMascota ? abrirNueva : undefined}
          cargando={salud.cargando} items={salud.aplicados}
          vacio={salud.error ? '' : 'Todavía no cargaste ninguna vacuna'}
          renderItem={(v) => (
            <TarjetaRegistro key={v.id} queEs="vacuna" nombre={v.nombre} descripcion={v.descripcion}
              lineas={[
                { texto: `Aplicada: ${formatearFecha(v.fecha_aplicacion) ?? '—'}` },
                {
                  texto: `Próxima dosis: ${v.proximo_refuerzo ? formatearFecha(v.proximo_refuerzo) : '—'}`,
                  color: colorProximaDosis(v.proximo_refuerzo),
                },
                { texto: `Veterinaria: ${v.veterinaria ?? 'Sin registro'}` },
              ]}
              onEditar={() => abrirEditar(v)} onEliminar={() => eliminar(v)} />
          )} />

        <SeccionSalud titulo="Vacunas sugeridas" icono="calendar-outline" placeholders={3}
          cargando={salud.cargando} items={salud.sugeridos}
          vacio={salud.error ? '' : 'No hay vacunas sugeridas para esta especie'}
          renderItem={(sg, i) => (
            <TarjetaSugerido key={sg.id} orden={i} nombre={sg.nombre} detalle={sg.dosis}
              estado={estadoSugerida(sg)} frecuencia={sg.frecuencia_descripcion}
              aplicada={sg.applied} onRegistrar={() => abrirSugerida(sg)} />
          )} />
      </PantallaSalud>

      <ModalFormulario visible={visible}
        titulo={editando ? 'Editar vacuna' : 'Registrar vacuna'}
        textoGuardar={editando ? 'Guardar cambios' : 'Guardar'}
        guardando={guardando} error={errorGuardar} onGuardar={guardar} onCerrar={() => setVisible(false)}>
        <CampoTexto etiqueta="Vacuna" placeholder="Ej.: Antirrábica" value={form.nombre}
          bloqueado={edicion?.modo === 'sugerida'} error={errores.nombre}
          onChangeText={(v) => cambiar('nombre', v)} returnKeyType="next" maxLength={120} />
        <CampoFecha etiqueta="Fecha de aplicación" valor={form.fecha} error={errores.fecha}
          onAbrir={() => setEligiendoFecha(true)} />
        <CampoTexto etiqueta="Veterinaria (opcional)" placeholder="Dónde se la aplicaron" value={form.veterinaria}
          onChangeText={(v) => cambiar('veterinaria', v)} returnKeyType="next" maxLength={120} />
        <CampoTexto etiqueta="Notas (opcional)" placeholder="Marca, lote, reacciones…" value={form.descripcion}
          onChangeText={(v) => cambiar('descripcion', v)} multilinea maxLength={400} />
      </ModalFormulario>

      <FechaPicker visible={eligiendoFecha} titulo="Fecha de aplicación" sinFuturo
        valor={form.fecha ?? new Date()}
        onConfirmar={(d) => { cambiar('fecha', d); setEligiendoFecha(false); }}
        onCancelar={() => setEligiendoFecha(false)} />
    </>
  );
}
