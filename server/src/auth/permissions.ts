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
  'identity',
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
  identity: 'ID documents & face check',
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

/** KeyGo's starting access for each role. The Owner can change Admin, Manager and Staff in Settings → Permissions. */
export const DEFAULT_PERMISSIONS: Record<StaffRoleLabel, PermissionMap> = {
  Owner: all('edit'),
  Admin: all('edit'),
  Manager: {
    ...all('edit'),
    finance: 'none',
    reports: 'view',
    settings: 'view',
    users: 'none',
  },
  // Staff can upload a customer's documents and see their status, but not open them or decide on them
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

/** Roles whose access the Owner may change. Owner always has everything; Drivers only have their driver page. */
export const EDITABLE_ROLES = ['Admin', 'Manager', 'Staff'] as const;
export type EditableRole = (typeof EDITABLE_ROLES)[number];
/** Settings document holding the Owner's changes; reserved, so the generic settings routes cannot touch it. */
export const PERMISSIONS_SETTING = 'auth.permissions';

/** The access in force: the defaults with the Owner's saved changes on top (kept in memory, see PermissionsService). */
let current: Record<StaffRoleLabel, PermissionMap> = DEFAULT_PERMISSIONS;
export const currentPermissions = () => current;

const ACCESS: Access[] = ['none', 'view', 'edit'];

/** Turns saved changes into a complete, valid table: unknown areas and values are ignored. */
export function withOverrides(saved: unknown): Record<StaffRoleLabel, PermissionMap> {
  const next = { ...DEFAULT_PERMISSIONS };
  const obj = saved && typeof saved === 'object' ? (saved as Record<string, Record<string, unknown>>) : {};
  for (const role of EDITABLE_ROLES) {
    const row = { ...DEFAULT_PERMISSIONS[role] };
    for (const area of AREAS) {
      const v = obj[role]?.[area];
      if (ACCESS.includes(v as Access)) row[area] = v as Access;
    }
    next[role] = row;
  }
  return next;
}

export function applyPermissions(table: Record<StaffRoleLabel, PermissionMap>) {
  current = table;
}

export const permissionsFor = (role: StaffRoleLabel | undefined): PermissionMap => (role ? current[role] : all('none'));

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
  driverPayEntries: 'people',
  driverSalaries: 'people',
  driverPayslips: 'people',
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
