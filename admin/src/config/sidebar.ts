import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowLeftRight,
  BadgeIndianRupee,
  BellRing,
  CalendarCheck,
  Car,
  CarFront,
  ChartColumn,
  ChartPie,
  ClipboardList,
  ClockCheck,
  CreditCard,
  FileCheck,
  FileText,
  FolderOpen,
  Gift,
  IdCard,
  IndianRupee,
  Landmark,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  MessageCircle,
  RotateCcw,
  Settings,
  Shapes,
  ShieldCheck,
  Ticket,
  Timer,
  TrendingUp,
  UserCog,
  UserSearch,
  Users,
  Wallet,
  Workflow,
  Wrench,
} from 'lucide-react-native';

export interface SidebarItem {
  label: string;
  icon: LucideIcon;
  /** Page path, e.g. /bookings. */
  path: string;
  /** Query values that pick a tab or view on that page, e.g. { tab: 'quotes' }. */
  params?: Record<string, string>;
}

export interface SidebarGroup {
  title: string;
  /** Shown on the group line; a group with one item is shown as that item's link instead. */
  icon: LucideIcon;
  items: SidebarItem[];
}

const item = (label: string, icon: LucideIcon, path: string, params?: Record<string, string>): SidebarItem => ({ label, icon, path, params });

/** The admin portal sidebar: groups of links to pages and their tabs. Who sees an item follows its page's roles. */
export const SIDEBAR: SidebarGroup[] = [
  { title: 'Overview',
    icon: LayoutDashboard, items: [item('Dashboard', LayoutDashboard, '/dashboard')] },
  {
    title: 'Fleet Management',
    icon: Car,
    items: [
      item('Vehicles', Car, '/fleet'),
      item('Vehicle Categories', Shapes, '/fleet', { view: 'categories' }),
      item('Vehicle Sales', BadgeIndianRupee, '/fleet', { status: 'Sold' }),
      item('GPS Tracking', MapPinned, '/tracking', { tab: 'gps-map' }),
      item('FASTag Management', CreditCard, '/fastag'),
    ],
  },
  {
    title: 'Rental Operations',
    icon: CalendarCheck,
    items: [
      item('Bookings & Reservations', CalendarCheck, '/bookings'),
      item('Quotations', FileText, '/bookings', { tab: 'quotes' }),
      item('Rental Agreements', FileCheck, '/agreements'),
      item('Vehicle Inspections', ClipboardList, '/inspections'),
      item('Active Rentals', Timer, '/tracking', { tab: 'active-rentals' }),
      item('Returns & Overdue', RotateCcw, '/tracking', { tab: 'overdue-rentals' }),
    ],
  },
  {
    title: 'People Management',
    icon: Users,
    items: [
      item('Customers', Users, '/customers'),
      item('Drivers', IdCard, '/people', { tab: 'drivers' }),
      item('Staff Management', UserCog, '/people', { tab: 'staff-directory' }),
      item('Attendance & Duty Punch', ClockCheck, '/people', { tab: 'attendance' }),
    ],
  },
  {
    title: 'Operations',
    icon: Wrench,
    items: [
      item('Maintenance', Wrench, '/maintenance'),
      item('Vehicle Documents', FolderOpen, '/documents'),
      item('Reminders & Notifications', BellRing, '/notifications'),
    ],
  },
  {
    title: 'Finance',
    icon: IndianRupee,
    items: [
      item('Transactions & Payments', ArrowLeftRight, '/finance', { tab: 'payments-and-refunds' }),
      item('Income & Expenses', TrendingUp, '/finance', { tab: 'overview' }),
      item('Loan & EMI', Landmark, '/finance', { tab: 'loan-emi' }),
      item('Salary & Commission', Wallet, '/people', { tab: 'payroll' }),
      item('Profit & Loss', ChartPie, '/finance', { tab: 'profit-and-loss' }),
    ],
  },
  {
    title: 'Customer Growth',
    icon: Gift,
    items: [
      item('Customer Codes & Referrals', Ticket, '/marketing', { tab: 'referral-codes' }),
      item('Marketing & Offers', Megaphone, '/marketing', { tab: 'campaigns' }),
      item('Loyalty & Gifts', Gift, '/marketing', { tab: 'loyalty-points' }),
      item('Automation', Workflow, '/marketing', { tab: 'automation' }),
    ],
  },
  {
    title: 'Reports',
    icon: ChartColumn,
    items: [
      item('Reports & Analytics', ChartColumn, '/reports'),
      item('Vehicle Reports', CarFront, '/reports', { tab: 'vehicle-wise' }),
      item('Customer Reports', UserSearch, '/reports', { tab: 'customer-wise' }),
      item('Financial Reports', IndianRupee, '/reports', { tab: 'income-and-expense' }),
    ],
  },
  {
    title: 'System',
    icon: Settings,
    items: [
      item('WhatsApp & SMS', MessageCircle, '/notifications', { tab: 'whatsapp-and-sms-settings' }),
      item('Settings', Settings, '/settings'),
      item('Roles & Permissions', ShieldCheck, '/settings', { tab: 'users-and-roles' }),
    ],
  },
];

export const hrefOf = (i: SidebarItem) => (i.params ? `${i.path}?${new URLSearchParams(i.params).toString()}` : i.path);

/**
 * The sidebar item for the current page: the one whose path and query values all match; otherwise the plain
 * item for that page (no query values); otherwise the item whose page contains this one (/fleet/car-1 → Vehicles).
 */
export function activeSidebarItem(items: SidebarItem[], pathname: string, search: URLSearchParams) {
  const matchesParams = (i: SidebarItem) => !!i.params && Object.entries(i.params).every(([k, v]) => search.get(k) === v);
  return (
    items.find((i) => i.path === pathname && matchesParams(i)) ??
    items.find((i) => i.path === pathname && !i.params) ??
    items.find((i) => !i.params && pathname.startsWith(`${i.path}/`))
  );
}
