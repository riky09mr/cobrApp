import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type Props = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  color?: string;
  textColor?: string;
  style?: object;
};

/**
 * Botón primario con icono opcional y estado de carga.
 * Reutilizado en CajaScreen, DescansoScreen, etc.
 */
export default function PrimaryButton({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  color = colors.primary,
  textColor = colors.textOnPrimary,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: color }, isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
          <Text style={[styles.text, { color: textColor }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
