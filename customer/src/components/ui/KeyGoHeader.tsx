import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles, withAlpha, type ThemeColors } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { KeyGoLogo } from './KeyGoLogo';
import { Bell, UserRound } from 'lucide-react-native';
import { callName } from '../../lib/names';

export const KeyGoHeader: React.FC<{ transparent?: boolean }> = ({ transparent }) => {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isPhone } = useResponsive();
  const { notifications, currentCustomerId, customers } = useApp();
  const name = callName(customers.find((c) => c.id === currentCustomerId)) || 'My account';

  const unreadCount = notifications.filter((n) => n.unread && n.customerId === currentCustomerId).length;

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }, transparent && { backgroundColor: 'transparent', borderBottomWidth: 0 }]}>
      <KeyGoLogo size={34} showText={true} showTagline={!isPhone && !transparent} tile={!transparent} />

      <View style={styles.rightActions}>
        {!transparent ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${name}, my account`}
            style={styles.rolePill}
            activeOpacity={0.7}
            onPress={() => router.navigate('/(tabs)/profile' as any)}>
            <UserRound size={16} color={colors.onNav} />
            <Text style={styles.roleText} numberOfLines={1}>
              {name}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Notifications, ${unreadCount} unread`}
          style={[styles.iconBtn, transparent && styles.iconBtnOnPhoto]}
          activeOpacity={0.7}
          onPress={() => router.navigate('/(tabs)/notifications' as any)}>
          <Bell size={18} color={colors.onNav} />
          {unreadCount > 0 && (
            <View style={styles.notifDot}>
              <Text style={styles.notifCount}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      backgroundColor: colors.nav,
      paddingHorizontal: 16,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.navLine,
      zIndex: 50,
    },
    rightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rolePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      backgroundColor: colors.navLine,
    },
    roleText: { color: colors.onNav, fontSize: 13, fontWeight: '700', maxWidth: 130 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.navLine,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Round, darker button so the bell stays visible over the hero photo
    iconBtnOnPhoto: { width: 42, height: 42, borderRadius: 21, backgroundColor: withAlpha(colors.shadow, 0.45) },
    notifDot: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: colors.highlight,
      borderWidth: 2,
      borderColor: colors.nav,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifCount: {
      color: colors.onHighlight,
      fontSize: 9,
      fontWeight: '800',
    },
  });
