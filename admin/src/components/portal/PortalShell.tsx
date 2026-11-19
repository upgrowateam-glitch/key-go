'use client';

import React, { ReactNode, Suspense, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bell, ChevronDown, ChevronRight, LogOut, Menu } from 'lucide-react-native';
import { AppProvider, useApp } from '../../context/AppContext';
import { ThemeProvider, useThemeColors, useThemedStyles, withAlpha, type ThemeColors } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { KeyGoLogo } from '../ui/KeyGoLogo';
import { KeyGoToast } from '../ui/KeyGoToast';
import { sectionForPath } from '../../config/navigation';
import { activeSidebarItem, hrefOf, SIDEBAR, type SidebarItem } from '../../config/sidebar';
import { readSession, refreshSession, signOut, type StaffSession } from '../../services/auth';
import { setUnauthorizedHandler } from '../../lib/api';
import { onServerStateError } from '../../lib/serverState';
import { loadWorkspace } from '../../services/workspace';
import { useResource } from '../../services/mockClient';
import { EmptyState, Screen } from '../kit';
import { ResourceState } from './ResourceState';

const SessionContext = React.createContext<{ session: StaffSession | null; refresh: () => void }>({ session: null, refresh: () => {} });
export const useStaffSession = () => React.useContext(SessionContext);

function Sidebar({ session, onNavigate }: { session: StaffSession; onNavigate?: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Items whose page this role may open; groups left empty are hidden
  const groups = useMemo(
    () =>
      SIDEBAR.map((g) => ({ ...g, items: g.items.filter((i) => sectionForPath(i.path)?.roles.includes(session.role) ?? true) })).filter((g) => g.items.length > 0),
    [session.role]
  );
  const active = activeSidebarItem(
    groups.flatMap((g) => g.items),
    pathname,
    new URLSearchParams(params.toString())
  );

  // Warm the route code for every page this role can open, so switching pages is instant in production builds.
  useEffect(() => {
    new Set(groups.flatMap((g) => g.items.map((i) => i.path))).forEach((p) => router.prefetch(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.role]);

  const go = (href: string) => {
    router.push(href);
    onNavigate?.();
  };

  // One group open at a time; the group of the current page opens by itself
  const activeGroup = groups.find((g) => active && g.items.includes(active))?.title;
  const [open, setOpen] = useState<string | undefined>(activeGroup);
  useEffect(() => {
    if (activeGroup) setOpen(activeGroup);
  }, [activeGroup]);

  const link = (i: SidebarItem, nested: boolean) => {
    const isActive = active === i;
    const Icon = i.icon;
    return (
      <TouchableOpacity
        key={i.label}
        accessibilityRole="link"
        accessibilityState={{ selected: isActive }}
        style={[nested ? styles.subItem : styles.item, isActive && styles.itemActive]}
        onPress={() => go(hrefOf(i))}>
        {isActive ? <View style={styles.activeBar} /> : null}
        {nested ? null : <Icon size={18} color={isActive ? colors.navActive : colors.navInactive} />}
        <Text style={[nested ? styles.subText : styles.itemText, isActive && styles.itemTextActive]} numberOfLines={1}>
          {i.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.sidebar} contentContainerStyle={{ paddingVertical: 12 }} showsVerticalScrollIndicator={false}>
      {groups.map((g) => {
        // A group with a single page (Overview → Dashboard) is just that page's link
        if (g.items.length === 1) return link(g.items[0], false);
        const expanded = open === g.title;
        const holdsActive = activeGroup === g.title;
        const GroupIcon = g.icon;
        const Chevron = expanded ? ChevronDown : ChevronRight;
        return (
          <View key={g.title}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${g.title}, ${expanded ? 'collapse' : 'expand'}`}
              style={styles.item}
              onPress={() => setOpen(expanded ? undefined : g.title)}>
              <GroupIcon size={18} color={holdsActive ? colors.navActive : colors.navInactive} />
              <Text style={[styles.itemText, holdsActive && { color: colors.navActive }]} numberOfLines={1}>
                {g.title}
              </Text>
              <Chevron size={15} color={colors.navInactive} />
            </TouchableOpacity>
            {expanded ? <View style={styles.subList}>{g.items.map((i) => link(i, true))}</View> : null}
          </View>
        );
      })}
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
    item: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 10, marginHorizontal: 10, marginVertical: 2, paddingHorizontal: 12, paddingVertical: 10 },
    // Sub-items sit under their group, along a thin guide line
    subList: { marginLeft: 31, marginRight: 10, marginBottom: 6, borderLeftWidth: 1, borderLeftColor: withAlpha(colors.onNav, 0.14) },
    subItem: { borderRadius: 8, marginLeft: 8, marginVertical: 1, paddingHorizontal: 12, paddingVertical: 8 },
    subText: { color: colors.navInactive, fontSize: 13, fontWeight: '500' },
    itemActive: { backgroundColor: colors.navLine },
    activeBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: colors.highlight },
    itemText: { flex: 1, color: colors.navInactive, fontSize: 13.5, fontWeight: '600', letterSpacing: 0.1 },
    itemTextActive: { color: colors.navActive, fontWeight: '700' },
    scrim: { flex: 1, backgroundColor: colors.overlay },
  });
