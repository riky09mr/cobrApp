import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

type Props = {
  color?: string;
  size?: 'small' | 'large';
};

/**
 * Vista de carga centrada a pantalla completa.
 * Reutilizado en CajaScreen, DescansoScreen, etc.
 */
export default function LoadingView({ color = colors.primary, size = 'large' }: Props) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
