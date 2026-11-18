import type { StaffRole } from '../services/auth';

export interface NavTab {
  slug: string;
  label: string;
}

export interface NavSection {
  id: string;
  title: string;
  href: string;
  description: string;
  /** Roles allowed to open this section. */
  roles: StaffRole[];
  tabs: NavTab[];
}

const ALL: StaffRole[] = ['Owner', 'Admin', 'Manager', 'Staff'];
const MANAGERS: StaffRole[] = ['Owner', 'Admin', 'Manager'];
const ADMINS: StaffRole[] = ['Owner', 'Admin'];

const t = (...labels: string[]): NavTab[] =>
  labels.map((label) => ({ label, slug: label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }));

export const NAV_SECTIONS: NavSection[] = [
  { id: 'dashboard', title: 'Dashboard', href: '/dashboard', description: 'Fleet, bookings and money at a glance', roles: ALL, tabs: [] },
  { id: 'fleet', title: 'Fleet Management', href: '/fleet', description: 'Vehicle records, status, documents and sale', roles: MANAGERS, tabs: [] },
  { id: 'bookings', title: 'Bookings & Reservations', href: '/bookings', description: 'Reservations, calendar, quotes and confirmations', roles: ALL, tabs: t('Booking List', 'Calendar', 'Create Booking', 'Quotes') },
  { id: 'customers', title: 'Customers', href: '/customers', description: 'Profiles, KYC, licences and documents', roles: ALL, tabs: [] },
  { id: 'agreements', title: 'Rental Agreements', href: '/agreements', description: 'Contracts, signatures, deposits, discounts and fines', roles: ALL, tabs: t('Agreement List', 'Agreement Details', 'Terms & Conditions', 'Deposits & Discounts', 'Fines & Penalties') },
  { id: 'inspections', title: 'Vehicle Inspections', href: '/inspections', description: 'Pickup and return checks, damage marking and costs', roles: ALL, tabs: t('Pickup Inspection', 'Return Inspection', 'Damage Reports', 'Inspection History') },
  { id: 'maintenance', title: 'Maintenance', href: '/maintenance', description: 'Service schedule, costs and renewals', roles: MANAGERS, tabs: t('Maintenance Overview', 'Service Schedule', 'Maintenance History', 'Expenses', 'Renewal Reminders') },
  { id: 'tracking', title: 'Rental Tracking', href: '/tracking', description: 'Active rentals, GPS, overdue and utilization', roles: ALL, tabs: t('Active Rentals', 'GPS Map', 'Overdue Rentals', 'Utilization') },
  { id: 'fastag', title: 'FASTag & Tolls', href: '/fastag', description: 'Balances, toll entries and customer billing', roles: MANAGERS, tabs: t('FASTag Overview', 'Toll Transactions', 'Customer Toll Billing', 'Toll Reports') },
  { id: 'people', title: 'Drivers & Staff', href: '/people', description: 'Directory, assignments, attendance and payroll', roles: MANAGERS, tabs: t('Staff Directory', 'Drivers', 'Driver Assignments', 'Attendance', 'Payroll') },
  { id: 'finance', title: 'Financial Management', href: '/finance', description: 'Income, expenses, EMI, refunds and profit', roles: ADMINS, tabs: t('Overview', 'Rental Income', 'Expenses', 'Loan EMI', 'Payments & Refunds', 'Fines', 'Profit & Loss') },
  { id: 'reports', title: 'Reports & Analytics', href: '/reports', description: 'Filterable reports with charts and export', roles: MANAGERS, tabs: t('Summary', 'Vehicle-wise', 'Customer-wise', 'Income & Expense', 'Maintenance', 'FASTag', 'Period Reports') },
  { id: 'notifications', title: 'Notifications', href: '/notifications', description: 'Reminders, templates, automation and delivery', roles: ALL, tabs: t('Notification Center', 'Reminders', 'Templates', 'Automation', 'Delivery History', 'WhatsApp & SMS Settings') },
  { id: 'marketing', title: 'Marketing & Loyalty', href: '/marketing', description: 'Campaigns, segments, referrals and rewards', roles: MANAGERS, tabs: t('Campaigns', 'Customer Segments', 'Referral Codes', 'Customer Commission', 'Loyalty Points', 'Gifts & Rewards', 'Automation') },
  { id: 'settings', title: 'Settings', href: '/settings', description: 'Company, roles, pricing, policies and theme', roles: ADMINS, tabs: t('Company Profile', 'Branches', 'Users & Roles', 'Permissions', 'Rental Pricing', 'Booking Policies', 'Payment Settings', 'Notification Settings', 'Terms & Conditions', 'Theme') },
];

export const findSection = (id: string) => NAV_SECTIONS.find((s) => s.id === id);

/** The section that owns a URL path, e.g. /fleet/car-1 -> fleet. */
export const sectionForPath = (pathname: string) => NAV_SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
