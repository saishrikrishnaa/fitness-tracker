import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { COLORS } from '../constants/theme';

export function GlassCard({ children, style, ...props }: ViewProps): JSX.Element {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 20,
    marginBottom: 16,
  },
});
