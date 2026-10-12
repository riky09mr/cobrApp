import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useMensajesContext } from '../context/MensajesContext';
import { colors } from '../theme/colors';

const TAB_CONFIG: Record<string, {
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  label: string;
}> = {
  Agenda:   { icon: 'calendar-outline',    iconActive: 'calendar',      label: 'Agenda' },
  Caja:     { icon: 'wallet-outline',      iconActive: 'wallet',         label: 'Caja' },
  Cobros:   { icon: 'receipt-outline',     iconActive: 'receipt',        label: 'Cobros' },
  Mensajes: { icon: 'chatbubbles-outline', iconActive: 'chatbubbles',    label: 'Mensajes' },
  Perfil:   { icon: 'person-outline',      iconActive: 'person',         label: 'Perfil' },
};

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { noLeidos } = useMensajesContext();

  return (
    <View style={tb.container}>
      {state.routes.map((route, index) => {
        const isActive = state.index === index;
        const isCenter = route.name === 'Caja';
        const cfg = TAB_CONFIG[route.name];

        const onPress = () => {
          if (!isActive) navigation.navigate(route.name);
        };

        if (isCenter) {
          return (
            <View key={route.key} style={tb.centerWrapper}>
              <TouchableOpacity
                style={[tb.centerBtn, isActive && tb.centerBtnActive]}
                onPress={onPress}
                activeOpacity={0.85}
              >
                <Ionicons name={isActive ? cfg.iconActive : cfg.icon} size={28} color={colors.textOnPrimary} />
              </TouchableOpacity>
              <Text style={[tb.label, isActive && tb.labelActive]}>{cfg.label}</Text>
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            style={tb.tab}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <View style={tb.iconWrap}>
              <Ionicons
                name={isActive ? cfg.iconActive : cfg.icon}
                size={22}
                color={isActive ? colors.primary : colors.textMuted}
              />
              {route.name === 'Mensajes' && noLeidos > 0 && (
                <View style={tb.badge}>
                  <Text style={tb.badgeText}>{noLeidos > 99 ? '99+' : noLeidos}</Text>
                </View>
              )}
            </View>
            <Text style={[tb.label, isActive && tb.labelActive]}>{cfg.label}</Text>
            {isActive && <View style={tb.dot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tb = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 16,
    overflow: 'visible',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    gap: 3,
  },
  label: { fontSize: 10, color: colors.textMuted, fontWeight: '500' },
  labelActive: { color: colors.primary, fontWeight: '700' },
  dot:          { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 2 },
  iconWrap:     { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText:    { color: colors.textOnPrimary, fontSize: 9, fontWeight: '700', lineHeight: 12 },
  centerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  centerBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  centerBtnActive: { backgroundColor: colors.primaryDark },
});
