import React from 'react';
import { View, Text, StyleSheet, DimensionValue } from 'react-native';
import { COLORS } from '../constants/theme';

export interface MacroBarProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  color: string;
}

export function MacroBar({ label, value, max, unit = 'g', color }: MacroBarProps): JSX.Element {
  const percentage = Math.min(Math.max((value / (max || 1)) * 100, 0), 100);
  const widthVal: DimensionValue = `${percentage}%`;

  return (
    <View style={styles.container} testID={`macro-bar-${label.toLowerCase()}`}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {value.toFixed(0)}{unit} <Text style={styles.max}>/ {max}{unit}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View
          testID={`macro-fill-${label.toLowerCase()}`}
          style={[styles.fill, { width: widthVal, backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  value: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  max: { color: COLORS.textMuted, fontSize: 11, fontWeight: '400' },
  track: { height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
