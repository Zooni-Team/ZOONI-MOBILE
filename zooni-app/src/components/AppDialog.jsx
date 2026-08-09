/**
 * AppDialog.jsx — Cartel modal con estilo Zooni (reemplaza los alert/confirm
 * nativos del navegador, que en web se ven como "localhost dice ...").
 *
 * Uso:
 *   <AppDialog
 *     visible={...}
 *     titulo="Foto de perfil"
 *     mensaje="¿De dónde querés tomar la foto?"
 *     botones={[
 *       { texto: 'Sacar una foto', estilo: 'primary',   onPress: ... },
 *       { texto: 'Elegir de la galería', estilo: 'secondary', onPress: ... },
 *       { texto: 'Cancelar', estilo: 'ghost' },
 *     ]}
 *     onCerrar={...}
 *   />
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const C = {
  text: '#2C2C2C',
  textSoft: '#6B6B6B',
  cta: '#F5C842',
  brandText: '#177046',
  sosRedText: '#B3121D',
  surface: '#FFFFFF',
  divider: '#E8EFE9',
};

export default function AppDialog({ visible, titulo, mensaje, botones = [], onCerrar }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={s.scrim} onPress={onCerrar}>
        <Pressable style={s.card} onPress={() => {}}>
          {titulo ? <Text style={s.titulo}>{titulo}</Text> : null}
          {mensaje ? <Text style={s.mensaje}>{mensaje}</Text> : null}

          <View style={s.botones}>
            {botones.map((b, i) => {
              const esPrimary = b.estilo === 'primary';
              const esDestructive = b.estilo === 'destructive';
              return (
                <TouchableOpacity
                  key={i}
                  style={[s.btn, esPrimary && s.btnPrimary, esDestructive && s.btnDestructive]}
                  onPress={() => { onCerrar?.(); b.onPress?.(); }}
                  accessibilityRole="button"
                  accessibilityLabel={b.texto}
                >
                  <Text style={[
                    s.btnTxt,
                    esPrimary && s.btnTxtPrimary,
                    esDestructive && s.btnTxtDestructive,
                    b.estilo === 'ghost' && s.btnTxtGhost,
                  ]}>
                    {b.texto}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 28 },
  card: {
    backgroundColor: C.surface, borderRadius: 20, padding: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
  },
  titulo: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' },
  mensaje: { fontSize: 14, color: C.textSoft, textAlign: 'center', lineHeight: 20, marginTop: 8 },

  botones: { marginTop: 20, gap: 10 },
  btn: {
    height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.divider, backgroundColor: C.surface,
  },
  btnPrimary: { backgroundColor: C.cta, borderColor: C.cta },
  btnDestructive: { borderColor: C.sosRedText },
  btnTxt: { fontSize: 15, fontWeight: '700', color: C.brandText },
  btnTxtPrimary: { color: C.text },
  btnTxtDestructive: { color: C.sosRedText },
  btnTxtGhost: { color: C.textSoft },
});
