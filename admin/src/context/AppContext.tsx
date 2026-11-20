import React, { createContext, useContext, useRef, useState, ReactNode, useCallback } from 'react';
import {
  Vehicle,
  Booking,
  Customer,
  Agreement,
  AgreementFine,
  InspectionRecord,
  FASTagLog,
  MaintenanceRecord,
  MaintenanceReminder,
  Driver,
  StaffPunch,
  CustomerCodeCommission,
  NotificationItem,
  NotificationChannelSetting,
  MessageLogEntry,
  AutomationRule,
  Campaign,
  LoyaltyRewardTier,
  FinanceEntry,
  RentalTerm,
  RentalPurpose,
  BookingClassification,
} from '../types';
import { DEFAULT_AUTOMATIONS, DEFAULT_LOYALTY_TIERS, DEFAULT_NOTIFICATION_SETTINGS, newId } from '../config/defaults';
import { api } from '../lib/api';
import { computeQuote } from '../lib/pricing';
import { lifecycleStatus } from '../lib/vehicleStatus';
import { addDays, daysBetween } from '../lib/format';
import { serverDoc, type ServerDoc } from '../lib/serverState';
import { useSyncedList } from '../lib/syncedList';
import { TODAY } from '../lib/today';
import type { Workspace } from '../services/workspace';

export type UserRole = 'customer' | 'operations';

export interface BookingDraft {
  pickupLocation: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  vehicleType: string;
  term: RentalTerm;
  purpose: RentalPurpose;
  days: number;
}

/** Input for generating a quote (a booking in the "Quoted" state). */
export interface QuoteInput {
  vehicleId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  pickupLocation: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  term: RentalTerm;
  purpose: RentalPurpose;
  classification: BookingClassification;
  discount?: number;
  driverId?: string;
}

export interface SignAgreementInput {
  signaturePath: string;
  signedBy: string;
  securityDeposit: number;
  discount: number;
  fines: AgreementFine[];
}

export type InspectionInput = Omit<InspectionRecord, 'id' | 'bookingId' | 'vehicleNumber' | 'date' | 'type' | 'damagesMarked'>;

export interface SettlementInput {
  fuelCharges: number;
  tollCharges: number;
  fineCharges: number;
  damageCharges: number;
}

interface ToastState {
  visible: boolean;
  message: string;
}

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  toast: ToastState;
  showToast: (msg: string) => void;
  hideToast: () => void;
  today: string;
  /** The signed-in customer in the customer portal (sample user). */
  currentCustomerId: string;

  // Fleet
  vehicles: Vehicle[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  updateVehicleStatus: (id: string, status: Vehicle['status']) => void;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  showVehicleChange: (id: string, patch: Partial<Vehicle>) => void;
  addVehicle: (vehicle: Vehicle) => void;
  markVehicleSold: (id: string, sale: NonNullable<Vehicle['saleInfo']>) => void;

  // Bookings & rental lifecycle
  bookings: Booking[];
  bookingDraft: BookingDraft;
  setBookingDraft: React.Dispatch<React.SetStateAction<BookingDraft>>;
  /** Legacy one-step booking (kept for compatibility). Prefer createQuote + confirmBooking. */
  createBooking: (vehicle: Vehicle) => Booking;
  createQuote: (input: QuoteInput) => Booking;
  confirmBooking: (bookingId: string) => void;
  cancelBooking: (bookingId: string) => void;
  signAgreement: (bookingId: string, input: SignAgreementInput) => Agreement;
  recordInspection: (bookingId: string, type: InspectionRecord['type'], input: InspectionInput) => InspectionRecord;
  completeRental: (bookingId: string, settlement: SettlementInput) => void;
  toggleKeylessUnlock: (bookingId: string) => void;
  extendRental: (bookingId: string, extraDays: number) => void;

  // Customers
  customers: Customer[];
  addCustomer: (cust: Customer) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  showCustomer: (c: Customer) => void;

  // Agreements & Inspections
  agreements: Agreement[];
  inspections: InspectionRecord[];
  addInspection: (insp: InspectionRecord) => void;

  // FASTag & Maintenance
  fastagLogs: FASTagLog[];
  billTollToCustomer: (logId: string) => void;
  rechargeFastag: (vehicleId: string, amount: number) => void;
  maintenanceLogs: MaintenanceRecord[];
  addMaintenanceRecord: (rec: MaintenanceRecord) => void;
  maintenanceReminders: MaintenanceReminder[];
  completeReminder: (reminderId: string) => void;

  // Staff & Drivers
  drivers: Driver[];
  updateDriver: (id: string, patch: Partial<Driver>) => void;
  addDriver: (driver: Driver) => void;
  removeDriver: (id: string) => void;
  addStaff: (staff: StaffPunch) => void;
  updateStaff: (id: string, patch: Partial<StaffPunch>) => void;
  removeStaff: (id: string) => void;
  /** Links a driver to a booking (updates both the booking and the driver's assignments). */
  assignDriverToBooking: (bookingId: string, driverId: string) => void;
  staffPunches: StaffPunch[];
  toggleDutyPunch: (staffId: string) => void;

  // Business features
  commissions: CustomerCodeCommission[];
  updateCommission: (code: string, patch: Partial<CustomerCodeCommission>) => void;
  addCommission: (c: CustomerCodeCommission) => void;
  automations: AutomationRule[];
  toggleAutomation: (id: string) => void;
  campaigns: Campaign[];
  addCampaign: (c: Campaign) => void;
  updateCampaign: (id: string, patch: Partial<Campaign>) => void;
  loyaltyTiers: LoyaltyRewardTier[];

  // Finance
  financeEntries: FinanceEntry[];

  // Notifications
  notifications: NotificationItem[];
  markAllNotificationsRead: () => void;
  notificationSettings: NotificationChannelSetting[];
  toggleNotificationChannel: (type: NotificationChannelSetting['type'], channel: 'whatsapp' | 'sms') => void;
  messageLog: MessageLogEntry[];
  /** Simulates sending a WhatsApp/SMS message (no real delivery). */
  sendTestMessage: (type: NotificationChannelSetting['type'], channel: MessageLogEntry['channel'], recipient: string, preview: string) => void;
}

const defaultDraft: BookingDraft = {
  pickupLocation: 'Bengaluru International Airport (BLR)',
  pickupDate: addDays(TODAY, 3),
  pickupTime: '10:00 AM',
  returnDate: addDays(TODAY, 6),
  returnTime: '06:00 PM',
  vehicleType: 'All',
  term: 'Daily',
  purpose: 'Personal',
  days: 3,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const nowLabel = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const enc = encodeURIComponent;

/** Settings documents holding whole lists (edited in place rather than added to). */
const notificationSettingsDoc = serverDoc<NotificationChannelSetting[]>('notificationSettings', DEFAULT_NOTIFICATION_SETTINGS);
const automationsDoc = serverDoc<AutomationRule[]>('automations', DEFAULT_AUTOMATIONS);
const loyaltyTiersDoc = serverDoc<LoyaltyRewardTier[]>('loyaltyTiers', DEFAULT_LOYALTY_TIERS);

/** A list stored as one settings document: saved whole after each change, put back if the save fails. */
function useDocList<T>(doc: ServerDoc<T[]>, onError: (message: string) => void) {
  const [items, setItems] = useState<T[]>(doc.get);
  const ref = useRef(items);
  const set = useCallback(
    (update: T[] | ((prev: T[]) => T[])) => {
      const prev = ref.current;
      const next = typeof update === 'function' ? (update as (p: T[]) => T[])(prev) : update;
      ref.current = next;
      setItems(next);
      doc.set(next).catch((e: Error) => {
        ref.current = prev;
        setItems(prev);
        onError(e.message);
      });
    },
    [doc, onError]
  );
  return [items, set] as const;
}

export const AppProvider: React.FC<{ children: ReactNode; seed: Workspace }> = ({ children, seed }) => {
  const [role, setRoleState] = useState<UserRole>('operations');
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '' });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message });
    toastTimer.current = setTimeout(() => setToast({ visible: false, message: '' }), 3200);
  }, []);
  const onSaveError = useCallback((message: string) => showToast(`Not saved: ${message}`), [showToast]);

  /** A list of records saved one by one to /admin/records/<collection>. */
  const recordSync = <T,>(collection: string, keyOf: (item: T) => string = (item) => (item as { id: string }).id) => ({
    keyOf,
    save: (item: T) => api(`/admin/records/${collection}/${enc(keyOf(item))}`, { method: 'PUT', body: item }),
    remove: (key: string) => api(`/admin/records/${collection}/${enc(key)}`, { method: 'DELETE' }),
    onError: onSaveError,
  });
  const records = <T,>(collection: string) => (seed.records[collection] ?? []) as T[];

  const [vehicles, setVehicles, vehiclesRef, setVehiclesLocal] = useSyncedList<Vehicle>(seed.vehicles, {
    keyOf: (v) => v.id,
    save: ({ imageAsset: _photo, ...v }) => api(`/admin/vehicles/${enc(v.id)}`, { method: 'PUT', body: v }),
    onError: onSaveError,
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  // bookingsRef: latest bookings, including ones created earlier in the same event handler (e.g. quote → confirm)
  const [bookings, setBookings, bookingsRef] = useSyncedList<Booking>(seed.bookings, {
    keyOf: (b) => b.id,
    save: (b) => api(`/admin/bookings/${enc(b.id)}`, { method: 'PUT', body: b }),
    onError: onSaveError,
  });
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(defaultDraft);

  const [customers, setCustomers, customersRef, setCustomersLocal] = useSyncedList<Customer>(seed.customers, {
    keyOf: (c) => c.id,
    save: (c) => api(`/admin/customers/${enc(c.id)}`, { method: 'PUT', body: c }),
    onError: onSaveError,
  });
  const [agreements, setAgreements] = useSyncedList<Agreement>(records('agreements'), recordSync('agreements'));
  const [inspections, setInspections] = useSyncedList<InspectionRecord>(records('inspections'), recordSync('inspections'));
  const [staffPunches, setStaffPunches] = useSyncedList<StaffPunch>(records('staffPunches'), recordSync('staffPunches'));
  const [fastagLogs, setFastagLogs] = useSyncedList<FASTagLog>(records('fastagLogs'), recordSync('fastagLogs'));
  const [maintenanceLogs, setMaintenanceLogs] = useSyncedList<MaintenanceRecord>(records('maintenanceLogs'), recordSync('maintenanceLogs'));
  const [maintenanceReminders, setMaintenanceReminders] = useSyncedList<MaintenanceReminder>(records('maintenanceReminders'), recordSync('maintenanceReminders'));
  const [drivers, setDrivers] = useSyncedList<Driver>(records('drivers'), recordSync('drivers'));
  const [commissions, setCommissions] = useSyncedList<CustomerCodeCommission>(records('commissions'), recordSync<CustomerCodeCommission>('commissions', (c) => c.code));
  const [campaigns, setCampaigns] = useSyncedList<Campaign>(records('campaigns'), recordSync('campaigns'));
  const [financeEntries, setFinanceEntries] = useSyncedList<FinanceEntry>(records('financeEntries'), recordSync('financeEntries'));
  const [notifications, setNotifications] = useSyncedList<NotificationItem>(records('notifications'), recordSync('notifications'));
  const [messageLog, setMessageLog] = useSyncedList<MessageLogEntry>(records('messageLog'), recordSync('messageLog'));
  const [automations, setAutomations] = useDocList(automationsDoc, onSaveError);
  const [notificationSettings, setNotificationSettings] = useDocList(notificationSettingsDoc, onSaveError);
  const [loyaltyTiers] = useDocList(loyaltyTiersDoc, onSaveError);

  const hideToast = () => setToast({ visible: false, message: '' });

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    showToast(`Switched to ${newRole === 'customer' ? 'Customer view' : 'Admin & staff view'}`);
  };

  const patchBooking = (id: string, patch: Partial<Booking>) =>
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const setVehicleStatusSilently = (id: string, status: Vehicle['status']) =>
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));

  /** After a booking changes, the car's status follows the bookings (the server applies the same rule). */
  const followBookings = (vehicleId: string) => {
    const v = vehiclesRef.current.find((x) => x.id === vehicleId);
    if (!v) return;
    const next = lifecycleStatus(v.status, vehicleId, bookingsRef.current, TODAY);
    if (next !== v.status) setVehicleStatusSilently(vehicleId, next);
  };

  // ---------- Fleet ----------
  const updateVehicleStatus = (id: string, status: Vehicle['status']) => {
    setVehicleStatusSilently(id, status);
    showToast(`Vehicle status updated to ${status}`);
  };

  const updateVehicle = (id: string, patch: Partial<Vehicle>) =>
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  /** Shows a change the server already made (photos uploaded from a phone) without saving the car again. */
  const showVehicleChange = (id: string, patch: Partial<Vehicle>) =>
    setVehiclesLocal(vehiclesRef.current.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const addVehicle = (newVehicle: Vehicle) => {
    setVehicles((prev) => [newVehicle, ...prev]);
    showToast(`${newVehicle.name} added to fleet`);
  };

  const markVehicleSold = (id: string, sale: NonNullable<Vehicle['saleInfo']>) => {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, status: 'Sold', saleInfo: sale } : v)));
    showToast('Vehicle marked as sold');
  };

  // ---------- Booking lifecycle ----------
  const newBookingId = () => newId('KG');

  const createQuote = (input: QuoteInput): Booking => {
    const vehicle = vehicles.find((v) => v.id === input.vehicleId) ?? vehicles[0];
    const customer = customers.find((c) => c.id === input.customerId);
    const days = Math.max(1, daysBetween(input.pickupDate, input.returnDate) || 1);
    const q = computeQuote(vehicle, days, input.term, input.discount ?? 0);
    const booking: Booking = {
      id: newBookingId(),
      customerId: customer?.id,
      customerName: customer?.name ?? input.customerName ?? 'Walk-in customer',
      customerPhone: customer?.phone ?? input.customerPhone ?? '',
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleCategory: vehicle.type,
      pickupLocation: input.pickupLocation,
      pickupDate: input.pickupDate,
      pickupTime: input.pickupTime,
      returnDate: input.returnDate,
      returnTime: input.returnTime,
      days,
      term: input.term,
      purpose: input.purpose,
      classification: input.classification,
      baseRatePerDay: vehicle.pricePerDay,
      subtotal: q.subtotal,
      discount: q.manualDiscount + q.termDiscount,
      tax: q.tax,
      totalAmount: q.total,
      depositAmount: q.deposit,
      status: 'Quoted',
      paymentStatus: 'Unpaid',
      createdAt: TODAY,
      reminderScheduledFor: addDays(input.pickupDate, -2),
      reminderSent: false,
      driverId: input.driverId,
    };
    bookingsRef.current = [booking, ...bookingsRef.current];
    setBookings((prev) => [booking, ...prev]);
    showToast(`Quote ${booking.id} generated`);
    return booking;
  };

  const confirmBooking = (bookingId: string) => {
    const b = bookingsRef.current.find((x) => x.id === bookingId);
    if (!b) return;
    setBookings((prev) =>
      prev.map((x) =>
        x.id === bookingId
          ? {
              ...x,
              status: 'Confirmed',
              paymentStatus: x.paymentStatus === 'Unpaid' ? 'Deposit paid' : x.paymentStatus,
              reminderScheduledFor: addDays(x.pickupDate, -2),
            }
          : x
      )
    );
    followBookings(b.vehicleId);
    showToast(`Booking ${bookingId} confirmed · reminder scheduled`);
  };

  const cancelBooking = (bookingId: string) => {
    const b = bookingsRef.current.find((x) => x.id === bookingId);
    if (!b) return;
    patchBooking(bookingId, { status: 'Cancelled' });
    const stillHeld = bookingsRef.current.some((x) => x.id !== bookingId && x.vehicleId === b.vehicleId && (x.status === 'Confirmed' || x.status === 'Active'));
    if (!stillHeld) followBookings(b.vehicleId);
    showToast(`Booking ${bookingId} cancelled`);
  };

  const createBooking = (vehicle: Vehicle): Booking => {
    const quote = createQuote({
      vehicleId: vehicle.id,
      pickupLocation: bookingDraft.pickupLocation || 'City Center',
      pickupDate: bookingDraft.pickupDate,
      pickupTime: bookingDraft.pickupTime,
      returnDate: bookingDraft.returnDate,
      returnTime: bookingDraft.returnTime,
      term: bookingDraft.term,
      purpose: bookingDraft.purpose,
      classification: 'Online',
    });
    const confirmed: Booking = { ...quote, status: 'Confirmed', paymentStatus: 'Deposit paid' };
    setBookings((prev) => prev.map((b) => (b.id === quote.id ? confirmed : b)));
    followBookings(vehicle.id);
    return confirmed;
  };

  const signAgreement = (bookingId: string, input: SignAgreementInput): Agreement => {
    const b = bookings.find((x) => x.id === bookingId)!;
    const agreement: Agreement = {
      id: newId(`AGR-${TODAY.slice(0, 4)}`),
      bookingId,
      customerName: b.customerName,
      vehicleNumber: b.vehicleNumber,
      signedDate: TODAY,
      status: 'Active',
      depositTermsAccepted: true,
      signaturePreview: `${input.signedBy} (Digitally Signed)`,
      signaturePath: input.signaturePath,
      rentalAmount: b.totalAmount,
      securityDeposit: input.securityDeposit,
      discount: input.discount,
      fines: input.fines,
    };
    setAgreements((prev) => [agreement, ...prev]);
    patchBooking(bookingId, { agreementId: agreement.id, depositAmount: input.securityDeposit });
    showToast(`Agreement ${agreement.id} signed`);
    return agreement;
  };

  const recordInspection = (
    bookingId: string,
    type: InspectionRecord['type'],
    input: InspectionInput
  ): InspectionRecord => {
    const b = bookings.find((x) => x.id === bookingId)!;
    const record: InspectionRecord = {
      ...input,
      id: newId('INSP'),
      bookingId,
      vehicleNumber: b.vehicleNumber,
      type,
      damagesMarked: input.damageMarks.map((d) => `${d.zone} — ${d.kind} (${d.severity})`),
      date: `${TODAY} ${nowLabel()}`,
    };
    setInspections((prev) => [record, ...prev]);
    if (type === 'Pickup') {
      patchBooking(bookingId, {
        pickupInspectionId: record.id,
        status: 'Active',
        startOdometerKm: input.odometerKm,
        kmDriven: 0,
        paymentStatus: 'Paid',
      });
      followBookings(b.vehicleId);
      showToast('Pickup inspection saved · rental is now active');
    } else {
      const start = b.startOdometerKm ?? input.odometerKm;
      patchBooking(bookingId, {
        returnInspectionId: record.id,
        endOdometerKm: input.odometerKm,
        kmDriven: Math.max(0, input.odometerKm - start),
        damageCharges: input.estimatedDamageCost,
      });
      updateVehicle(b.vehicleId, { odometerKm: input.odometerKm, fuelLevelPercent: input.fuelPercent });
      showToast('Return inspection saved · ready to settle');
    }
    return record;
  };

  const completeRental = (bookingId: string, s: SettlementInput) => {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) return;
    patchBooking(bookingId, {
      status: 'Completed',
      paymentStatus: 'Refunded',
      fuelCharges: s.fuelCharges,
      tollCharges: s.tollCharges,
      fineCharges: s.fineCharges,
      damageCharges: s.damageCharges,
      completedAt: TODAY,
      keylessUnlocked: false,
    });
    followBookings(b.vehicleId);
    setAgreements((prev) => prev.map((a) => (a.bookingId === bookingId ? { ...a, status: 'Closed' } : a)));
    const extra = s.fuelCharges + s.tollCharges + s.fineCharges + s.damageCharges;
    setFinanceEntries((prev) => [
      { id: newId('FIN'), date: TODAY, category: 'Rental income', direction: 'in', amount: b.totalAmount, vehicleId: b.vehicleId, reference: b.id },
      ...(s.fineCharges + s.damageCharges > 0
        ? [{ id: newId('FIN'), date: TODAY, category: 'Fine collection' as const, direction: 'in' as const, amount: s.fineCharges + s.damageCharges, vehicleId: b.vehicleId, reference: `${b.id} fines & damage` }]
        : []),
      ...prev,
    ]);
    setFastagLogs((prev) => prev.map((l) => (l.bookingId === bookingId ? { ...l, billedToCustomer: true } : l)));
    showToast(extra > 0 ? `Rental completed · ₹${extra.toLocaleString('en-IN')} deducted from deposit` : 'Rental completed · full deposit refunded');
  };

  const toggleKeylessUnlock = (bookingId: string) => {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) return;
    const next = !b.keylessUnlocked;
    patchBooking(bookingId, { keylessUnlocked: next });
    showToast(next ? 'Car unlocked · digital key active (simulated)' : 'Car locked (simulated)');
  };

  const extendRental = (bookingId: string, extraDays: number) => {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) return;
    const days = b.days + extraDays;
    const vehicle = vehicles.find((v) => v.id === b.vehicleId) ?? vehicles[0];
    const q = computeQuote(vehicle, days, b.term, 0);
    patchBooking(bookingId, {
      days,
      returnDate: addDays(b.returnDate, extraDays),
      subtotal: q.subtotal,
      tax: q.tax,
      totalAmount: q.total,
    });
    showToast(`Extension requested · new return ${addDays(b.returnDate, extraDays)}`);
  };

  // ---------- Customers ----------
  const addCustomer = (cust: Customer) => {
    setCustomers((prev) => [cust, ...prev]);
    showToast(`Customer ${cust.name} added`);
  };

  /** Shows the server's copy of a customer (after document checks) without saving it again. */
  const showCustomer = (c: Customer) => setCustomersLocal(customersRef.current.map((x) => (x.id === c.id ? { ...x, ...c } : x)));

  const updateCustomer = (id: string, patch: Partial<Customer>) =>
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        next.name = `${next.firstName} ${next.lastName}`.trim();
        return next;
      })
    );

  const addInspection = (insp: InspectionRecord) => {
    setInspections((prev) => [insp, ...prev]);
    showToast(`Inspection report ${insp.id} saved`);
  };

  // ---------- FASTag & maintenance ----------
  const billTollToCustomer = (logId: string) => {
    setFastagLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, billedToCustomer: true } : l)));
    showToast('Toll added to customer bill');
  };

  const rechargeFastag = (vehicleId: string, amount: number) => {
    setVehicles((prev) => prev.map((v) => (v.id === vehicleId ? { ...v, fastagBalance: v.fastagBalance + amount } : v)));
    showToast(`FASTag recharge of ₹${amount.toLocaleString('en-IN')} requested (simulated)`);
  };

  const addMaintenanceRecord = (rec: MaintenanceRecord) => {
    setMaintenanceLogs((prev) => [rec, ...prev]);
    setFinanceEntries((prev) => [
      { id: newId('FIN'), date: rec.date, category: 'Maintenance', direction: 'out', amount: rec.cost, vehicleId: rec.vehicleId, reference: rec.id },
      ...prev,
    ]);
    showToast('Maintenance record added');
  };

  const completeReminder = (reminderId: string) => {
    setMaintenanceReminders((prev) => prev.map((r) => (r.id === reminderId ? { ...r, status: 'Done' } : r)));
    showToast('Reminder marked as done');
  };

  // ---------- Staff & drivers ----------
  const addDriver = (driver: Driver) => setDrivers((prev) => [driver, ...prev]);
  const removeDriver = (id: string) => setDrivers((prev) => prev.filter((d) => d.id !== id));
  const addStaff = (staff: StaffPunch) => setStaffPunches((prev) => [staff, ...prev]);
  const updateStaff = (id: string, patch: Partial<StaffPunch>) => setStaffPunches((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeStaff = (id: string) => setStaffPunches((prev) => prev.filter((x) => x.id !== id));
  const updateDriver = (id: string, patch: Partial<Driver>) =>
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const assignDriverToBooking = (bookingId: string, driverId: string) => {
    const b = bookings.find((x) => x.id === bookingId);
    const d = drivers.find((x) => x.id === driverId);
    if (!b || !d) return;
    patchBooking(bookingId, { driverId });
    updateDriver(driverId, {
      assignments: [
        ...d.assignments,
        {
          id: newId('AS'),
          bookingId,
          vehicleNumber: b.vehicleNumber,
          date: b.pickupDate,
          status: b.status === 'Active' ? 'In progress' : 'Upcoming',
        },
      ],
      assignedVehicle: b.vehicleNumber,
      // Only an already-active rental puts the driver on a trip; upcoming ones keep the current duty status
      dutyStatus: b.status === 'Active' ? 'On Trip' : d.dutyStatus,
    });
    showToast(`${d.name} assigned to ${bookingId}`);
  };

  const toggleDutyPunch = (staffId: string) => {
    const p = staffPunches.find((x) => x.id === staffId);
    if (!p) return;
    const isOut = p.status === 'Punched Out';
    const now = nowLabel();
    setStaffPunches((prev) =>
      prev.map((x) =>
        x.id === staffId
          ? {
              ...x,
              status: isOut ? 'Punched In' : 'Punched Out',
              punchIn: isOut ? now : x.punchIn,
              punchOut: isOut ? undefined : now,
            }
          : x
      )
    );
    showToast(isOut ? `${p.staffName} punched in at ${now}` : `${p.staffName} punched out at ${now}`);
  };

  // ---------- Business features ----------
  const updateCommission = (code: string, patch: Partial<CustomerCodeCommission>) =>
    setCommissions((prev) => prev.map((c) => (c.code === code ? { ...c, ...patch } : c)));

  const addCommission = (c: CustomerCodeCommission) => {
    setCommissions((prev) => [c, ...prev]);
    showToast(`Customer code ${c.code} created`);
  };

  const toggleAutomation = (id: string) =>
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));

  const addCampaign = (c: Campaign) => {
    setCampaigns((prev) => [c, ...prev]);
    showToast(`Campaign "${c.name}" saved`);
  };

  const updateCampaign = (id: string, patch: Partial<Campaign>) =>
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  // ---------- Notifications ----------
  const markAllNotificationsRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));

  const toggleNotificationChannel = (type: NotificationChannelSetting['type'], channel: 'whatsapp' | 'sms') =>
    setNotificationSettings((prev) => prev.map((s) => (s.type === type ? { ...s, [channel]: !s[channel] } : s)));

  const sendTestMessage: AppContextType['sendTestMessage'] = (type, channel, recipient, preview) => {
    const id = newId('MSG');
    setMessageLog((prev) => [{ id, channel, type, recipient, preview, status: 'Queued', time: `Today, ${nowLabel()}` }, ...prev]);
    showToast(`${channel} test queued (simulated — nothing is sent)`);
    // Simulated delivery lifecycle
    setTimeout(() => setMessageLog((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'Sent' } : m))), 1200);
    setTimeout(() => setMessageLog((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'Delivered' } : m))), 2600);
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        toast,
        showToast,
        hideToast,
        today: TODAY,
        currentCustomerId: '',
        vehicles,
        selectedCategory,
        setSelectedCategory,
        updateVehicleStatus,
        updateVehicle,
        showVehicleChange,
        addVehicle,
        markVehicleSold,
        bookings,
        bookingDraft,
        setBookingDraft,
        createBooking,
        createQuote,
        confirmBooking,
        cancelBooking,
        signAgreement,
        recordInspection,
        completeRental,
        toggleKeylessUnlock,
        extendRental,
        customers,
        addCustomer,
        updateCustomer,
        showCustomer,
        agreements,
        inspections,
        addInspection,
        fastagLogs,
        billTollToCustomer,
        rechargeFastag,
        maintenanceLogs,
        addMaintenanceRecord,
        maintenanceReminders,
        completeReminder,
        drivers,
        updateDriver,
        addDriver,
        removeDriver,
        addStaff,
        updateStaff,
        removeStaff,
        assignDriverToBooking,
        staffPunches,
        toggleDutyPunch,
        commissions,
        updateCommission,
        addCommission,
        automations,
        toggleAutomation,
        campaigns,
        addCampaign,
        updateCampaign,
        loyaltyTiers,
        financeEntries,
        notifications,
        markAllNotificationsRead,
        notificationSettings,
        toggleNotificationChannel,
        messageLog,
        sendTestMessage,
      }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
