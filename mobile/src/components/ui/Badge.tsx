import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type Props = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  bgColor?: string;
  textColor?: string;
};

/**
 * Etiqueta/badge con icono opcional.
 * Reutilizado en CajaScreen (badgeAbierta), PerfilScreen (rolBadge), etc.
 */
export default function Badge({
  label,
  icon,
  color = colors.primary,
  bgColor = colors.backgroundAlt,
  textColor = color,
}: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: { fontWeight: '600', fontSize: 13 },
});
