/**
 * MiTarjetaMatchModal.jsx — "Así te ven" en Match
 *
 * Se abre desde el botón de perfil del header de Match. Muestra la MISMA
 * tarjeta que ve el resto de la gente al hacer swipe, sin adivinar: los datos
 * salen de `fetchMiTarjetaMatch`, que pasa por el mismo mapeo que arma los
 * perfiles del pool.
 *
 * Antes no había forma de ver el propio perfil: se completaba el setup a ciegas
 * y no se sabía qué foto ni qué intereses estaba mostrando la app.
 *
 * Es SOLO para mirar. Las preguntas del perfil viven en la creación
 * (MatchProfileSetup y PetMatchOnboarding), no colgadas de este botón.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text,
  TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import MatchProfileCard from './MatchProfileCard';
import { fetchMiTarjetaMatch } from '../../services/matchApi';

export default function MiTarjetaMatchModal({ visible, onClose }) {
  const { width, height } = useWindowDimensions();
  const [tarjeta, setTarjeta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(false);
    try {
      setTarjeta(await fetchMiTarjetaMatch());
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, []);

  /*
    Se recarga cada vez que se abre: si el usuario acaba de cambiar la foto o el
    look de la mascota, la vista previa tiene que reflejarlo.

    Con un efecto sobre `visible` y no con el onShow del Modal: en
    react-native-web ese callback no dispara de forma confiable y la tarjeta se
    quedaba con los datos de la primera apertura.
  */
  useEffect(() => {
    if (visible) cargar();
  }, [visible, cargar]);

  // La tarjeta del swipe ocupa la pantalla entera; acá va más chica para que
  // se lea como una vista previa y entren los botones de abajo.
  const cardWidth = Math.min(width - 48, 320);
  const cardHeight = Math.min(cardWidth * 1.5, height * 0.55);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.hoja}>
          <View style={s.header}>
            <View style={{ width: 32 }} />
            <Text style={s.titulo}>Así te ven</Text>
            <TouchableOpacity onPress={onClose} style={s.cerrar} accessibilityLabel="Cerrar"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#6B6B6B" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.cuerpo} showsVerticalScrollIndicator={false}>
            {cargando ? (
              <View style={s.centro}><ActivityIndicator size="large" color="#2DBD72" /></View>
            ) : error ? (
              <View style={s.centro}>
                <Ionicons name="cloud-offline-outline" size={44} color="#AAAAAA" />
                <Text style={s.vacioTxt}>No pudimos cargar tu tarjeta.</Text>
                <TouchableOpacity style={s.btnSecundario} onPress={cargar}>
                  <Text style={s.btnSecundarioTxt}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : !tarjeta ? (
              <View style={s.centro}>
                <Ionicons name="paw-outline" size={44} color="#AAAAAA" />
                <Text style={s.vacioTxt}>
                  Todavía no hay una mascota activa para mostrar en tu tarjeta.
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.ayuda}>
                  Esta es la tarjeta que aparece cuando alguien te encuentra en Match.
                </Text>

                <View style={{ width: cardWidth, height: cardHeight }}>
                  {/* Sin onPress: acá la tarjeta es para mirar, no para abrir
                      el detalle de otra persona. */}
                  <MatchProfileCard perfil={tarjeta} cardWidth={cardWidth} cardHeight={cardHeight} />
                </View>

                {/* Qué se está mostrando y de dónde sale cada cosa: es la duda
                    típica ("¿por qué aparece esta foto?"). */}
                <View style={s.detalle}>
                  <Fila icono="person-outline" label="Vos"
                    valor={[tarjeta.nombre, tarjeta.edad ? `${tarjeta.edad} años` : null]
                      .filter(Boolean).join(' · ')} />
                  <Fila icono="paw-outline" label="Tu mascota"
                    valor={[tarjeta.mascota?.nombre, tarjeta.mascota?.raza].filter(Boolean).join(' · ')} />
                  <Fila icono="images-outline" label="Fotos en la tarjeta"
                    valor={tarjeta.mascota?.fotos?.length
                      ? `${tarjeta.mascota.fotos.length} foto${tarjeta.mascota.fotos.length > 1 ? 's' : ''}`
                      : 'Ninguna foto real — se muestra la ilustración'} />
                  <Fila icono="heart-outline" label="Intereses"
                    valor={tarjeta.intereses?.length ? tarjeta.intereses.join(', ') : 'Sin intereses cargados'} />
                  <Fila icono="location-outline" label="Zona"
                    valor={tarjeta.barrio || 'Sin ubicación cargada'} />
                </View>
              </>
            )}
          </ScrollView>

          {/*
            Acá había un "Editar mi perfil" que reabría el cuestionario. Se
            sacó: las preguntas van en la creación del perfil, no colgadas de
            este botón. Esta pantalla es solo para MIRAR cómo te ven.
          */}
          <View style={s.pie}>
            <TouchableOpacity style={s.btnPrincipal} onPress={onClose}
              accessibilityRole="button" accessibilityLabel="Cerrar la vista previa">
              <Text style={s.btnPrincipalTxt}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Fila({ icono, label, valor }) {
  return (
    <View style={s.fila}>
      <Ionicons name={icono} size={16} color="#2DBD72" style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.filaLabel}>{label}</Text>
        <Text style={s.filaValor}>{valor}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  hoja: {
    backgroundColor: '#F4FBF6', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', paddingBottom: 8,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
  },
  titulo: { fontSize: 18, fontWeight: '800', color: '#2C2C2C' },
  cerrar: { width: 32, alignItems: 'flex-end' },

  cuerpo: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  ayuda: { fontSize: 13, color: '#6B6B6B', textAlign: 'center', marginBottom: 14, lineHeight: 19 },

  centro: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  vacioTxt: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', lineHeight: 20 },

  detalle: {
    alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 14, marginTop: 16, gap: 12,
  },
  fila: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  filaLabel: { fontSize: 11, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: 0.5 },
  filaValor: { fontSize: 14, color: '#2C2C2C', fontWeight: '600', marginTop: 1 },

  pie: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  btnPrincipal: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 25, backgroundColor: '#2DBD72',
  },
  btnPrincipalTxt: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  btnSecundario: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#2DBD72',
  },
  btnSecundarioTxt: { fontSize: 14, fontWeight: '700', color: '#2DBD72' },
});
