/**
 * FichaPacienteModal.jsx — Historia de una mascota en el negocio
 *
 *   · Veterinaria: historia clínica → cada consulta con motivo, diagnóstico,
 *     tratamiento, peso y temperatura; próximo control; evolución del peso.
 *   · Peluquería: cada visita con el trabajo hecho y sus fotos.
 * Arriba: dueño (con chat), cuántas visitas, cuánto se facturó, ausencias y
 * el próximo turno. Tocar "Editar" en una visita corrige su informe.
 *
 * Props: visible · tipo · ficha (de fetchPacientes) · onChat() ·
 *        onEditarInforme(turno) · onCerrar · children (InformeModal adentro)
 */

import {
  FlatList, Image, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, Stat } from '../paseador/PaseadorUI';
import { cuandoTexto, formatoPlata } from '../../services/negocioApi';
import { calcularEdad } from '../../utils/calcularEdad';

const fechaLarga = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
const num = (n) => String(n).replace('.', ',');

function edadTexto(nacimiento) {
  if (!nacimiento) return null;
  try {
    const e = calcularEdad(nacimiento);
    return typeof e === 'string' ? e : e?.texto ?? null;
  } catch {
    return null;
  }
}

function Dato({ icono, label, valor }) {
  if (!valor) return null;
  return (
    <View style={s.dato}>
      <Ionicons name={icono} size={14} color={C.teal} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.datoLabel}>{label}</Text>
        <Text style={s.datoValor}>{valor}</Text>
      </View>
    </View>
  );
}

export default function FichaPacienteModal({
  visible, tipo, ficha, onChat, onEditarInforme, onCerrar, children,
}) {
  if (!ficha) return null;
  const esVet = tipo === 'veterinaria';
  const { mascota, dueno } = ficha;
  const pesos = ficha.visitas.filter((v) => v.informe?.peso).map((v) => ({ fecha: v.fecha, peso: v.informe.peso }));
  const edad = edadTexto(mascota.nacimiento);

  const cabecera = (
    <View>
      <View style={s.perfil}>
        <Avatar fuente={mascota.visual} nombre={mascota.nombre} size={72} borde />
        <View style={{ flex: 1 }}>
          <Text style={s.nombre}>{mascota.nombre}</Text>
          <Text style={s.sub}>
            {[mascota.especie, mascota.raza].filter(Boolean).join(' · ') || 'Mascota'}
            {edad ? ` · ${edad}` : ''}
          </Text>
          {mascota.peso ? <Text style={s.sub}>Peso registrado: {num(mascota.peso)} kg</Text> : null}
        </View>
      </View>

      <TouchableOpacity style={s.dueno} onPress={onChat} activeOpacity={0.85}>
        <Avatar uri={dueno.foto} nombre={dueno.nombre} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={s.duenoNombre}>{dueno.nombre}</Text>
          <Text style={s.sub}>{dueno.telefono ? `Tel. ${dueno.telefono}` : 'Dueño'}</Text>
        </View>
        <View style={s.chat}>
          <Ionicons name="chatbubble-ellipses" size={18} color={C.teal} />
        </View>
      </TouchableOpacity>

      <View style={s.stats}>
        <Stat valor={String(ficha.visitas.length)} etiqueta={ficha.visitas.length === 1 ? 'visita' : 'visitas'} icono="calendar" />
        <Stat valor={formatoPlata(ficha.facturado)} etiqueta="facturado" icono="cash" />
        <Stat valor={String(ficha.ausencias)} etiqueta={ficha.ausencias === 1 ? 'ausencia' : 'ausencias'} icono="person-remove" />
      </View>

      {ficha.proximo ? (
        <View style={[s.aviso, { backgroundColor: C.menta }]}>
          <Ionicons name="time" size={16} color={C.teal} />
          <Text style={s.avisoTxt}>Próximo turno: {ficha.proximo.servicio} · {cuandoTexto(ficha.proximo.fecha)}</Text>
        </View>
      ) : null}
      {esVet && ficha.proximoControl ? (
        <View style={[s.aviso, { backgroundColor: '#FFF1DC' }]}>
          <Ionicons name="alarm" size={16} color="#B07A00" />
          <Text style={s.avisoTxt}>Control indicado para el {fechaLarga(ficha.proximoControl)}</Text>
        </View>
      ) : null}

      {esVet && pesos.length > 1 ? (
        <View style={s.pesos}>
          <Text style={s.seccionChica}>Evolución del peso</Text>
          <View style={s.pesosFila}>
            {[...pesos].reverse().slice(-6).map((p) => (
              <View key={p.fecha} style={s.pesoItem}>
                <Text style={s.pesoValor}>{num(p.peso)}</Text>
                <Text style={s.pesoFecha}>{new Date(p.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={s.seccion}>{esVet ? 'Historia clínica' : 'Visitas'}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCerrar} style={s.volver} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={26} color={C.teal} />
          </TouchableOpacity>
          <Text style={s.titulo}>{esVet ? 'Ficha del paciente' : 'Ficha del cliente'}</Text>
        </View>
        <FlatList
          data={ficha.visitas}
          keyExtractor={(v) => String(v.id)}
          ListHeaderComponent={cabecera}
          contentContainerStyle={s.lista}
          ListEmptyComponent={<Text style={s.vacio}>Todavía no tiene visitas atendidas.</Text>}
          renderItem={({ item: v }) => {
            const i = v.informe ?? {};
            return (
              <View style={s.visita}>
                <View style={s.visitaTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.visitaTitulo}>{v.servicio}</Text>
                    <Text style={s.sub}>{fechaLarga(v.fecha)} · {formatoPlata(v.precio)}</Text>
                  </View>
                  <TouchableOpacity style={s.editar} onPress={() => onEditarInforme(v)} accessibilityLabel="Editar informe">
                    <Ionicons name="create-outline" size={16} color={C.teal} />
                    <Text style={s.editarTxt}>{v.informe ? 'Editar' : 'Agregar informe'}</Text>
                  </TouchableOpacity>
                </View>
                {esVet ? (
                  <>
                    <Dato icono="help-circle-outline" label="Motivo" valor={i.motivo} />
                    <Dato icono="pulse-outline" label="Diagnóstico" valor={i.diagnostico} />
                    <Dato icono="medkit-outline" label="Tratamiento" valor={i.tratamiento} />
                    {(i.peso || i.temperatura) ? (
                      <Dato icono="speedometer-outline" label="Signos"
                        valor={[i.peso ? `${num(i.peso)} kg` : null, i.temperatura ? `${num(i.temperatura)} °C` : null].filter(Boolean).join(' · ')} />
                    ) : null}
                    <Dato icono="alarm-outline" label="Próximo control" valor={i.proximoControl ? fechaLarga(i.proximoControl) : null} />
                    <Dato icono="lock-closed-outline" label="Notas internas" valor={i.notas} />
                  </>
                ) : (
                  <>
                    <Dato icono="cut-outline" label="Trabajo" valor={i.notas} />
                    {i.fotos?.length ? (
                      <View style={s.fotos}>
                        {i.fotos.map((u) => <Image key={u} source={{ uri: u }} style={s.foto} />)}
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            );
          }}
        />
        {children}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fondo },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF',
    paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  volver: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 19, fontWeight: '800', color: C.texto },
  lista: { padding: 20, paddingBottom: 40 },
  vacio: { fontSize: 14, color: C.texto2, textAlign: 'center', marginTop: 10 },

  perfil: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nombre: { fontSize: 22, fontWeight: '900', color: C.texto },
  sub: { fontSize: 13, color: C.texto2, marginTop: 2 },
  dueno: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 12, marginTop: 16,
  },
  duenoNombre: { fontSize: 15, fontWeight: '800', color: C.texto },
  chat: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.menta, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginTop: 12 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginTop: 10 },
  avisoTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: C.texto },
  pesos: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginTop: 12 },
  seccionChica: { fontSize: 13, fontWeight: '800', color: C.texto, marginBottom: 8 },
  pesosFila: { flexDirection: 'row', justifyContent: 'space-between' },
  pesoItem: { alignItems: 'center' },
  pesoValor: { fontSize: 15, fontWeight: '900', color: C.texto },
  pesoFecha: { fontSize: 11, color: C.texto2 },
  seccion: { fontSize: 17, fontWeight: '900', color: C.texto, marginTop: 22, marginBottom: 10 },

  visita: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10, gap: 8 },
  visitaTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  visitaTitulo: { fontSize: 15, fontWeight: '800', color: C.texto },
  editar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  editarTxt: { fontSize: 13, fontWeight: '800', color: C.teal },
  dato: { flexDirection: 'row', gap: 8 },
  datoLabel: { fontSize: 11, fontWeight: '800', color: C.texto2, textTransform: 'uppercase', letterSpacing: 0.4 },
  datoValor: { fontSize: 14, color: C.texto, lineHeight: 20 },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  foto: { width: 72, height: 72, borderRadius: 10 },
});
