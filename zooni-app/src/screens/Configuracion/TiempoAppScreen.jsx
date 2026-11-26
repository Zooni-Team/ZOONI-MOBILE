import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  SettingsGroup, SettingsScreen, SettingsSelect, SettingsToggle, T,
} from '../../components/settings/SettingsKit';
import { getSettings, patchSettings } from '../../services/settingsStore';
import { fetchUsoSemana, formatoDuracion } from '../../services/usoApp';
import { colores, sombras } from '../../theme';

const HOY = 6;

export default function TiempoAppScreen() {
  const [wellbeing, setWellbeing] = useState({ ...getSettings().wellbeing });
  const [barraActiva, setBarraActiva] = useState(null);
  const [semana, setSemana] = useState(null);
  const [error, setError] = useState(false);

  useFocusEffect(useCallback(() => {
    let vigente = true;
    fetchUsoSemana()
      .then((dias) => { if (vigente) { setSemana(dias); setError(false); } })
      .catch(() => { if (vigente) setError(true); });
    return () => { vigente = false; };
  }, []));
  const set = (patch) => {
    patchSettings('wellbeing', patch);
    setWellbeing({ ...getSettings().wellbeing });
  };

  const maxSeg = Math.max(60, ...(semana ?? []).map((d) => d.segundos));
  const total = (semana ?? []).reduce((acc, d) => acc + d.segundos, 0);

  return (
    <SettingsScreen title="Tiempo en la app">

      <View style={s.chartCard}>
        {error ? (
          <Text style={s.aviso}>No pudimos leer tu tiempo de uso. Revisá tu conexión.</Text>
        ) : !semana ? (
          <ActivityIndicator color={T.brand} style={s.cargando} />
        ) : (
          <>
            {barraActiva != null && (
              <Text style={s.chartTooltip}>{formatoDuracion(semana[barraActiva].segundos)}</Text>
            )}
            <View style={s.chartRow}>
              {semana.map((d, i) => (
                <TouchableOpacity key={d.fecha} style={s.chartCol} onPress={() => setBarraActiva(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${i === HOY ? 'Hoy' : d.fecha}: ${formatoDuracion(d.segundos)}`}>
                  <View style={[
                    s.chartBar,
                    { height: Math.max(8, (d.segundos / maxSeg) * 120) },
                    { backgroundColor: i === HOY ? T.brandText : T.brand },
                  ]} />
                  <Text style={s.chartDia}>{d.letra}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.statsRow}>
              <View style={s.stat}>
                <Text style={s.statValor}>{formatoDuracion(semana[HOY].segundos)}</Text>
                <Text style={s.statLabel}>Hoy</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statValor}>{formatoDuracion(total / 7)}</Text>
                <Text style={s.statLabel}>Promedio diario</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statValor}>{formatoDuracion(total)}</Text>
                <Text style={s.statLabel}>Últimos 7 días</Text>
              </View>
            </View>
          </>
        )}
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
          apoyo="Los lunes, al abrir la app, te mostramos cuánto la usaste."
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
    ...sombras.tarjeta,
  },
  cargando: { paddingVertical: 60 },
  aviso: { fontSize: 14, color: colores.rojoOscuro, textAlign: 'center', paddingVertical: 40 },
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
