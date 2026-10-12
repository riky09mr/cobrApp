import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  iconColor?: string;
};

/**
 * Estado vacío reutilizable (listas sin datos, secciones sin contenido).
 * Usa Ionicons en lugar de emojis.
 */
export default function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  iconColor = colors.textMuted,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={40} color={iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.grayBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  message: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
