'use client';

import React, { ReactNode, Suspense, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  CalendarCheck,
  Car,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileCheck,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Navigation,
  PieChart,
  Settings,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react-native';
import { AppProvider, useApp } from '../../context/AppContext';
import { ThemeProvider, useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { KeyGoLogo } from '../ui/KeyGoLogo';
import { KeyGoToast } from '../ui/KeyGoToast';
import { NAV_SECTIONS, sectionForPath, type NavSection } from '../../config/navigation';
import { readSession, refreshSession, signOut, type StaffSession } from '../../services/auth';
import { setUnauthorizedHandler } from '../../lib/api';
import { onServerStateError } from '../../lib/serverState';
import { loadWorkspace } from '../../services/workspace';
import { useResource } from '../../services/mockClient';
import { EmptyState, Screen } from '../kit';
import { ResourceState } from './ResourceState';

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  dashboard: LayoutDashboard,
  fleet: Car,
  bookings: CalendarCheck,
  customers: Users,
  agreements: FileCheck,
  inspections: ClipboardList,
  maintenance: Wrench,
  tracking: Navigation,
  fastag: CreditCard,
  people: UserCheck,
  finance: TrendingUp,
  reports: PieChart,
  notifications: Bell,
  marketing: Gift,
  settings: Settings,
};

const SessionContext = React.createContext<{ session: StaffSession | null; refresh: () => void }>({ session: null, refresh: () => {} });
export const useStaffSession = () => React.useContext(SessionContext);

function Sidebar({ session, onNavigate }: { session: StaffSession; onNavigate?: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = sectionForPath(pathname);
  const [expanded, setExpanded] = useState<string | undefined>(current?.id);
  useEffect(() => setExpanded(current?.id), [current?.id]);

  const go = (href: string) => {
    router.push(href);
    onNavigate?.();
  };
  const sections = NAV_SECTIONS.filter((s) => s.roles.includes(session.role));

  // Warm the route code for every section this role can open, so switching sections is instant in production builds.
  useEffect(() => {
    sections.forEach((s) => router.prefetch(s.href));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.role]);

  const item = (s: NavSection) => {
    const Icon = ICONS[s.id];
    const active = current?.id === s.id;
    const open = expanded === s.id && s.tabs.length > 0;
    const Chevron = open ? ChevronDown : ChevronRight;
    return (
      <View key={s.id}>
        <TouchableOpacity
          accessibilityRole="link"
          accessibilityState={{ selected: active }}
          style={[styles.item, active && { backgroundColor: colors.navLine }]}
          onPress={() => {
            setExpanded(s.id);
            go(s.href);
          }}>
          <Icon size={18} color={active ? colors.navActive : colors.navInactive} />
          <Text style={[styles.itemText, active && { color: colors.navActive }]} numberOfLines={1}>
            {s.title}
          </Text>
          {s.tabs.length > 0 ? <Chevron size={14} color={colors.navInactive} /> : null}
        </TouchableOpacity>
        {open
          ? s.tabs.map((t, i) => {
              const tabActive = active && (params.get('tab') === t.slug || (!params.get('tab') && i === 0 && pathname === s.href));
              return (
                <TouchableOpacity key={t.slug} accessibilityRole="link" style={styles.subItem} onPress={() => go(`${s.href}?tab=${t.slug}`)}>
                  <Text style={[styles.subText, tabActive && { color: colors.navActive, fontWeight: '700' }]} numberOfLines={1}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })
          : null}
      </View>
    );
  };

  return (
    <ScrollView style={styles.sidebar} contentContainerStyle={{ paddingVertical: 12 }} showsVerticalScrollIndicator={false}>
      {sections.map(item)}
    </ScrollView>
  );
}

function Navbar({ session, onMenu }: { session: StaffSession; onMenu?: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isPhone } = useResponsive();
  const { notifications } = useApp();
  const { refresh } = useStaffSession();
  const unread = notifications.filter((n) => n.unread && !n.customerId).length;

  return (
    <View style={styles.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {onMenu ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open navigation" style={styles.iconBtn} onPress={onMenu}>
            <Menu size={18} color={colors.onNav} />
          </TouchableOpacity>
        ) : null}
        <KeyGoLogo size={34} showText showTagline={!isPhone} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {!isPhone ? (
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>
              {session.name} · {session.role}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Notifications, ${unread} unread`} style={styles.iconBtn} onPress={() => router.push('/notifications')}>
          <Bell size={18} color={colors.onNav} />
          {unread > 0 ? (
            <View style={styles.notifDot}>
              <Text style={styles.notifCount}>{unread}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={styles.iconBtn}
          onPress={() => {
            signOut();
            refresh();
            router.replace('/login');
          }}>
          <LogOut size={18} color={colors.onNav} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PortalFrame({ session, children }: { session: StaffSession; children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  const { isDesktop } = useResponsive();
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const section = sectionForPath(pathname);
  const allowed = !section || section.roles.includes(session.role);

  return (
    <View style={styles.frame}>
      <Navbar session={session} onMenu={isDesktop ? undefined : () => setDrawer(true)} />
      <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
        {isDesktop ? <Sidebar session={session} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          {allowed ? (
            children
          ) : (
            <Screen>
              <EmptyState title="You don't have access to this section" message={`Your ${session.role} role can't open ${section?.title}. Ask an administrator if you need it.`} />
            </Screen>
          )}
        </View>
      </View>
      {!isDesktop ? (
        <Modal visible={drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <Sidebar session={session} onNavigate={() => setDrawer(false)} />
            <Pressable accessibilityLabel="Close navigation" style={styles.scrim} onPress={() => setDrawer(false)} />
          </View>
        </Modal>
      ) : null}
      <KeyGoToast />
    </View>
  );
}

/** Shows save failures of settings documents as a toast. */
function SaveErrors() {
  const { showToast } = useApp();
  useEffect(() => onServerStateError(showToast), [showToast]);
  return null;
}

/** Loads everything from the server once the staff member is signed in. */
function SignedIn({ session, children }: { session: StaffSession; children: ReactNode }) {
  const workspace = useResource(loadWorkspace);
  if (!workspace.data) {
    return (
      <Screen>
        <ResourceState loading={workspace.loading} error={workspace.error} onRetry={workspace.reload} />
      </Screen>
    );
  }
  return (
    <AppProvider seed={workspace.data}>
      <SaveErrors />
      <PortalFrame session={session}>{children}</PortalFrame>
    </AppProvider>
  );
}

function Workspace({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<StaffSession | null>(() => readSession());
  const isLogin = pathname === '/login';
  const refresh = () => setSession(readSession());

  useEffect(() => {
    if (!session && !isLogin) router.replace('/login');
    if (session && isLogin) router.replace('/dashboard');
  }, [session, isLogin, router]);

  // An expired or revoked session sends the user back to sign in
  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
      setSession(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Pick up role or name changes made by an administrator since the last visit
  useEffect(() => {
    if (session) refreshSession().then(setSession, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  return (
    <SessionContext.Provider value={{ session, refresh }}>
      {isLogin ? children : session ? <SignedIn key={session.id} session={session}>{children}</SignedIn> : null}
    </SessionContext.Provider>
  );
}

export default function PortalShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <Suspense fallback={null}>
        <Workspace>{children}</Workspace>
      </Suspense>
    </ThemeProvider>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    frame: { height: '100%', backgroundColor: colors.bg },
    header: {
      backgroundColor: colors.nav,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.navLine,
    },
    iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.navLine, alignItems: 'center', justifyContent: 'center' },
    rolePill: { height: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.navLine },
    roleText: { color: colors.onNav, fontSize: 12, fontWeight: '700' },
    notifDot: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.highlight, borderWidth: 2, borderColor: colors.nav, alignItems: 'center', justifyContent: 'center' },
    notifCount: { color: colors.onHighlight, fontSize: 9, fontWeight: '800' },
    sidebar: { width: 288, flexGrow: 0, flexShrink: 0, backgroundColor: colors.nav, borderRightWidth: 1, borderRightColor: colors.navLine },
    item: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, marginHorizontal: 10, marginVertical: 2, paddingHorizontal: 12, paddingVertical: 10 },
    itemText: { flex: 1, color: colors.navInactive, fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
    subItem: { marginLeft: 38, marginRight: 10, paddingHorizontal: 10, paddingVertical: 7 },
    subText: { color: colors.navInactive, fontSize: 12.5, fontWeight: '500' },
    scrim: { flex: 1, backgroundColor: colors.overlay },
  });
