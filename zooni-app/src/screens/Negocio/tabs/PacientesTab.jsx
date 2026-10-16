/**
 * PacientesTab.jsx — Pacientes (veterinaria) / Clientes (peluquería)
 *
 * Una ficha por mascota que atendiste o que tiene turno, armada con sus
 * turnos (fetchPacientes): última visita, próximo turno y —en veterinarias—
 * el próximo control indicado. Buscador por mascota, raza o dueño, y filtros
 * rápidos. Tocar una abre su historia completa (FichaPacienteModal), donde se
 * puede corregir el informe de cada visita.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, Vacio, sombra } from '../../../components/paseador/PaseadorUI';
import { Etiqueta, Segmento } from '../../../components/negocio/NegocioUI';
import FichaPacienteModal from '../../../components/negocio/FichaPacienteModal';
import InformeModal from '../../../components/negocio/InformeModal';
import { cuandoTexto, diaTexto, fetchPacientes, guardarInforme } from '../../../services/negocioApi';

const normalizar = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function PacientesTab({ negocio, tipo, avisar, abrirChat }) {
  const esVet = tipo === 'veterinaria';
  const [fichas, setFichas] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [refrescando, setRefrescando] = useState(false);
  const [abierta, setAbierta] = useState(null); // idMascota
  const [editando, setEditando] = useState(null); // turno

  const cargar = useCallback(async () => {
    try {
      setFichas(await fetchPacientes(negocio.id));
    } catch {
      setFichas((f) => f ?? []);
      avisar('No se pudieron cargar las fichas.', 'alert-circle');
    }
  }, [negocio.id, avisar]);

  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return (fichas ?? []).filter((f) => {
      if (filtro === 'turno' && !f.proximo) return false;
      if (filtro === 'control' && !f.proximoControl) return false;
      if (!q) return true;
      return [f.mascota.nombre, f.mascota.raza, f.mascota.especie, f.dueno.nombre].some((x) => normalizar(x).includes(q));
    });
  }, [fichas, busqueda, filtro]);

  const ficha = fichas?.find((f) => f.mascota.id === abierta) ?? null;

  const guardarEdicion = async (informe) => {
    await guardarInforme(negocio, editando, informe);
    setEditando(null);
    avisar('Informe actualizado');
    await cargar();
  };

  if (fichas === null) return <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.top}>
        <View style={s.buscador}>
          <Ionicons name="search" size={18} color={C.texto2} />
          <TextInput style={s.buscadorInput} value={busqueda} onChangeText={setBusqueda}
            placeholder={`Buscar ${esVet ? 'paciente' : 'cliente'}, raza o dueño`} placeholderTextColor={C.gris} />
          {busqueda ? (
            <TouchableOpacity onPress={() => setBusqueda('')} accessibilityLabel="Borrar búsqueda">
              <Ionicons name="close-circle" size={18} color={C.gris} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Segmento
          opciones={[
            { key: 'todos', label: `Todos (${fichas.length})` },
            { key: 'turno', label: 'Con turno' },
            ...(esVet ? [{ key: 'control', label: 'Control' }] : []),
          ]}
          valor={filtro}
          onCambio={setFiltro}
        />
      </View>

      <FlatList
        data={visibles}
        keyExtractor={(f) => String(f.mascota.id)}
        contentContainerStyle={s.lista}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={C.teal} />}
        ListEmptyComponent={
          <Vacio icono={esVet ? 'medical-outline' : 'paw-outline'}
            titulo={busqueda || filtro !== 'todos' ? 'Nada con ese filtro' : `Todavía no tenés ${esVet ? 'pacientes' : 'clientes'}`}
            texto={busqueda || filtro !== 'todos' ? undefined
              : 'Cada mascota que pida un turno con vos aparece acá, con toda su historia.'} />
        }
        renderItem={({ item: f }) => (
          <TouchableOpacity style={s.fila} onPress={() => setAbierta(f.mascota.id)} activeOpacity={0.85}
            accessibilityRole="button" accessibilityLabel={`Ficha de ${f.mascota.nombre}`}>
            <Avatar fuente={f.mascota.visual} nombre={f.mascota.nombre} size={50} borde />
            <View style={{ flex: 1 }}>
              <Text style={s.nombre} numberOfLines={1}>{f.mascota.nombre}</Text>
              <Text style={s.sub} numberOfLines={1}>
                {[f.mascota.raza || f.mascota.especie, f.dueno.nombre].filter(Boolean).join(' · ')}
              </Text>
              <Text style={s.sub} numberOfLines={1}>
                {f.ultimaVisita
                  ? `${f.visitas.length} ${f.visitas.length === 1 ? 'visita' : 'visitas'} · última ${diaTexto(f.ultimaVisita).toLowerCase()}`
                  : 'Sin visitas todavía'}
              </Text>
              <View style={s.etiquetas}>
                {f.proximo ? (
                  <Etiqueta texto={`Turno ${cuandoTexto(f.proximo.fecha)}`} icono="time" color={C.teal} fondo={C.menta} />
                ) : null}
                {esVet && f.proximoControl ? (
                  <Etiqueta texto={`Control ${diaTexto(f.proximoControl)}`} icono="alarm" color="#B07A00" fondo="#FFF1DC" />
                ) : null}
                {esVet && f.ultimoInforme?.diagnostico ? (
                  <Etiqueta texto={f.ultimoInforme.diagnostico.slice(0, 28)} icono="pulse" color={C.texto2} fondo="#F1F1F1" />
                ) : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.gris} />
          </TouchableOpacity>
        )}
      />

      <FichaPacienteModal
        visible={!!ficha}
        tipo={tipo}
        ficha={ficha}
        onCerrar={() => setAbierta(null)}
        onChat={() => { setAbierta(null); abrirChat(ficha.dueno.id, ficha.dueno.nombre); }}
        onEditarInforme={(turno) => setEditando(turno)}
      >
        <InformeModal
          visible={!!editando}
          tipo={tipo}
          turno={editando}
          editar
          onGuardar={guardarEdicion}
          onCerrar={() => setEditando(null)}
        />
      </FichaPacienteModal>
    </View>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: C.borde, paddingHorizontal: 12,
  },
  buscadorInput: { flex: 1, fontSize: 15, color: C.texto, paddingVertical: 11 },
  lista: { padding: 20, paddingBottom: 40 },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 18,
    padding: 12, marginBottom: 10, ...sombra,
  },
  nombre: { fontSize: 16, fontWeight: '800', color: C.texto },
  sub: { fontSize: 12, color: C.texto2, marginTop: 1 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
