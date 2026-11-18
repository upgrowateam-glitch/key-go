import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import {
  Vehicle,
  Booking,
  Customer,
  Agreement,
  InspectionRecord,
  FASTagLog,
  NotificationItem,
  LoyaltyRewardTier,
  RentalTerm,
  RentalPurpose,
  BookingClassification,
} from '../types';
import { DEMO_TODAY } from '../data/mockData';
import type { Workspace } from '../services/workspace';
import { computeQuote } from '../lib/pricing';
import { addDays, daysBetween } from '../lib/format';

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
  /** Records a simulated payment: the deposit confirms a quote, the balance settles a confirmed booking. */
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
  inspections: InspectionRecord[];
  fastagLogs: FASTagLog[];

  // Notifications
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const defaultDraft: BookingDraft = {
  pickupLocation: 'Bengaluru International Airport (BLR)',
  pickupDate: addDays(DEMO_TODAY, 3),
  pickupTime: '10:00 AM',
  returnDate: addDays(DEMO_TODAY, 6),
  returnTime: '06:00 PM',
  vehicleType: 'All',
  term: 'Daily',
  purpose: 'Personal',
  days: 3,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode; seed: Workspace; customerId: string }> = ({ children, seed, customerId }) => {
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '' });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>(seed.vehicles);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [bookings, setBookings] = useState<Booking[]>(seed.bookings);
  // Latest bookings, including ones created earlier in the same event handler (e.g. quote → confirm)
  const bookingsRef = useRef(bookings);
  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(defaultDraft);
  const [customers, setCustomers] = useState<Customer[]>(seed.customers);
  const [agreements, setAgreements] = useState<Agreement[]>(seed.agreements);
  const [notifications, setNotifications] = useState<NotificationItem[]>(seed.notifications);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message });
    toastTimer.current = setTimeout(() => setToast({ visible: false, message: '' }), 2800);
  }, []);

  const hideToast = () => setToast({ visible: false, message: '' });

  const patchBooking = (id: string, patch: Partial<Booking>) =>
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const setVehicleStatus = (id: string, status: Vehicle['status']) =>
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));

  // ---------- Bookings ----------
  const createQuote = (input: QuoteInput): Booking => {
    const vehicle = vehicles.find((v) => v.id === input.vehicleId) ?? vehicles[0];
    const customer = customers.find((c) => c.id === (input.customerId ?? customerId));
    const days = Math.max(1, daysBetween(input.pickupDate, input.returnDate) || 1);
    const q = computeQuote(vehicle, days, input.term, 0);
    const booking: Booking = {
      id: `KG-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: customer?.id,
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
      baseRatePerDay: vehicle.pricePerDay,
      subtotal: q.subtotal,
      discount: q.manualDiscount + q.termDiscount,
      tax: q.tax,
      totalAmount: q.total,
      depositAmount: q.deposit,
      status: 'Quoted',
      paymentStatus: 'Unpaid',
      createdAt: DEMO_TODAY,
      reminderScheduledFor: addDays(input.pickupDate, -2),
      reminderSent: false,
    };
    bookingsRef.current = [booking, ...bookingsRef.current];
    setBookings((prev) => [booking, ...prev]);
    showToast(`Quote ${booking.id} generated`);
    return booking;
  };

  const confirmBooking = (bookingId: string) => {
    const b = bookingsRef.current.find((x) => x.id === bookingId);
    if (!b) return;
    patchBooking(bookingId, {
      status: 'Confirmed',
      paymentStatus: b.paymentStatus === 'Unpaid' ? 'Deposit paid' : b.paymentStatus,
      reminderScheduledFor: addDays(b.pickupDate, -2),
    });
    setVehicleStatus(b.vehicleId, 'Reserved');
    showToast(`Booking ${bookingId} confirmed · reminder scheduled`);
  };

  const cancelBooking = (bookingId: string) => {
    const b = bookingsRef.current.find((x) => x.id === bookingId);
    if (!b) return;
    patchBooking(bookingId, { status: 'Cancelled' });
    const stillHeld = bookingsRef.current.some((x) => x.id !== bookingId && x.vehicleId === b.vehicleId && (x.status === 'Confirmed' || x.status === 'Active'));
    if (!stillHeld) setVehicleStatus(b.vehicleId, 'Available');
    showToast(`Booking ${bookingId} cancelled`);
  };

  const payBooking = (bookingId: string) => {
    const b = bookingsRef.current.find((x) => x.id === bookingId);
    if (!b) return;
    if (b.paymentStatus === 'Unpaid') confirmBooking(bookingId);
    else patchBooking(bookingId, { paymentStatus: 'Paid' });
  };

  const signAgreement = (bookingId: string, input: SignAgreementInput): Agreement => {
    const b = bookings.find((x) => x.id === bookingId)!;
    const agreement: Agreement = {
      id: `AGR-2026-${Math.floor(100 + Math.random() * 900)}`,
      bookingId,
      customerName: b.customerName,
      vehicleNumber: b.vehicleNumber,
      signedDate: DEMO_TODAY,
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
    showToast(`Agreement ${agreement.id} signed`);
    return agreement;
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

  // ---------- Account ----------
  const updateCustomer = (id: string, patch: Partial<Customer>) =>
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        next.name = `${next.firstName} ${next.lastName}`.trim();
        return next;
      })
    );

  const addCustomer = (customer: Customer) =>
    setCustomers((prev) => (prev.some((c) => c.id === customer.id) ? prev : [customer, ...prev]));

  // ---------- Notifications ----------
  const markNotificationRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));

  const markAllNotificationsRead = () =>
    setNotifications((prev) => prev.map((n) => (n.customerId === customerId ? { ...n, unread: false } : n)));

  return (
    <AppContext.Provider
      value={{
        toast,
        showToast,
        hideToast,
        today: DEMO_TODAY,
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

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
