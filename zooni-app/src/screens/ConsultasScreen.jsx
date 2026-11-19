/**
 * ConsultasScreen.jsx — Historial de consultas veterinarias de una mascota:
 * motivo, fecha, quién la atendió, notas y una imagen opcional (estudio,
 * receta, foto de la lesión).
 *
 * La imagen es información clínica: va al bucket PRIVADO consultas-privadas y
 * se muestra con una URL firmada de corta duración (services/fichaMedicaApi).
 * El armazón y las tarjetas son los mismos que en Vacunas y Tratamientos.
 */

import { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import FechaPicker from '../components/FechaPicker';
import AvisoError from '../components/salud/AvisoError';
import ModalFormulario, { CampoFecha, CampoTexto } from '../components/salud/ModalFormulario';
import PantallaSalud from '../components/salud/PantallaSalud';
import SeccionSalud from '../components/salud/SeccionSalud';
import TarjetaRegistro from '../components/salud/TarjetaRegistro';
import { useRegistrosSalud } from '../hooks/useRegistrosSalud';
import { useToast } from '../hooks/useToast';
import { crearConsulta, eliminarConsulta, fetchConsultas, fetchMascota } from '../services/fichaMedicaApi';
import { colores } from '../theme';
import { confirmar } from '../utils/dialogo';
import { elegirImagen } from '../utils/elegirImagen';
import { formatearFecha, toISODateLocal } from '../utils/fechaLocal';
import { subirImagenPrivada } from '../services/imagenStorage';

const traerConsultas = async (idMascota) => {
  const [mascota, consultas] = await Promise.all([fetchMascota(idMascota), fetchConsultas(idMascota)]);
  return { mascota, aplicados: consultas, sugeridos: [] };
};

const masNuevaPrimero = (a, b) => (a.fecha < b.fecha ? 1 : -1);
const FORM_VACIO = { motivo: '', fecha: null, veterinario: '', notas: '', imagen: null };

export default function ConsultasScreen() {
  const salud = useRegistrosSalud(traerConsultas);
  const { toast, mostrarToast } = useToast();

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

  // La fecha arranca en hoy, calculada al abrir.
  const abrir = () => {
    setForm({ ...FORM_VACIO, fecha: new Date() });
    setErrores({});
    setErrorGuardar(null);
    setVisible(true);
  };

  async function adjuntar() {
    const uri = await elegirImagen();
    if (uri) cambiar('imagen', uri);
  }

  async function guardar() {
    const faltan = {};
    if (!form.motivo.trim()) faltan.motivo = 'Escribí el motivo de la consulta';
    if (!form.fecha) faltan.fecha = 'Elegí la fecha de la consulta';
    if (Object.keys(faltan).length) { setErrores(faltan); return; }

    setGuardando(true);
    setErrorGuardar(null);
    try {
      // La imagen primero. Si no se puede subir, la consulta se guarda igual
      // (no se pierde lo anotado) y se avisa.
      let imagenPath = null;
      let sinImagen = false;
      if (form.imagen) {
        try {
          imagenPath = await subirImagenPrivada(form.imagen, 'consultas');
        } catch {
          sinImagen = true;
        }
      }
      const nueva = await crearConsulta(salud.idMascota, {
        motivo: form.motivo.trim(),
        fecha: toISODateLocal(form.fecha),
        veterinario: form.veterinario.trim() || null,
        notas: form.notas.trim() || null,
        imagen_path: imagenPath,
      });
      salud.setAplicados((prev) => [nueva, ...prev].sort(masNuevaPrimero));
      setVisible(false);
      mostrarToast(sinImagen ? 'Consulta guardada, pero sin la imagen (no se pudo subir)' : 'Consulta registrada',
        sinImagen ? colores.ambarOscuro : colores.verde);
    } catch {
      setErrorGuardar('No se pudo guardar la consulta. Revisá tu conexión y probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(consulta) {
    const ok = await confirmar(`¿Eliminar la consulta "${consulta.motivo}"?`, 'Esta acción no se puede deshacer.',
      { textoOk: 'Eliminar', destructivo: true });
    if (!ok) return;
    try {
      await eliminarConsulta(consulta.id);
      salud.setAplicados((prev) => prev.filter((c) => c.id !== consulta.id));
      mostrarToast('Consulta eliminada', colores.texto);
    } catch {
      mostrarToast('No se pudo eliminar la consulta. Probá de nuevo.', colores.rojo);
    }
  }

  return (
    <>
      <PantallaSalud titulo="Consultas" mascota={salud.mascota} petId={salud.petId} onCambiarMascota={salud.setPetId}
        cargando={salud.cargando} refrescando={salud.refrescando} onRefrescar={salud.refrescar} toast={toast}>

        {salud.error ? <AvisoError onReintentar={() => salud.reintentar()} /> : null}

        <SeccionSalud titulo="Historial clínico" onAnadir={salud.idMascota ? abrir : undefined} placeholders={3}
          cargando={salud.cargando} items={salud.aplicados}
          vacio={salud.error ? ''
            : `Anotá acá cada visita al veterinario (motivo, indicaciones, notas) para tener el historial de ${salud.mascota.nombre}.`}
          renderItem={(c) => (
            <TarjetaRegistro key={c.id} queEs="consulta" nombre={c.motivo} descripcion={c.notas}
              lineas={[
                { texto: `Fecha: ${formatearFecha(c.fecha) ?? '—'}` },
                ...(c.veterinario ? [{ texto: `Atendió: ${c.veterinario}` }] : []),
              ]}
              onEliminar={() => eliminar(c)}>
              {c.imagen_url ? (
                <Image source={{ uri: c.imagen_url }} style={s.imagen} resizeMode="cover"
                  accessibilityLabel={`Imagen adjunta a ${c.motivo}`} />
              ) : null}
            </TarjetaRegistro>
          )} />
      </PantallaSalud>

      <ModalFormulario visible={visible} titulo="Nueva consulta" guardando={guardando} error={errorGuardar}
        onGuardar={guardar} onCerrar={() => setVisible(false)}>
        <CampoTexto etiqueta="Motivo" placeholder="Ej.: Control anual" value={form.motivo} error={errores.motivo}
          onChangeText={(v) => cambiar('motivo', v)} returnKeyType="next" maxLength={150} />
        <CampoFecha etiqueta="Fecha" valor={form.fecha} error={errores.fecha} onAbrir={() => setEligiendoFecha(true)} />
        <CampoTexto etiqueta="Veterinario/a o clínica (opcional)" placeholder="Quién la atendió" value={form.veterinario}
          onChangeText={(v) => cambiar('veterinario', v)} returnKeyType="next" maxLength={120} />
        <CampoTexto etiqueta="Notas (opcional)" placeholder="Diagnóstico, indicaciones…" value={form.notas}
          onChangeText={(v) => cambiar('notas', v)} multilinea maxLength={2000} />

        {form.imagen ? (
          <View style={s.previa}>
            <Image source={{ uri: form.imagen }} style={s.previaImagen} resizeMode="cover"
              accessibilityLabel="Imagen para adjuntar" />
            <TouchableOpacity style={s.quitar} onPress={() => cambiar('imagen', null)} hitSlop={8}
              accessibilityRole="button" accessibilityLabel="Quitar imagen">
              <Ionicons name="close" size={18} color={colores.blanco} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.adjuntar} onPress={adjuntar} activeOpacity={0.8} accessibilityRole="button">
            <Ionicons name="image-outline" size={18} color={colores.verdeOscuro} />
            <Text style={s.adjuntarTxt}>Adjuntar estudio o receta (opcional)</Text>
          </TouchableOpacity>
        )}
      </ModalFormulario>

      {/* Una consulta que ya pasó: sin fechas futuras. */}
      <FechaPicker visible={eligiendoFecha} titulo="Fecha de la consulta" sinFuturo
        valor={form.fecha ?? new Date()}
        onConfirmar={(d) => { cambiar('fecha', d); setEligiendoFecha(false); }}
        onCancelar={() => setEligiendoFecha(false)} />
    </>
  );
}

const s = StyleSheet.create({
  imagen: { width: '100%', height: 180, borderRadius: 10, marginTop: 10, backgroundColor: colores.gris200 },
  adjuntar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colores.verde, borderStyle: 'dashed', borderRadius: 12,
    minHeight: 48, marginBottom: 12, backgroundColor: colores.mentaFondo,
  },
  adjuntarTxt: { fontSize: 14, fontWeight: '600', color: colores.verdeOscuro },
  previa: { marginBottom: 12 },
  previaImagen: { width: '100%', height: 160, borderRadius: 12, backgroundColor: colores.gris200 },
  quitar: {
    position: 'absolute', top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
});
