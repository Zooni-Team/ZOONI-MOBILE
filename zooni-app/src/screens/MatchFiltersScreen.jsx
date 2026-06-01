import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import FilterChip from '../components/match/FilterChip';
import SimpleSlider from '../components/match/SimpleSlider';
import SimpleRangeSlider from '../components/match/SimpleRangeSlider';
import {
  DEFAULT_FILTROS,
  PET_TYPE_OPTIONS,
  INTEREST_OPTIONS,
  GENDER_OPTIONS,
} from '../data/matchDemo';
import {
  fetchMatchFiltros,
  putMatchFiltros,
  previewMatchFiltros,
  resetDemoMatchState,
} from '../services/matchApi';
import { markMatchReloadFromFilters } from '../utils/matchNavigation';

function formatPetAgeMonths(months) {
  if (months <= 6) return 'Cachorro';
  const years = Math.floor(months / 12);
  if (years >= 20) return '20+ años';
  return `${years} año${years === 1 ? '' : 's'}`;
}

function formatOwnerAge(age) {
  if (age >= 65) return '65+';
  return `${age}`;
}

export default function MatchFiltersScreen() {
  const navigation = useNavigation();
  const [filtros, setFiltros] = useState({ ...DEFAULT_FILTROS });
  const [previewCount, setPreviewCount] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await fetchMatchFiltros();
        if (!cancelled) setFiltros({ ...DEFAULT_FILTROS, ...saved });
      } catch { /* defaults ya visibles */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const runPreview = useCallback((draft) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const { cantidad } = await previewMatchFiltros(draft);
        setPreviewCount(cantidad);
      } finally {
        setLoadingPreview(false);
      }
    }, 350);
  }, []);

  useEffect(() => {
    runPreview(filtros);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filtros, runPreview]);

  const update = (patch) => setFiltros((f) => ({ ...f, ...patch }));

  const togglePetType = (key) => {
    setFiltros((f) => {
      if (key === 'cualquiera') return { ...f, tipos_mascota: ['cualquiera'] };
      const without = (f.tipos_mascota ?? []).filter((t) => t !== 'cualquiera');
      const has = without.includes(key);
      const next = has ? without.filter((t) => t !== key) : [...without, key];
      return { ...f, tipos_mascota: next.length ? next : ['cualquiera'] };
    });
  };

  const toggleInterest = (label) => {
    setFiltros((f) => {
      const list = f.intereses ?? [];
      const has = list.includes(label);
      const intereses = has ? list.filter((i) => i !== label) : [...list, label];
      return { ...f, intereses };
    });
  };

  const toggleGender = (key) => {
    setFiltros((f) => {
      if (key === 'todos') return { ...f, genero_dueno: ['todos'] };
      const without = (f.genero_dueno ?? []).filter((g) => g !== 'todos');
      const has = without.includes(key);
      const next = has ? without.filter((g) => g !== key) : [...without, key];
      return { ...f, genero_dueno: next.length ? next : ['todos'] };
    });
  };

  const handleReset = () => {
    resetDemoMatchState();
    setFiltros({ ...DEFAULT_FILTROS });
  };

  const handleApply = async () => {
    try {
      await putMatchFiltros(filtros);
    } catch {
      /* demo/local igual aplica en catch de matchApi */
    }
    markMatchReloadFromFilters();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Match');
    }
  };

  const countLabel = loadingPreview && previewCount === null
    ? '...'
    : String(previewCount ?? 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Volver sin aplicar"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerIcon}>🐾</Text>
          <Text style={styles.headerTitle}>Filtros</Text>
        </View>
        <TouchableOpacity onPress={handleReset} accessibilityLabel="Resetear filtros">
          <Text style={styles.resetText}>Resetear</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headerDivider} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>📍 UBICACIÓN</Text>
        <View style={styles.card}>
          <SimpleSlider
            label="Distancia máxima"
            value={filtros.distancia_max_km}
            min={1}
            max={100}
            unit=" km"
            onChange={(distancia_max_km) => update({ distancia_max_km })}
          />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Solo usuarios cercanos</Text>
            <Switch
              value={filtros.solo_cercanos}
              onValueChange={(solo_cercanos) => update({ solo_cercanos })}
              trackColor={{ false: '#DDDDDD', true: '#A8E6C0' }}
              thumbColor={filtros.solo_cercanos ? '#2DBD72' : '#FFFFFF'}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>🐾 TIPO DE MASCOTA</Text>
        <View style={styles.card}>
          <View style={styles.chipsWrap}>
            {PET_TYPE_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.key}
                label={opt.label}
                icon={opt.icon}
                selected={(filtros.tipos_mascota ?? []).includes(opt.key)}
                onPress={() => togglePetType(opt.key)}
              />
            ))}
          </View>
        </View>

        <Text style={styles.sectionLabel}>🎂 EDAD DE LA MASCOTA</Text>
        <View style={styles.card}>
          <SimpleRangeSlider
            label="Rango de edad"
            min={0}
            max={240}
            low={filtros.edad_mascota_min_meses}
            high={filtros.edad_mascota_max_meses}
            formatLow={formatPetAgeMonths}
            formatHigh={formatPetAgeMonths}
            onChangeLow={(edad_mascota_min_meses) =>
              update({ edad_mascota_min_meses })
            }
            onChangeHigh={(edad_mascota_max_meses) =>
              update({ edad_mascota_max_meses })
            }
          />
        </View>

        <Text style={styles.sectionLabel}>⭐ INTERESES EN COMÚN</Text>
        <View style={styles.card}>
          <View style={styles.chipsWrap}>
            {INTEREST_OPTIONS.map((label) => (
              <FilterChip
                key={label}
                label={label}
                selected={(filtros.intereses ?? []).includes(label)}
                onPress={() => toggleInterest(label)}
              />
            ))}
          </View>
        </View>

        <Text style={styles.sectionLabel}>👤 PERFIL DEL DUEÑO</Text>
        <View style={styles.card}>
          <SimpleRangeSlider
            label="Rango de edad del dueño"
            min={18}
            max={65}
            low={filtros.edad_dueno_min}
            high={filtros.edad_dueno_max}
            formatLow={formatOwnerAge}
            formatHigh={formatOwnerAge}
            onChangeLow={(edad_dueno_min) => update({ edad_dueno_min })}
            onChangeHigh={(edad_dueno_max) => update({ edad_dueno_max })}
          />
          <Text style={styles.subLabel}>Género</Text>
          <View style={styles.chipsWrap}>
            {GENDER_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.key}
                label={opt.label}
                selected={(filtros.genero_dueno ?? []).includes(opt.key)}
                onPress={() => toggleGender(opt.key)}
              />
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={handleApply}
          accessibilityLabel={`Ver resultados, ${countLabel} perfiles`}
        >
          <Text style={styles.applyBtnText}>
            Ver resultados  {countLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIcon: { fontSize: 18 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#2C2C2C' },
  resetText: { fontSize: 14, fontWeight: '600', color: '#E63946' },
  headerDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B6B6B',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  toggleLabel: { fontSize: 14, color: '#2C2C2C', fontWeight: '600', flex: 1 },
  subLabel: { fontSize: 14, color: '#6B6B6B', marginBottom: 8, marginTop: 8 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  applyBtn: {
    backgroundColor: '#2DBD72',
    borderRadius: 30,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2DBD72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  applyBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
