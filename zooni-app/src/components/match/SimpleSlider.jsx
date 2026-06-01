/**
 * Slider simple con barra táctil (ancho adaptable).
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';

export default function SimpleSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  formatValue,
  onChange,
}) {
  const [trackWidth, setTrackWidth] = useState(1);

  const updateFromX = (x) => {
    if (trackWidth <= 1) return;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    const raw = min + ratio * (max - min);
    const stepped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, stepped)));
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => updateFromX(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => updateFromX(evt.nativeEvent.locationX),
    }),
    [trackWidth, min, max, step, onChange]
  );

  const ratio = (value - min) / (max - min);
  const display = formatValue ? formatValue(value) : `${value}${unit}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{display}</Text>
      </View>
      <View
        style={styles.trackHit}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
          <View style={[styles.thumb, { left: `${ratio * 100}%`, marginLeft: -12 }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 14, color: '#2C2C2C', fontWeight: '600' },
  value: { fontSize: 14, color: '#2DBD72', fontWeight: '700' },
  trackHit: { height: 40, justifyContent: 'center', width: '100%' },
  track: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    width: '100%',
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 6,
    backgroundColor: '#2DBD72',
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2DBD72',
    top: -9,
  },
});
