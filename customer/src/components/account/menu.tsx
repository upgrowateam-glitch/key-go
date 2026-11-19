import React, { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Bell,
  ChevronRight,
  BookOpen,
  CalendarCheck,
  CalendarPlus,
  Car,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  FileText,
  Gift,
  Hash,
  HeartHandshake,
  History,
  Home,
  IdCard,
  KeyRound,
  LifeBuoy,
  MessageCircle,
  Navigation,
  Receipt,
  Settings,
  ShieldCheck,
  ShieldHalf,
  Tag,
  TicketPercent,
  TriangleAlert,
  Undo2,
  UserRound,
  Wallet,
} from 'lucide-react-native';

import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles, withAlpha, type ThemeColors } from '../../theme';
import { additionalCharges, myBookings } from './money';

export type MenuItem = {
  key: string;
  label: string;
  hint: string;
  icon: (color: string) => ReactNode;
  href: string;
  /** Small badge on the right, e.g. a count or "Pending". */
  badge?: string;
  badgeTone?: 'warning' | 'success' | 'danger';
};
export type MenuGroup = { title: string; items: MenuItem[] };

function i(Icon: React.ComponentType<{ size?: number; color?: string }>) {
  const render = (c: string) => <Icon size={19} color={c} />;
  return render;
}
const acc = (section: string) => `/account/${section}`;

/**
 * The customer's full menu. Items that only make sense in some situations (an active rental, inspection
 * records, extra charges) are left out until they apply.
 */
export function useAccountMenu(): MenuGroup[] {
  const { bookings, currentCustomerId, customers, inspections, fastagLogs, agreements, notifications } = useApp();
  const me = customers.find((c) => c.id === currentCustomerId);
  const mine = myBookings(bookings, currentCustomerId);
  const active = mine.find((b) => b.status === 'Active');
  const quotes = mine.filter((b) => b.status === 'Quoted').length;
  const ids = new Set(mine.map((b) => b.id));
  const myInspections = inspections.filter((r) => ids.has(r.bookingId)).length;
  const myAgreements = agreements.filter((a) => ids.has(a.bookingId)).length;
  const charges = additionalCharges(mine, fastagLogs).length;
  const returning = mine.some((b) => b.status === 'Active' || b.status === 'Confirmed');
  const unread = notifications.filter((n) => n.unread && n.customerId === currentCustomerId).length;
  const docsPending = me ? me.documents.filter((d) => d.status !== 'Verified').length : 0;
  const enc = active ? encodeURIComponent(active.id) : '';

  const groups: MenuGroup[] = [
    {
      title: 'Main menu',
      items: [
        { key: 'home', label: 'Home', hint: 'Featured cars, search and offers', icon: i(Home), href: '/(tabs)' },
        { key: 'explore', label: 'Explore Vehicles', hint: 'All cars, categories, prices and availability', icon: i(Car), href: '/(tabs)/explore' },
        { key: 'bookings', label: 'My Bookings', hint: 'Upcoming, active, completed and cancelled', icon: i(CalendarCheck), href: '/(tabs)/bookings' },
        ...(active
          ? [{ key: 'active', label: 'Active Rental', hint: `${active.vehicleName} · return ${active.returnDate}`, icon: i(KeyRound), href: `/rental/${enc}`, badge: 'Live', badgeTone: 'success' as const }]
          : []),
        { key: 'history', label: 'Rental History', hint: 'Previous bookings and rental details', icon: i(History), href: acc('history') },
      ],
    },
    {
      title: 'Booking & rental',
      items: [
        { key: 'new', label: 'New Booking', hint: 'Choose a car, dates, purpose and duration', icon: i(CalendarPlus), href: '/booking' },
        { key: 'quotes', label: 'My Quotations', hint: 'Rental quotes and price breakdown', icon: i(FileText), href: acc('quotations'), badge: quotes ? String(quotes) : undefined, badgeTone: 'warning' },
        { key: 'agreements', label: 'Rental Agreements', hint: myAgreements ? `${myAgreements} signed agreement${myAgreements === 1 ? '' : 's'}` : 'Terms, e-signature and copies', icon: i(FileSignature), href: acc('agreements') },
        ...(myInspections ? [{ key: 'inspections', label: 'Vehicle Inspection Reports', hint: 'Pickup and return checks, photos and damage', icon: i(ClipboardCheck), href: acc('inspections') }] : []),
        ...(active ? [{ key: 'track', label: 'Vehicle Tracking', hint: 'Where your rental car is now', icon: i(Navigation), href: `/rental/${enc}/track` }] : []),
        ...(returning ? [{ key: 'returns', label: 'Return Details', hint: 'Return schedule, place and instructions', icon: i(Undo2), href: acc('returns') }] : []),
      ],
    },
    {
      title: 'My account',
      items: [
        { key: 'profile', label: 'My Profile', hint: 'Name, date of birth, address and city', icon: i(UserRound), href: acc('details') },
        {
          key: 'identity',
          label: 'Identity Verification',
          hint: 'ID card and face check status',
          icon: i(ShieldCheck),
          href: acc('identity'),
          badge: me && me.idCardStatus !== 'Verified' ? me.idCardStatus : undefined,
          badgeTone: me?.idCardStatus === 'Rejected' ? 'danger' : 'warning',
        },
        { key: 'licence', label: 'Driving Licence', hint: 'Licence number, state and expiry', icon: i(IdCard), href: acc('licence') },
        { key: 'documents', label: 'My Documents', hint: 'Your photo and uploaded documents', icon: i(BookOpen), href: acc('documents'), badge: docsPending ? `${docsPending} pending` : undefined, badgeTone: 'warning' },
        { key: 'emergency', label: 'Emergency / C/O Details', hint: 'Person we can contact for you', icon: i(HeartHandshake), href: acc('emergency') },
      ],
    },
    {
      title: 'Payments',
      items: [
        { key: 'payments', label: 'Payments & Transactions', hint: 'What you have paid and what is due', icon: i(CreditCard), href: acc('payments') },
        { key: 'deposit', label: 'Security Deposit', hint: 'Deposits paid, held and refunded', icon: i(Wallet), href: acc('deposit') },
        { key: 'invoices', label: 'Invoices & Receipts', hint: 'Receipts for your paid bookings', icon: i(Receipt), href: acc('invoices') },
        ...(charges ? [{ key: 'charges', label: 'Additional Charges & Fines', hint: 'Tolls, fuel, damage and penalties', icon: i(TriangleAlert), href: acc('charges'), badge: String(charges), badgeTone: 'danger' as const }] : []),
      ],
    },
    {
      title: 'Rewards & offers',
      items: [
        { key: 'code', label: 'My Customer Code', hint: me?.customerCode ? me.customerCode : 'Your personal code', icon: i(Hash), href: acc('code') },
        { key: 'refer', label: 'Refer a Friend', hint: 'Share your code with friends', icon: i(Gift), href: acc('refer') },
        { key: 'rewards', label: 'Rewards & Gifts', hint: me ? `${me.loyaltyTier} · ${me.loyaltyPoints.toLocaleString('en-IN')} points` : 'Loyalty rewards', icon: i(Tag), href: acc('rewards') },
        { key: 'offers', label: 'Offers & Discounts', hint: 'Savings on longer rentals and member perks', icon: i(TicketPercent), href: acc('offers') },
      ],
    },
    {
      title: 'Communication',
      items: [
        { key: 'notifications', label: 'Notifications', hint: 'Booking, pickup, return and payment reminders', icon: i(Bell), href: '/(tabs)/notifications', badge: unread ? String(unread) : undefined, badgeTone: 'warning' },
        { key: 'whatsapp', label: 'WhatsApp Support', hint: 'Chat with the KeyGo team', icon: i(MessageCircle), href: acc('whatsapp') },
        { key: 'help', label: 'Help & Support', hint: 'Call, email and support hours', icon: i(LifeBuoy), href: acc('help') },
      ],
    },
    {
      title: 'Settings',
      items: [
        { key: 'app', label: 'App Settings', hint: 'App version and updates', icon: i(Settings), href: acc('app-settings') },
        { key: 'privacy', label: 'Privacy & Security', hint: 'Your account and how your data is used', icon: i(ShieldHalf), href: acc('privacy') },
      ],
    },
  ];
  return groups;
}

/** One group of the menu: a small heading and a white card of rows. */
export function MenuSection({ group, onOpen }: { group: MenuGroup; onOpen: (href: string) => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
      <View style={styles.card}>
        {group.items.map((item, idx) => {
          const tone = item.badgeTone === 'success' ? colors.success : item.badgeTone === 'danger' ? colors.danger : colors.warning;
          return (
            <TouchableOpacity
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={[styles.row, idx > 0 && styles.rowLine]}
              onPress={() => onOpen(item.href)}>
              <View style={styles.icon}>{item.icon(colors.primaryText)}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.label} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.hint} numberOfLines={1}>
                  {item.hint}
                </Text>
              </View>
              {item.badge ? (
                <View style={[styles.badge, { backgroundColor: withAlpha(tone, 0.14) }]}>
                  <Text style={[styles.badgeText, { color: tone }]}>{item.badge}</Text>
                </View>
              ) : null}
              <ChevronRight size={18} color={colors.muted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}


const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    groupTitle: { color: colors.muted, fontSize: 11.5, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
    card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 60 },
    rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
    icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    label: { color: colors.txt, fontSize: 15, fontWeight: '700' },
    hint: { color: colors.muted, fontSize: 12, marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    badgeText: { fontSize: 11.5, fontWeight: '800' },
  });
