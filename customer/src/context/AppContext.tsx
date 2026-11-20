import React, { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import {
  Vehicle,
  Booking,
  Customer,
  Agreement,
  AgreementFine,
  InspectionRecord,
  FASTagLog,
  NotificationItem,
  LoyaltyRewardTier,
  RentalTerm,
  RentalPurpose,
  BookingClassification,
} from '../types';
import { api } from '../lib/api';
import { computeQuote } from '../lib/pricing';
import { addDays, daysBetween } from '../lib/format';
import { TODAY } from '../lib/today';
import type { Workspace } from '../services/workspace';

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
  pickupLocation: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  term: RentalTerm;
  purpose: RentalPurpose;
  classification: BookingClassification;
}

export interface SignAgreementInput {
  signaturePath: string;
  signedBy: string;
}

interface ToastState {
  visible: boolean;
  message: string;
}

interface AppContextType {
  toast: ToastState;
  showToast: (msg: string) => void;
  hideToast: () => void;
  today: string;
  /** The signed-in customer. */
  currentCustomerId: string;

  // Fleet
  vehicles: Vehicle[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;

  // Bookings
  bookings: Booking[];
  bookingDraft: BookingDraft;
  setBookingDraft: React.Dispatch<React.SetStateAction<BookingDraft>>;
  createQuote: (input: QuoteInput) => Booking;
  confirmBooking: (bookingId: string) => void;
  cancelBooking: (bookingId: string) => void;
  /** Records a payment (online gateway pending): the deposit confirms a quote, the balance settles a confirmed booking. */
  payBooking: (bookingId: string) => void;
  signAgreement: (bookingId: string, input: SignAgreementInput) => Agreement;
  toggleKeylessUnlock: (bookingId: string) => void;
  extendRental: (bookingId: string, extraDays: number) => void;

  // Account
  customers: Customer[];
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  addCustomer: (customer: Customer) => void;
  loyaltyTiers: LoyaltyRewardTier[];

  // Rental records
  agreements: Agreement[];
  /** Charges listed on every agreement, as set by KeyGo. */
  standardFines: AgreementFine[];
  inspections: InspectionRecord[];
  fastagLogs: FASTagLog[];

  // Notifications
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const defaultDraft: BookingDraft = {
  pickupLocation: '',
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

/** Booking or agreement number chosen in the app, e.g. "KG-LQ3X9A2B7", accepted by the server as the record's id. */
const newNumber = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0')}`;

/** State that changes immediately on screen and is replaced by the server's answer (or undone if it refuses). */
function useServerList<T>(initial: T[]) {
  const [items, setItems] = useState<T[]>(initial);
  const ref = useRef(items);
  const set = useCallback((update: T[] | ((prev: T[]) => T[])) => {
    const next = typeof update === 'function' ? (update as (p: T[]) => T[])(ref.current) : update;
    ref.current = next;
    setItems(next);
  }, []);
  return [items, set, ref] as const;
}

/**
 * The signed-in customer's data, loaded from the KeyGo server. Every action changes the screen at once and is
 * then sent to the server, which works out prices and checks availability. If the server refuses (for example
 * the car was just booked by someone else), the change is undone and the reason is shown.
 */
export const AppProvider: React.FC<{ children: ReactNode; seed: Workspace }> = ({ children, seed }) => {
  const customerId = seed.customer.id;
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '' });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [vehicles, setVehicles, vehiclesRef] = useServerList<Vehicle>(seed.vehicles);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [bookings, setBookings, bookingsRef] = useServerList<Booking>(seed.bookings);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(defaultDraft);
  const [customers, setCustomers, customersRef] = useServerList<Customer>([seed.customer]);
  const [agreements, setAgreements] = useServerList<Agreement>(seed.agreements);
  const [notifications, setNotifications] = useServerList<NotificationItem>(seed.notifications);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message });
    toastTimer.current = setTimeout(() => setToast({ visible: false, message: '' }), 3200);
  }, []);

  const hideToast = () => setToast({ visible: false, message: '' });

  // Server calls for one booking run one after another (a quote must exist before it is confirmed)
  const queues = useRef(new Map<string, Promise<unknown>>());
  const enqueue = <T,>(key: string, task: () => Promise<T>): Promise<T> => {
    const next = (queues.current.get(key) ?? Promise.resolve()).catch(() => undefined).then(task);
    queues.current.set(key, next);
    return next;
  };

  const findBooking = (id: string) => bookingsRef.current.find((b) => b.id === id);
  const patchBooking = (id: string, patch: Partial<Booking>) => setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const putBooking = (id: string, saved: Booking) => setBookings((prev) => prev.map((b) => (b.id === id ? saved : b)));
  const vehicleStatus = (id: string) => vehiclesRef.current.find((v) => v.id === id)?.status;
  const setVehicleStatus = (id: string, status: Vehicle['status'] | undefined) => {
    if (status) setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
  };

  /** Sends a booking action; on success the server's booking replaces the local one, on failure `undo` runs. */
  const sendBookingAction = (bookingId: string, path: string, body: unknown, undo: () => void) => {
    enqueue(bookingId, () => api<Booking>(`/me/bookings/${encodeURIComponent(bookingId)}${path}`, { method: 'POST', body }))
      .then((saved) => putBooking(bookingId, saved))
      .catch((e: Error) => {
        undo();
        showToast(e.message);
      });
  };

  // ---------- Bookings ----------
  const createQuote = (input: QuoteInput): Booking => {
    const vehicle = vehiclesRef.current.find((v) => v.id === input.vehicleId) ?? vehiclesRef.current[0];
    const customer = customersRef.current[0];
    const days = Math.max(1, daysBetween(input.pickupDate, input.returnDate) || 1);
    const q = computeQuote(vehicle, days, input.term, 0);
    const booking: Booking = {
      id: newNumber('KG'),
      customerId,
      customerName: customer?.name ?? '',
      customerPhone: customer?.phone ?? '',
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
      baseRatePerDay: q.ratePerDay,
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
    };
    setBookings((prev) => [booking, ...prev]);
    enqueue(booking.id, () =>
      api<Booking>('/me/bookings', {
        method: 'POST',
        body: {
          id: booking.id,
          vehicleId: booking.vehicleId,
          pickupLocation: booking.pickupLocation,
          pickupDate: booking.pickupDate,
          pickupTime: booking.pickupTime,
          returnDate: booking.returnDate,
          returnTime: booking.returnTime,
          term: booking.term,
          purpose: booking.purpose,
        },
      })
    )
      .then((saved) => putBooking(booking.id, saved))
      .catch((e: Error) => {
        setBookings((prev) => prev.filter((b) => b.id !== booking.id));
        showToast(e.message);
      });
    showToast(`Quote ${booking.id} generated`);
    return booking;
  };

  const confirmBooking = (bookingId: string) => {
    const b = findBooking(bookingId);
    if (!b) return;
    const previousStatus = vehicleStatus(b.vehicleId);
    patchBooking(bookingId, {
      status: 'Confirmed',
      paymentStatus: b.paymentStatus === 'Unpaid' ? 'Deposit paid' : b.paymentStatus,
      reminderScheduledFor: addDays(b.pickupDate, -2),
    });
    // Like the server: a confirmed booking holds the car only from its pickup day
    if (previousStatus === 'Available' && b.pickupDate <= TODAY) setVehicleStatus(b.vehicleId, 'Reserved');
    sendBookingAction(bookingId, '/confirm', undefined, () => {
      putBooking(bookingId, b);
      setVehicleStatus(b.vehicleId, previousStatus);
    });
    showToast(`Booking ${bookingId} confirmed · reminder scheduled`);
  };

  const cancelBooking = (bookingId: string) => {
    const b = findBooking(bookingId);
    if (!b) return;
    const previousStatus = vehicleStatus(b.vehicleId);
    patchBooking(bookingId, { status: 'Cancelled' });
    const stillHeld = bookingsRef.current.some((x) => x.id !== bookingId && x.vehicleId === b.vehicleId && (x.status === 'Confirmed' || x.status === 'Active'));
    if (!stillHeld && previousStatus === 'Reserved') setVehicleStatus(b.vehicleId, 'Available');
    sendBookingAction(bookingId, '/cancel', undefined, () => {
      putBooking(bookingId, b);
      setVehicleStatus(b.vehicleId, previousStatus);
    });
    showToast(`Booking ${bookingId} cancelled`);
  };

  const payBooking = (bookingId: string) => {
    const b = findBooking(bookingId);
    if (!b) return;
    if (b.paymentStatus === 'Unpaid') {
      confirmBooking(bookingId);
      return;
    }
    patchBooking(bookingId, { paymentStatus: 'Paid' });
    sendBookingAction(bookingId, '/pay', undefined, () => putBooking(bookingId, b));
  };

  const signAgreement = (bookingId: string, input: SignAgreementInput): Agreement => {
    const b = findBooking(bookingId)!;
    const agreement: Agreement = {
      id: newNumber(`AGR-${TODAY.slice(0, 4)}`),
      bookingId,
      customerName: b.customerName,
      vehicleNumber: b.vehicleNumber,
      signedDate: TODAY,
      status: 'Active',
      depositTermsAccepted: true,
      signaturePreview: `${input.signedBy} (Digitally Signed)`,
      signaturePath: input.signaturePath,
      rentalAmount: b.totalAmount,
      securityDeposit: b.depositAmount,
      discount: b.discount,
      fines: seed.standardFines,
    };
    setAgreements((prev) => [agreement, ...prev]);
    patchBooking(bookingId, { agreementId: agreement.id });
    enqueue(bookingId, () =>
      api<{ agreement: Agreement; booking: Booking }>(`/me/bookings/${encodeURIComponent(bookingId)}/agreement`, {
        method: 'POST',
        body: { id: agreement.id, signaturePath: input.signaturePath, signedBy: input.signedBy },
      })
    )
      .then((res) => {
        setAgreements((prev) => prev.map((a) => (a.id === agreement.id ? res.agreement : a)));
        putBooking(bookingId, res.booking);
      })
      .catch((e: Error) => {
        setAgreements((prev) => prev.filter((a) => a.id !== agreement.id));
        putBooking(bookingId, b);
        showToast(e.message);
      });
    showToast(`Agreement ${agreement.id} signed`);
    return agreement;
  };

  const toggleKeylessUnlock = (bookingId: string) => {
    const b = findBooking(bookingId);
    if (!b) return;
    const next = !b.keylessUnlocked;
    patchBooking(bookingId, { keylessUnlocked: next });
    sendBookingAction(bookingId, '/keyless', undefined, () => putBooking(bookingId, b));
    showToast(next ? 'Car unlocked · digital key active' : 'Car locked');
  };

  const extendRental = (bookingId: string, extraDays: number) => {
    const b = findBooking(bookingId);
    if (!b) return;
    const days = b.days + extraDays;
    const vehicle = vehiclesRef.current.find((v) => v.id === b.vehicleId) ?? vehiclesRef.current[0];
    const q = computeQuote(vehicle, days, b.term, 0);
    patchBooking(bookingId, { days, returnDate: addDays(b.returnDate, extraDays), subtotal: q.subtotal, tax: q.tax, totalAmount: q.total });
    sendBookingAction(bookingId, '/extend', { extraDays }, () => putBooking(bookingId, b));
    showToast(`Extension requested · new return ${addDays(b.returnDate, extraDays)}`);
  };

  // ---------- Account ----------
  const updateCustomer = (id: string, patch: Partial<Customer>) => {
    const before = customersRef.current.find((c) => c.id === id);
    if (!before) return;
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        next.name = `${next.firstName} ${next.lastName}`.trim();
        return next;
      })
    );
    enqueue('me', () => api<Customer>('/me', { method: 'PATCH', body: patch }))
      .then((saved) => setCustomers((prev) => prev.map((c) => (c.id === id ? saved : c))))
      .catch((e: Error) => {
        setCustomers((prev) => prev.map((c) => (c.id === id ? before : c)));
        showToast(e.message);
      });
  };

  const addCustomer = (customer: Customer) =>
    setCustomers((prev) => (prev.some((c) => c.id === customer.id) ? prev : [customer, ...prev]));

  // ---------- Notifications ----------
  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    api(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }).catch(() => undefined);
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => (n.customerId === customerId ? { ...n, unread: false } : n)));
    api('/me/notifications/read-all', { method: 'POST' }).catch(() => undefined);
  };

  return (
    <AppContext.Provider
      value={{
        toast,
        showToast,
        hideToast,
        today: TODAY,
        currentCustomerId: customerId,
        vehicles,
        selectedCategory,
        setSelectedCategory,
        bookings,
        bookingDraft,
        setBookingDraft,
        createQuote,
        confirmBooking,
        cancelBooking,
        payBooking,
        signAgreement,
        toggleKeylessUnlock,
        extendRental,
        customers,
        updateCustomer,
        addCustomer,
        loyaltyTiers: seed.loyaltyTiers,
        agreements,
        standardFines: seed.standardFines,
        inspections: seed.inspections,
        fastagLogs: seed.fastagLogs,
        notifications,
        markNotificationRead,
        markAllNotificationsRead,
      }}>
      {children}
    </AppContext.Provider>
  );
};

/** Before sign-in: no customer data, only toasts and dates for the sign-in screens. */
export const SignedOutProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AppProvider
    seed={{
      customer: { id: '', name: '', firstName: '', lastName: '', dob: '', phone: '', email: '', address: '', city: '', aadhaarNo: '', idCardStatus: 'Not uploaded', faceVerification: 'Not uploaded', photoCaptured: false, dlNumber: '', dlState: '', dlExpiry: '', careOfName: '', careOfRelation: '', careOfPhone: '', customerCode: '', documents: [], customerSince: TODAY, loyaltyTier: 'Bronze', loyaltyPoints: 0, avatarBg: '#DCE8DE', trustRating: 0 },
      vehicles: [],
      bookings: [],
      agreements: [],
      inspections: [],
      fastagLogs: [],
      notifications: [],
      loyaltyTiers: [],
      standardFines: [],
    }}>
    {children}
  </AppProvider>
);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
