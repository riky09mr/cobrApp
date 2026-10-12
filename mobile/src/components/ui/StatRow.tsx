import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

type Props = {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
};

/**
 * Fila de estadística (label + valor).
 * Reutilizado en PerfilScreen (StatRow), CajaScreen (Fila), etc.
 */
export default function StatRow({
  label,
  value,
  color = colors.textDarkGray,
  bold = false,
}: Props) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, bold && { fontWeight: '700', color: colors.textDarkGray }]}>
        {label}
      </Text>
      <Text style={[styles.value, { color }, bold && { fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  label: { fontSize: 14, color: colors.textSecondary },
  value: { fontSize: 14, fontWeight: '600' },
});
