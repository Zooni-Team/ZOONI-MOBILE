import { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { C } from '../../components/paseador/PaseadorUI';
import ChatsPaseoLista from '../../components/paseador/ChatsPaseoLista';
import PaseadorDrawer from '../../components/paseador/PaseadorDrawer';
import { clearCurrentUserId, setModo, MODO_DUENO } from '../../config/session';
import { colores } from '../../theme';

export default function PaseadorChatsScreen() {
  const navigation = useNavigation();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const irASeccion = (key) => {
    setMenuAbierto(false);
    navigation.navigate('PaseadorApp', { tab: key });
  };

  const cambiarAModoDueno = async () => {
    setMenuAbierto(false);
    await setModo(MODO_DUENO);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const salir = async () => {
    setMenuAbierto(false);
    await clearCurrentUserId();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colores.blanco} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => setMenuAbierto(true)} style={s.menu}
          accessibilityLabel="Abrir menú" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="menu" size={28} color={colores.negroSuave} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Chats</Text>
          <Text style={s.sub}>Tus conversaciones con los dueños</Text>
        </View>
      </View>

      <ChatsPaseoLista rol="paseador" />

      <PaseadorDrawer
        visible={menuAbierto}
        onClose={() => setMenuAbierto(false)}
        onElegir={irASeccion}
        onChats={() => setMenuAbierto(false)}
        onZona={() => { setMenuAbierto(false); navigation.navigate('PaseadorDisponibilidad'); }}
        onModoDueno={cambiarAModoDueno}
        onSalir={salir}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fondo },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colores.blanco,
    paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  menu: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 20, fontWeight: '800', color: C.texto },
  sub: { fontSize: 12, color: C.texto2, marginTop: 1 },
});
