/**
 * TiempoAppScreen.jsx — Configuración › Tiempo en la app (§3.5.4)
 *
 * Bienestar digital. Regla de tono: descriptivo, jamás evaluativo, y el
 * límite AVISA, no bloquea (bloquear podría dejar a alguien sin llegar a SOS).
 */

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  SettingsGroup, SettingsScreen, SettingsSelect, SettingsToggle, T,
} from '../../components/settings/SettingsKit';
import { getSettings, patchSettings } from '../../services/settingsStore';

// Demo: minutos por día de la última semana (L a D)
const SEMANA = [
  { dia: 'L', min: 45 }, { dia: 'M', min: 88 }, { dia: 'M', min: 62 },
  { dia: 'J', min: 105 }, { dia: 'V', min: 38 }, { dia: 'S', min: 96 },
  { dia: 'D', min: 72 },
];
const HOY = 6; // índice del día actual en SEMANA

function formatMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export default function TiempoAppScreen() {
  const [wellbeing, setWellbeing] = useState({ ...getSettings().wellbeing });
  const [barraActiva, setBarraActiva] = useState(null);
  const set = (patch) => {
    patchSettings('wellbeing', patch);
    setWellbeing({ ...getSettings().wellbeing });
  };

  const maxMin = Math.max(...SEMANA.map((d) => d.min));
  const total = SEMANA.reduce((acc, d) => acc + d.min, 0);

  return (
    <SettingsScreen title="Tiempo en la app">

      {/* Gráfico de barras semanal (§3.5.4) */}
      <View style={s.chartCard}>
        {barraActiva != null && (
          <Text style={s.chartTooltip}>{formatMin(SEMANA[barraActiva].min)}</Text>
        )}
        <View style={s.chartRow}>
          {SEMANA.map((d, i) => (
            <TouchableOpacity key={i} style={s.chartCol} onPress={() => setBarraActiva(i)}
              accessibilityRole="button"
              accessibilityLabel={`${d.dia}: ${formatMin(d.min)}`}>
              <View style={[
                s.chartBar,
                { height: Math.max(8, (d.min / maxMin) * 120) },
                { backgroundColor: i === HOY ? T.brandText : T.brand },
              ]} />
              <Text style={s.chartDia}>{d.dia}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Resumen: Hoy / Promedio / Semana */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statValor}>{formatMin(SEMANA[HOY].min)}</Text>
            <Text style={s.statLabel}>Hoy</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValor}>{formatMin(Math.round(total / 7))}</Text>
            <Text style={s.statLabel}>Promedio diario</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValor}>{formatMin(total)}</Text>
            <Text style={s.statLabel}>Esta semana</Text>
          </View>
        </View>
      </View>

      <SettingsGroup label="Límites">
        <SettingsToggle
          label="Límite de uso diario"
          apoyo="Te avisamos cuando llegues al límite. No bloqueamos la app."
          value={wellbeing.daily_limit_enabled}
          onChange={(v) => set({ daily_limit_enabled: v })}
        />
        {wellbeing.daily_limit_enabled && (
          <SettingsSelect
            label="Límite"
            options={[
              { value: 30,  label: '30 min' },
              { value: 60,  label: '1 h' },
              { value: 90,  label: '1 h 30 min' },
              { value: 120, label: '2 h' },
            ]}
            value={wellbeing.daily_limit_minutes}
            onChange={(v) => set({ daily_limit_minutes: v })}
          />
        )}
        <SettingsSelect
          label="Recordatorio de descanso"
          options={[
            { value: 'never', label: 'Nunca' },
            { value: '30m',   label: 'Cada 30 min' },
            { value: '1h',    label: 'Cada hora' },
          ]}
          value={wellbeing.break_reminder}
          onChange={(v) => set({ break_reminder: v })}
        />
        <SettingsToggle
          label="Resumen semanal"
          apoyo="Recibí cada lunes un resumen de tu uso."
          value={wellbeing.weekly_summary}
          onChange={(v) => set({ weekly_summary: v })}
        />
      </SettingsGroup>

    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  chartCard: {
    backgroundColor: T.surface, borderRadius: 18, marginTop: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  chartTooltip: { textAlign: 'center', fontSize: 14, fontWeight: '700', color: T.brandText, marginBottom: 6 },
  chartRow:     { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 150 },
  chartCol:     { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  chartBar:     { width: 22, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  chartDia:     { fontSize: 11, color: T.textSoft },

  statsRow: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: T.divider, paddingTop: 14 },
  stat:      { flex: 1, alignItems: 'center' },
  statValor: { fontSize: 18, fontWeight: '700', color: T.text },
  statLabel: { fontSize: 12, color: T.textSoft, marginTop: 2 },
});
