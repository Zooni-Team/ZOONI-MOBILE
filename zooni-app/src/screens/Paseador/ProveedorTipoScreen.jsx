/**
 * ProveedorTipoScreen.jsx — "¿Qué servicio ofrecés?"
 *
 * Se llega desde el botón "Registrarse como Proveedor" del Login de dueños.
 * Paseador → Zooni Paseadores. Veterinaria, peluquería y pet shop → Zooni
 * Negocios (NegocioLogin con su tipo): cada uno con su app, mismas pantallas
 * y secciones distintas según el tipo (constants/negocios.js).
 */

import {
  Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { C, sombra } from '../../components/paseador/PaseadorUI';
import { MASCOTAS_BIENVENIDA } from '../../constants/registroImages';
import { TIPOS_NEGOCIO } from '../../constants/negocios';

const TIPOS = [
  {
    key: 'paseador', titulo: 'Paseador', texto: 'Aceptá paseos cerca tuyo y cobrá por cada uno.',
    icono: 'walk', color: C.teal, fondo: C.menta, activo: true,
  },
  ...['veterinaria', 'peluqueria', 'petshop'].map((k) => ({
    key: k,
    titulo: TIPOS_NEGOCIO[k].label,
    texto: TIPOS_NEGOCIO[k].textoTipo,
    icono: TIPOS_NEGOCIO[k].icono,
    color: TIPOS_NEGOCIO[k].color,
    fondo: TIPOS_NEGOCIO[k].fondoIcono,
    activo: true,
  })),
];

export default function ProveedorTipoScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.volver} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={26} color={C.teal} />
          <Text style={s.volverTxt}>Volver</Text>
        </TouchableOpacity>

        <Text style={s.marca}>Zooni</Text>
        <Text style={s.submarca}>para proveedores</Text>

        <Image source={MASCOTAS_BIENVENIDA} style={s.ilustracion} resizeMode="contain" />

        <Text style={s.titulo}>¿Qué servicio ofrecés?</Text>
        <Text style={s.subtitulo}>Elegí con qué querés trabajar en Zooni.</Text>

        {TIPOS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.opcion, !t.activo && s.opcionOff]}
            disabled={!t.activo}
            activeOpacity={0.85}
            onPress={() => (t.key === 'paseador'
              ? navigation.navigate('PaseadorLogin')
              : navigation.navigate('NegocioLogin', { tipo: t.key }))}
            accessibilityRole="button"
            accessibilityState={{ disabled: !t.activo }}
            accessibilityLabel={t.activo ? t.titulo : `${t.titulo}, próximamente`}
          >
            <View style={[s.icono, { backgroundColor: t.activo ? t.fondo : '#F0F0F0' }]}>
              <Ionicons name={t.icono} size={26} color={t.activo ? t.color : C.gris} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.opcionTitulo, !t.activo && { color: C.texto2 }]}>{t.titulo}</Text>
              <Text style={s.opcionTexto}>{t.texto}</Text>
            </View>
            {t.activo ? (
              <Ionicons name="chevron-forward" size={22} color={C.teal} />
            ) : (
              <View style={s.pronto}><Text style={s.prontoTxt}>Próximamente</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { padding: 24, paddingBottom: 40 },
  volver: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 8, minHeight: 44 },
  volverTxt: { fontSize: 15, fontWeight: '700', color: C.teal },

  marca: { fontSize: 34, fontWeight: '800', color: '#5C3D1E', textAlign: 'center' },
  submarca: { fontSize: 14, fontWeight: '700', color: C.teal, textAlign: 'center', marginTop: -2 },
  ilustracion: { width: '100%', height: 120, marginVertical: 16 },

  titulo: { fontSize: 22, fontWeight: '800', color: C.texto, textAlign: 'center' },
  subtitulo: { fontSize: 14, color: C.texto2, marginTop: 4, marginBottom: 18, textAlign: 'center' },

  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: C.menta, ...sombra,
  },
  opcionOff: { borderColor: '#F0F0F0', shadowOpacity: 0, elevation: 0 },
  icono: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.menta, alignItems: 'center', justifyContent: 'center' },
  opcionTitulo: { fontSize: 17, fontWeight: '800', color: C.texto },
  opcionTexto: { fontSize: 13, color: C.texto2, marginTop: 2 },
  pronto: { backgroundColor: '#F2F2F2', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  prontoTxt: { fontSize: 11, fontWeight: '700', color: C.texto2 },
});
