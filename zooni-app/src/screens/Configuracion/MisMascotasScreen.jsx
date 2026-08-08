/**
 * MisMascotasScreen.jsx — Configuración › Mis Mascotas (§3.5.5)
 */

import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { SettingsAction, SettingsGroup, SettingsScreen, T } from '../../components/settings/SettingsKit';
import { resolvePetImage } from '../../constants/petImages';

const MASCOTAS_DEMO = [
  { id: 1, nombre: 'Titán',  especie: 'Perro',  raza: 'Golden Retriever', edad: '3 años', asset: 'perro_default', principal: true },
  { id: 2, nombre: 'Mishka', especie: 'Gato',   raza: 'Siamés',           edad: '5 años', asset: 'gato_default',  principal: false },
  { id: 3, nombre: 'Coco',   especie: 'Conejo', raza: 'Cabeza de león',   edad: '1 año',  asset: 'conejo_default', principal: false },
];

export default function MisMascotasScreen() {
  const navigation = useNavigation();
  const [mascotas, setMascotas] = useState(MASCOTAS_DEMO);

  const marcarPrincipal = (id) =>
    setMascotas((prev) => prev.map((m) => ({ ...m, principal: m.id === id })));

  const abrirDetalle = (m) => {
    Alert.alert(
      m.nombre,
      `${m.especie} · ${m.raza} · ${m.edad}`,
      [
        { text: 'Ficha médica', onPress: () => navigation.navigate('FichaMedica', { mascotaId: m.id }) },
        !m.principal && { text: 'Marcar como principal', onPress: () => marcarPrincipal(m.id) },
        {
          text: 'Eliminar mascota',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              `¿Eliminar a ${m.nombre}?`,
              'Se borra su ficha médica, sus fotos y su historial de paseos. No se puede deshacer.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar', style: 'destructive',
                  onPress: () => setMascotas((prev) => prev.filter((x) => x.id !== m.id)),
                },
              ]
            ),
        },
        { text: 'Cerrar', style: 'cancel' },
      ].filter(Boolean)
    );
  };

  return (
    <SettingsScreen title="Mis Mascotas">

      {mascotas.length === 0 ? (
        // Estado vacío (§3.5.5)
        <View style={s.vacio}>
          <Ionicons name="paw-outline" size={72} color={T.brand} />
          <Text style={s.vacioTitulo}>Todavía no cargaste ninguna mascota</Text>
          <Text style={s.vacioApoyo}>
            Agregá a tu compañero para usar el match, la ficha médica y los paseos.
          </Text>
          <TouchableOpacity style={s.vacioBtn} onPress={() => navigation.navigate('RegisterStep2')}
            accessibilityRole="button" accessibilityLabel="Agregar mi primera mascota">
            <Text style={s.vacioBtnTxt}>Agregar mi primera mascota</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <SettingsGroup>
            {mascotas.map((m) => (
              <TouchableOpacity key={m.id} style={s.petCard} onPress={() => abrirDetalle(m)}
                accessibilityRole="button" accessibilityLabel={`${m.nombre}, botón`}>
                <Image source={resolvePetImage(m.asset)} style={s.petAvatar} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.petNombre}>{m.nombre}</Text>
                    {m.principal && (
                      <View style={s.chipPrincipal}>
                        <Text style={s.chipPrincipalTxt}>Principal</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.petDatos}>{m.especie} · {m.raza} · {m.edad}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={T.chevron} />
              </TouchableOpacity>
            ))}
            <SettingsAction label="+ Agregar mascota" onPress={() => navigation.navigate('RegisterStep2')} />
          </SettingsGroup>

          <Text style={s.nota}>
            El orden define cuál aparece primero en Home y en Match.
          </Text>
        </>
      )}

    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  petCard: {
    height: 80, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 12,
  },
  petAvatar: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: T.brand,
    backgroundColor: T.bgMainSoft,
  },
  petNombre: { fontSize: 16, fontWeight: '700', color: T.text },
  petDatos:  { fontSize: 13, color: T.textSoft, marginTop: 2 },
  chipPrincipal: {
    backgroundColor: '#E8F7EE', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  chipPrincipalTxt: { fontSize: 11, fontWeight: '700', color: T.brandText },

  nota: { fontSize: 13, color: T.textSoftMint, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 },

  vacio:       { alignItems: 'center', marginTop: 48, paddingHorizontal: 24, gap: 12 },
  vacioTitulo: { fontSize: 18, fontWeight: '800', color: T.text, textAlign: 'center' },
  vacioApoyo:  { fontSize: 14, color: T.textSoftMint, textAlign: 'center', lineHeight: 20 },
  vacioBtn: {
    backgroundColor: T.cta, borderRadius: 30, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8,
  },
  vacioBtnTxt: { fontSize: 16, fontWeight: '700', color: T.text },
});
