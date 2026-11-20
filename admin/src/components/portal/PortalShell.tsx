'use client';

import React, { ReactNode, Suspense, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bell, ChevronDown, ChevronRight, KeyRound, LogOut, Menu, MonitorSmartphone, Settings } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { AppProvider, useApp } from '../../context/AppContext';
import { ThemeProvider, useThemeColors, useThemedStyles, withAlpha, type ThemeColors } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { KeyGoLogo } from '../ui/KeyGoLogo';
import { KeyGoToast } from '../ui/KeyGoToast';
import { canOpen, sectionForPath } from '../../config/navigation';
import { DriverHome } from '../../features/driver/DriverHome';
import { ChangePasswordSheet } from './AccountSheets';
import { activeSidebarItem, hrefOf, SIDEBAR, type SidebarItem } from '../../config/sidebar';
import { canAccess, readSession, refreshSession, signOut, signOutEverywhere, type StaffSession } from '../../services/auth';
import { setUnauthorizedHandler } from '../../lib/api';
import { onServerStateError } from '../../lib/serverState';
import { loadWorkspace } from '../../services/workspace';
import { useResource } from '../../services/mockClient';
import { ConfirmDialog, EmptyState, Screen } from '../kit';
import { KeyGoToastView } from '../ui/KeyGoToast';
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
      SIDEBAR.map((g) => ({ ...g, items: g.items.filter((i) => { const sec = sectionForPath(i.path); return sec ? canOpen(session, sec) : true; }) })).filter((g) => g.items.length > 0),
    [session]
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
  const { refresh } = useStaffSession();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

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
    <View style={styles.sidebar}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 12 }} showsVerticalScrollIndicator={false}>
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
      <Svg width="100%" height={110} viewBox="0 0 288 110" preserveAspectRatio="none" style={styles.sidebarWave}>
        <Path d="M0 46 C 60 20, 120 70, 190 44 C 236 28, 268 36, 288 30 L 288 110 L 0 110 Z" fill={colors.onNav} fillOpacity={0.04} />
        <Path d="M0 70 C 80 44, 150 92, 230 64 C 256 56, 274 58, 288 56 L 288 110 L 0 110 Z" fill={colors.onNav} fillOpacity={0.05} />
      </Svg>
      <View style={styles.sidebarFooter}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.footerName} numberOfLines={1}>
            {session.name}
          </Text>
          <Text style={styles.footerRole} numberOfLines={1}>
            {session.role}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign out" style={styles.signOut} onPress={() => setConfirmSignOut(true)}>
          <LogOut size={16} color={colors.onNav} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out of KeyGo Admin?"
        message="You will need your email and password to sign in again."
        confirmLabel="Sign out"
        danger
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setConfirmSignOut(false);
          onNavigate?.();
          signOut();
          refresh();
          router.replace('/login');
        }}
      />
    </View>
  );
}

function NavbarWithAlerts({ session, onMenu }: { session: StaffSession; onMenu?: () => void }) {
  const { notifications, showToast } = useApp();
  const unread = notifications.filter((n) => n.unread && !n.customerId).length;
  return <Navbar session={session} onMenu={onMenu} unread={unread} notify={showToast} />;
}

function Navbar({ session, onMenu, unread, notify }: { session: StaffSession; onMenu?: () => void; unread?: number; notify: (message: string) => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isPhone } = useResponsive();
  const { refresh } = useStaffSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmEverywhere, setConfirmEverywhere] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const canManage = canAccess(session, 'users', 'edit');
  const leave = () => {
    refresh();
    router.replace('/login');
  };

  return (
    <View style={styles.header}>
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable accessibilityLabel="Close account menu" style={{ flex: 1 }} onPress={() => setMenuOpen(false)}>
          <View style={styles.accountMenu}>
            <Text style={styles.menuName}>{session.name}</Text>
            <Text style={styles.menuMeta}>{session.email}</Text>
            <Text style={styles.menuMeta}>{session.role}</Text>
            <View style={styles.menuRule} />
            {canManage ? (
              <TouchableOpacity accessibilityRole="button" style={styles.menuItem} onPress={() => { setMenuOpen(false); router.push('/settings?tab=users-and-roles'); }}>
                <Settings size={16} color={colors.txt} />
                <Text style={styles.menuItemText}>Users & settings</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity accessibilityRole="button" style={styles.menuItem} onPress={() => { setMenuOpen(false); setChangingPassword(true); }}>
              <KeyRound size={16} color={colors.txt} />
              <Text style={styles.menuItemText}>Change password</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.menuItem} onPress={() => { setMenuOpen(false); setConfirmEverywhere(true); }}>
              <MonitorSmartphone size={16} color={colors.txt} />
              <Text style={styles.menuItemText}>Sign out of all devices</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.menuItem} onPress={() => { setMenuOpen(false); setConfirmSignOut(true); }}>
              <LogOut size={16} color={colors.danger} />
              <Text style={[styles.menuItemText, { color: colors.danger }]}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out of KeyGo Admin?"
        message="You will need your email and password to sign in again."
        confirmLabel="Sign out"
        danger
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setConfirmSignOut(false);
          signOut();
          leave();
        }}
      />
      <ConfirmDialog
        visible={confirmEverywhere}
        title="Sign out of all devices?"
        message="Every browser and phone signed in to your account, including this one, will be signed out. Use this if you think someone else knows your password."
        confirmLabel="Sign out everywhere"
        danger
        onCancel={() => setConfirmEverywhere(false)}
        onConfirm={async () => {
          setConfirmEverywhere(false);
          try {
            await signOutEverywhere();
            leave();
          } catch (e) {
            notify((e as Error).message);
          }
        }}
      />
      {changingPassword ? (
        <ChangePasswordSheet
          onClose={() => setChangingPassword(false)}
          onDone={() => {
            setChangingPassword(false);
            notify('Password changed. Other devices were signed out.');
          }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {onMenu ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open navigation" style={styles.iconBtn} onPress={onMenu}>
            <Menu size={18} color={colors.onNav} />
          </TouchableOpacity>
        ) : null}
        <KeyGoLogo size={34} showText showTagline={!isPhone} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Account menu" style={styles.rolePill} onPress={() => setMenuOpen(true)}>
          <Text style={styles.roleText} numberOfLines={1}>
            {isPhone ? session.name.split(' ')[0] : `${session.name} - ${session.role}`}
          </Text>
          <ChevronDown size={15} color={colors.onNav} />
        </TouchableOpacity>
        {unread !== undefined ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Notifications, ${unread} unread`} style={styles.iconBtn} onPress={() => router.push('/notifications')}>
            <Bell size={18} color={colors.onNav} />
            {unread > 0 ? (
              <View style={styles.notifDot}>
                <Text style={styles.notifCount}>{unread}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function PortalFrame({ session, children }: { session: StaffSession; children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const section = sectionForPath(pathname);
  const allowed = !section || canOpen(session, section);

  return (
    <View style={styles.frame}>
      <NavbarWithAlerts session={session} onMenu={isDesktop ? undefined : () => setDrawer(true)} />
      <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
        {isDesktop ? <Sidebar session={session} /> : null}
        <View style={[styles.content, isDesktop ? styles.contentDesktop : styles.contentCompact]}>
          {/* Soft green wave in the top-right corner of the content panel */}
          <Svg width={560} height={190} viewBox="0 0 560 190" style={styles.contentWave}>
            <Path d="M120 0 C 210 70, 330 40, 420 90 C 480 124, 520 130, 560 118 L 560 0 Z" fill={colors.secondary} fillOpacity={0.1} />
            <Path d="M260 0 C 330 48, 420 30, 480 64 C 515 84, 540 86, 560 80 L 560 0 Z" fill={colors.secondary} fillOpacity={0.12} />
          </Svg>
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

/** Drivers get their own page only: assignments and duty punch. */
function DriverFrame({ session }: { session: StaffSession }) {
  const styles = useThemedStyles(makeStyles);
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <View style={styles.frame}>
      <Navbar session={session} notify={setToast} />
      <View style={[styles.content, styles.contentCompact]}>
        <DriverHome session={session} notify={setToast} />
      </View>
      <KeyGoToastView message={toast} onHide={() => setToast('')} />
    </View>
  );
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
  // Invitation links open without a session (and replace any session once accepted); so does the phone photo
  // page opened from a car's QR code
  const isPublic = isLogin || pathname === '/invite' || pathname === '/photo-upload' || pathname === '/verify';
  const refresh = () => setSession(readSession());

  useEffect(() => {
    if (!session && !isPublic) router.replace('/login');
    if (session && isLogin) router.replace('/dashboard');
  }, [session, isLogin, isPublic, router]);

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
    if (session) refreshSession().then(setSession, () => (session.permissions ? undefined : (signOut(), setSession(null))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  return (
    <SessionContext.Provider value={{ session, refresh }}>
      {isPublic ? (
        children
      ) : !session ? null : !session.permissions ? (
        // A session saved before permissions existed: wait for the server's copy
        <Screen>
          <ResourceState loading />
        </Screen>
      ) : session.role === 'Driver' ? (
        <DriverFrame session={session} />
      ) : (
        <SignedIn key={session.id} session={session}>
          {children}
        </SignedIn>
      )}
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
    frame: { height: '100%', backgroundColor: colors.nav },
    content: { flex: 1, minWidth: 0, backgroundColor: colors.bg, overflow: 'hidden' },
    contentDesktop: { borderTopLeftRadius: 28 },
    contentCompact: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    contentWave: { position: 'absolute', top: 0, right: 0, pointerEvents: 'none' },
    sidebarWave: { position: 'absolute', left: 0, right: 0, bottom: 64, pointerEvents: 'none' },
    accountMenu: {
      position: 'absolute',
      top: 62,
      right: 16,
      width: 250,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.line,
      boxShadow: `0px 16px 36px ${withAlpha(colors.shadow, 0.22)}`,
    } as never,
    menuName: { color: colors.txt, fontSize: 15, fontWeight: '800' },
    menuMeta: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
    menuRule: { height: 1, backgroundColor: colors.line, marginVertical: 10 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 8 },
    menuItemText: { color: colors.txt, fontSize: 14, fontWeight: '600' },
    header: {
      backgroundColor: colors.nav,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navLine, alignItems: 'center', justifyContent: 'center' },
    rolePill: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.navLine, maxWidth: 260 },
    roleText: { color: colors.onNav, fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
    notifDot: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.highlight, borderWidth: 2, borderColor: colors.nav, alignItems: 'center', justifyContent: 'center' },
    notifCount: { color: colors.onHighlight, fontSize: 9, fontWeight: '800' },
    sidebar: { width: 288, flexGrow: 0, flexShrink: 0, backgroundColor: colors.nav },
    sidebarFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.navLine },
    footerName: { color: colors.onNav, fontSize: 13.5, fontWeight: '700' },
    footerRole: { color: colors.navInactive, fontSize: 12, marginTop: 1 },
    signOut: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.navLine },
    signOutText: { color: colors.onNav, fontSize: 13, fontWeight: '700' },
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
