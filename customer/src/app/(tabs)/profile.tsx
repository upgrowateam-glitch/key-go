import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Award, CheckCircle2, ChevronRight, LogOut } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles, withAlpha, type ThemeColors } from '../../theme';
import { Avatar, Badge, ConfirmDialog, Screen } from '../../components/kit';
import { MenuSection, useAccountMenu } from '../../components/account/menu';
import { signOut } from '../../services/auth';

/** Profile tab: the customer's card, then every option of the app grouped as in the KeyGo menu. */
export default function ProfileScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { customers, currentCustomerId } = useApp();
  const me = customers.find((c) => c.id === currentCustomerId) ?? customers[0];
  const groups = useAccountMenu();
  const [confirmOut, setConfirmOut] = useState(false);
  const open = (href: string) => router.push(href as never);

  return (
    <Screen bottomInset={72} maxWidth={760}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="My profile details" style={styles.hero} onPress={() => open('/account/details')}>
        <Avatar name={me.name} bg={me.avatarBg} size={58} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.name} numberOfLines={1}>
              {me.name}
            </Text>
            {me.idCardStatus === 'Verified' ? <Badge label="Verified" tone="success" icon={(c) => <CheckCircle2 size={11} color={c} />} /> : null}
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {me.phone || me.email}
          </Text>
          <View style={styles.tierRow}>
            <Award size={14} color={colors.highlight} />
            <Text style={styles.tier}>
              {me.loyaltyTier} · {me.loyaltyPoints.toLocaleString('en-IN')} pts
            </Text>
            {me.customerCode ? <Text style={styles.code}>Code {me.customerCode}</Text> : null}
          </View>
        </View>
        <ChevronRight size={20} color={withAlpha(colors.onPrimary, 0.8)} />
      </TouchableOpacity>

      {groups.map((g) => (
        <MenuSection key={g.title} group={g} onOpen={open} />
      ))}

      <TouchableOpacity accessibilityRole="button" style={styles.logout} onPress={() => setConfirmOut(true)}>
        <LogOut size={19} color={colors.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <ConfirmDialog
        visible={confirmOut}
        title="Log out of KeyGo?"
        message="You'll need your email and password to sign in again."
        confirmLabel="Logout"
        danger
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          signOut();
          router.replace('/login' as never);
        }}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    hero: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.primary, borderRadius: 20, padding: 16 },
    name: { color: colors.onPrimary, fontSize: 19, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
    sub: { color: withAlpha(colors.onPrimary, 0.8), fontSize: 13, marginTop: 2 },
    tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
    tier: { color: colors.highlight, fontSize: 12.5, fontWeight: '800' },
    code: { color: withAlpha(colors.onPrimary, 0.75), fontSize: 12, marginLeft: 6 },
    logout: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 22,
      paddingVertical: 15,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.35),
      backgroundColor: withAlpha(colors.danger, 0.06),
    },
    logoutText: { color: colors.danger, fontSize: 15, fontWeight: '800' },
  });
