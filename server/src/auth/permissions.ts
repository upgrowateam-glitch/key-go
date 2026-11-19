import type { StaffRoleLabel } from '../common/enums';

/**
 * Who can do what in the admin portal. The server enforces this on every request, and sends it to the portal
 * (GET /auth/staff/me) so the menu shows exactly the areas a person may open.
 *
 * Owner is the Super Admin: full access, and the only role that can manage other Owners.
 */
export const AREAS = [
  'dashboard',
  'fleet',
  'bookings',
  'customers',
  'agreements',
  'inspections',
  'maintenance',
  'tracking',
  'fastag',
  'people',
  'finance',
  'reports',
  'notifications',
  'marketing',
  'settings',
  'users',
] as const;
export type Area = (typeof AREAS)[number];
export type Access = 'none' | 'view' | 'edit';
export type PermissionMap = Record<Area, Access>;

export const AREA_LABELS: Record<Area, string> = {
  dashboard: 'Dashboard',
  fleet: 'Vehicles & documents',
  bookings: 'Bookings & quotes',
  customers: 'Customers',
  agreements: 'Rental agreements',
  inspections: 'Vehicle inspections',
  maintenance: 'Maintenance',
  tracking: 'Rental tracking',
  fastag: 'FASTag & tolls',
  people: 'Drivers & staff',
  finance: 'Finance',
  reports: 'Reports',
  notifications: 'Notifications',
  marketing: 'Marketing & loyalty',
  settings: 'Settings',
  users: 'User accounts',
};

const all = (access: Access): PermissionMap => Object.fromEntries(AREAS.map((a) => [a, access])) as PermissionMap;

export const ROLE_PERMISSIONS: Record<StaffRoleLabel, PermissionMap> = {
  Owner: all('edit'),
  Admin: all('edit'),
  Manager: {
    ...all('edit'),
    finance: 'none',
    reports: 'view',
    settings: 'view',
    users: 'none',
  },
  Staff: {
    ...all('none'),
    dashboard: 'view',
    fleet: 'view',
    bookings: 'edit',
    customers: 'edit',
    agreements: 'edit',
    inspections: 'edit',
    tracking: 'edit',
    notifications: 'edit',
    settings: 'view',
  },
  // Drivers only use their own driver page (assignments and duty); see DriverController.
  Driver: all('none'),
};

export const permissionsFor = (role: StaffRoleLabel | undefined): PermissionMap => (role ? ROLE_PERMISSIONS[role] : all('none'));

export const can = (role: StaffRoleLabel | undefined, area: Area, need: Access) => {
  const have = permissionsFor(role)[area];
  return need === 'view' ? have !== 'none' : have === 'edit';
};

/** Record collections saved by the portal, by the area they belong to. Unknown collections count as Settings. */
const COLLECTION_AREA: Record<string, Area> = {
  agreements: 'agreements',
  inspections: 'inspections',
  staffPunches: 'people',
  drivers: 'people',
  fastagLogs: 'fastag',
  maintenanceLogs: 'maintenance',
  maintenanceReminders: 'maintenance',
  commissions: 'marketing',
  campaigns: 'marketing',
  financeEntries: 'finance',
  notifications: 'notifications',
  messageLog: 'notifications',
};

export const areaOfCollection = (collection: string): Area => COLLECTION_AREA[collection] ?? 'settings';

/**
 * Settings documents, by the area that edits them. Everyone with portal access may read general settings
 * (prices, terms and the company profile are needed to make bookings), but only the owning area may change them.
 */
export function areaOfSetting(key: string): Area {
  const prefix = key.split('.')[0];
  switch (prefix) {
    case 'agreements':
      return 'agreements';
    case 'customers':
      return 'customers';
    case 'fastag':
      return 'fastag';
    case 'finance':
      return 'finance';
    case 'fleet':
      return 'fleet';
    case 'maintenance':
      return 'maintenance';
    case 'marketing':
    case 'loyaltyTiers':
      return 'marketing';
    case 'notifications':
    case 'notificationSettings':
    case 'automations':
      return 'notifications';
    case 'people':
      return 'people';
    case 'tracking':
      return 'tracking';
    default:
      return 'settings';
  }
}

/** Settings that hold payroll or money and must not be read by roles without that area. */
export const isPrivateSetting = (key: string) => ['finance', 'people'].includes(areaOfSetting(key));

/** Vehicle fields that booking and inspection staff may change without full fleet rights. */
export const OPERATIONAL_VEHICLE_FIELDS = ['status', 'odometerKm', 'fuelLevelPercent'];
