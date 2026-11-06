import React, { useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import { colores } from '../../theme';

export default function SimpleRangeSlider({
  label,
  min,
  max,
  low,
  high,
  formatLow,
  formatHigh,
  onChangeLow,
  onChangeHigh,
}) {
  const [trackWidth, setTrackWidth] = useState(1);
  const activeThumb = useRef(null);

  const clamp = (v) => Math.max(min, Math.min(max, v));

  const valueFromX = (x) => {
    if (trackWidth <= 1) return min;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    return clamp(Math.round(min + ratio * (max - min)));
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const lowPos = trackWidth * ((low - min) / (max - min));
        const highPos = trackWidth * ((high - min) / (max - min));
        activeThumb.current = Math.abs(x - lowPos) <= Math.abs(x - highPos) ? 'low' : 'high';
        const v = valueFromX(x);
        if (activeThumb.current === 'low') {
          onChangeLow(Math.min(v, high));
        } else {
          onChangeHigh(Math.max(v, low));
        }
      },
      onPanResponderMove: (evt) => {
        const v = valueFromX(evt.nativeEvent.locationX);
        if (activeThumb.current === 'low') {
          onChangeLow(Math.min(v, high));
        } else if (activeThumb.current === 'high') {
          onChangeHigh(Math.max(v, low));
        }
      },
      onPanResponderRelease: () => {
        activeThumb.current = null;
      },
      onPanResponderTerminate: () => {
        activeThumb.current = null;
      },
    }),
    [trackWidth, low, high, min, max, onChangeLow, onChangeHigh]
  );

  const lowRatio = (low - min) / (max - min);
  const highRatio = (high - min) / (max - min);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {formatLow ? formatLow(low) : low} – {formatHigh ? formatHigh(high) : high}
        </Text>
      </View>
      <View
        style={styles.trackHit}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                left: `${lowRatio * 100}%`,
                width: `${(highRatio - lowRatio) * 100}%`,
              },
            ]}
          />
          <View style={[styles.thumb, { left: `${lowRatio * 100}%`, marginLeft: -12 }]} />
          <View style={[styles.thumb, { left: `${highRatio * 100}%`, marginLeft: -12 }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 14, color: colores.texto, fontWeight: '600', flex: 1 },
  value: { fontSize: 14, color: colores.verde, fontWeight: '700' },
  trackHit: { height: 40, justifyContent: 'center', width: '100%' },
  track: {
    height: 6,
    backgroundColor: colores.gris400,
    borderRadius: 3,
    width: '100%',
  },
  fill: {
    position: 'absolute',
    height: 6,
    backgroundColor: colores.verde,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colores.blanco,
    borderWidth: 2,
    borderColor: colores.verde,
    top: -9,
  },
});
