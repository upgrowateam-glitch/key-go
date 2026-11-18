import { mockRequest } from './mockClient';
import { DEMO_TODAY } from '../data/mockData';

export type TermCategory = 'Usage' | 'Charges' | 'Liability' | 'Returns';
export interface TermClause {
  id: string;
  title: string;
  body: string;
  category: TermCategory;
  /** Required clauses cannot be switched off or deleted. */
  required: boolean;
  active: boolean;
  updatedOn: string;
}

export type PenaltyBasis = 'Flat' | 'Per hour' | 'Per day' | 'Actual + fee';
export interface PenaltyRule {
  id: string;
  label: string;
  amount: number;
  basis: PenaltyBasis;
  active: boolean;
}

export type FineStatus = 'Pending' | 'Collected' | 'Waived';
export interface AssessedFine {
  id: string;
  agreementId: string;
  label: string;
  amount: number;
  date: string;
  status: FineStatus;
  note?: string;
}

export interface DiscountRule {
  id: string;
  name: string;
  kind: 'Percent' | 'Flat';
  value: number;
  appliesTo: string;
  active: boolean;
}

export interface AppliedDiscount {
  id: string;
  agreementId: string;
  amount: number;
  reason: string;
  date: string;
}

export interface DepositEntry {
  id: string;
  agreementId: string;
  kind: 'Deduction' | 'Refund';
  amount: number;
  reason: string;
  date: string;
}

export type ESignStatus = 'Sent' | 'Viewed' | 'Signed';
export interface ESignRequest {
  agreementId: string;
  status: ESignStatus;
  channel: string;
  recipient: string;
  sentOn: string;
}

export interface AgreementActivity {
  id: string;
  agreementId: string;
  date: string;
  text: string;
}

// Mock server state: survives tab switches, resets on reload.
let termsVersion = 3;
let terms: TermClause[] = [
  { id: 'tc-1', category: 'Returns', title: 'Return condition', body: 'The vehicle must be returned at the agreed date, time and location with the same fuel/charge level as at pickup.', required: true, active: true, updatedOn: '2026-06-02' },
  { id: 'tc-2', category: 'Charges', title: 'FASTag tolls', body: 'FASTag toll charges incurred during the rental are billed to the customer and may be deducted from the security deposit.', required: false, active: true, updatedOn: '2026-06-02' },
  { id: 'tc-3', category: 'Liability', title: 'Traffic violations', body: 'The customer is responsible for traffic violations and challans during the rental period.', required: true, active: true, updatedOn: '2026-06-02' },
  { id: 'tc-4', category: 'Usage', title: 'Permitted use', body: 'The vehicle must not be used for racing, towing, commercial ride-hailing or driven by anyone not listed on this agreement.', required: true, active: true, updatedOn: '2026-06-02' },
  { id: 'tc-5', category: 'Liability', title: 'Damage assessment', body: 'Damage beyond the pickup inspection record is assessed at return and charged as per the inspection report.', required: true, active: true, updatedOn: '2026-06-02' },
  { id: 'tc-6', category: 'Charges', title: 'Deposit refund', body: 'The security deposit is refunded within 48 hours of return after deducting applicable charges.', required: false, active: true, updatedOn: '2026-08-19' },
  { id: 'tc-7', category: 'Usage', title: 'Lawful driving', body: 'Speed limits and all applicable laws of India must be followed at all times.', required: false, active: true, updatedOn: '2026-06-02' },
];

let penalties: PenaltyRule[] = [
  { id: 'f1', label: 'Late return (per hour)', amount: 500, basis: 'Per hour', active: true },
  { id: 'f2', label: 'Smoking / deep cleaning', amount: 2000, basis: 'Flat', active: true },
  { id: 'f3', label: 'Lost key or key fob', amount: 5000, basis: 'Flat', active: true },
  { id: 'f4', label: 'Traffic challan admin fee (plus actual fine)', amount: 250, basis: 'Actual + fee', active: true },
];

let assessed: AssessedFine[] = [
  { id: 'FA-102', agreementId: 'AGR-2026-002', label: 'Late return (per hour)', amount: 1500, date: '2026-09-25', status: 'Pending', note: '3 hours past the agreed return time so far' },
  { id: 'FA-101', agreementId: 'AGR-2026-000', label: 'Smoking / deep cleaning', amount: 2000, date: '2026-09-15', status: 'Waived', note: 'Waived after the cabin passed inspection' },
];

let discountRules: DiscountRule[] = [
  { id: 'dr-1', name: 'Weekly rental', kind: 'Percent', value: 10, appliesTo: 'Rentals of 7 days or more', active: true },
  { id: 'dr-2', name: 'Monthly rental', kind: 'Percent', value: 20, appliesTo: 'Rentals of 30 days or more', active: true },
  { id: 'dr-3', name: 'Corporate goodwill', kind: 'Flat', value: 1000, appliesTo: 'Corporate accounts', active: false },
];

let applied: AppliedDiscount[] = [];

let deposits: DepositEntry[] = [
  { id: 'DEP-11', agreementId: 'AGR-2026-000', kind: 'Deduction', amount: 340, reason: 'FASTag toll charges', date: '2026-09-15' },
  { id: 'DEP-12', agreementId: 'AGR-2026-000', kind: 'Refund', amount: 4660, reason: 'Balance refunded at settlement', date: '2026-09-16' },
];

let esign: ESignRequest[] = [];
let activity: AgreementActivity[] = [];

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;

const log = (agreementId: string, text: string) => {
  activity = [{ id: newId('ACT') + activity.length, agreementId, date: DEMO_TODAY, text }, ...activity];
};

// ---------------------------------------------------------------- Used synchronously by the signing screen

export const activeTerms = () => terms.filter((t) => t.active);
export const activePenalties = () => penalties.filter((p) => p.active);

// ---------------------------------------------------------------- Terms

const termsSnapshot = () => ({ clauses: terms, version: termsVersion });
export const loadTerms = () => mockRequest(termsSnapshot);

export const saveTerm = (input: Pick<TermClause, 'title' | 'body' | 'category' | 'required'>, id?: string) =>
  mockRequest(() => {
    termsVersion += 1;
    terms = id
      ? terms.map((t) => (t.id === id ? { ...t, ...input, active: input.required ? true : t.active, updatedOn: DEMO_TODAY } : t))
      : [...terms, { ...input, id: newId('tc'), active: true, updatedOn: DEMO_TODAY }];
    return termsSnapshot();
  });

export const setTermActive = (id: string, active: boolean) =>
  mockRequest(() => {
    termsVersion += 1;
    terms = terms.map((t) => (t.id === id ? { ...t, active, updatedOn: DEMO_TODAY } : t));
    return termsSnapshot();
  });

export const removeTerm = (id: string) =>
  mockRequest(() => {
    termsVersion += 1;
    terms = terms.filter((t) => t.id !== id);
    return termsSnapshot();
  });

// ---------------------------------------------------------------- Deposits & discounts

const moneySnapshot = () => ({ deposits, applied, rules: discountRules });
export const loadDepositsAndDiscounts = () => mockRequest(moneySnapshot);

export const addDepositEntry = (input: Omit<DepositEntry, 'id' | 'date'>) =>
  mockRequest(() => {
    deposits = [{ ...input, id: newId('DEP'), date: DEMO_TODAY }, ...deposits];
    log(input.agreementId, `Deposit ${input.kind.toLowerCase()} of ₹${input.amount.toLocaleString('en-IN')}: ${input.reason}`);
    return moneySnapshot();
  });

export const applyDiscount = (input: Omit<AppliedDiscount, 'id' | 'date'>) =>
  mockRequest(() => {
    applied = [{ ...input, id: newId('DIS'), date: DEMO_TODAY }, ...applied];
    log(input.agreementId, `Discount of ₹${input.amount.toLocaleString('en-IN')} applied: ${input.reason}`);
    return moneySnapshot();
  });

export const removeAppliedDiscount = (id: string) =>
  mockRequest(() => {
    const d = applied.find((x) => x.id === id);
    applied = applied.filter((x) => x.id !== id);
    if (d) log(d.agreementId, `Discount of ₹${d.amount.toLocaleString('en-IN')} removed`);
    return moneySnapshot();
  });

export const saveDiscountRule = (input: Omit<DiscountRule, 'id' | 'active'>, id?: string) =>
  mockRequest(() => {
    discountRules = id ? discountRules.map((r) => (r.id === id ? { ...r, ...input } : r)) : [...discountRules, { ...input, id: newId('dr'), active: true }];
    return moneySnapshot();
  });

export const setDiscountRuleActive = (id: string, active: boolean) =>
  mockRequest(() => {
    discountRules = discountRules.map((r) => (r.id === id ? { ...r, active } : r));
    return moneySnapshot();
  });

export const removeDiscountRule = (id: string) =>
  mockRequest(() => {
    discountRules = discountRules.filter((r) => r.id !== id);
    return moneySnapshot();
  });

// ---------------------------------------------------------------- Fines

const finesSnapshot = () => ({ rules: penalties, assessed });
export const loadFines = () => mockRequest(finesSnapshot);

export const savePenalty = (input: Pick<PenaltyRule, 'label' | 'amount' | 'basis'>, id?: string) =>
  mockRequest(() => {
    penalties = id ? penalties.map((p) => (p.id === id ? { ...p, ...input } : p)) : [...penalties, { ...input, id: newId('f'), active: true }];
    return finesSnapshot();
  });

export const setPenaltyActive = (id: string, active: boolean) =>
  mockRequest(() => {
    penalties = penalties.map((p) => (p.id === id ? { ...p, active } : p));
    return finesSnapshot();
  });

export const removePenalty = (id: string) =>
  mockRequest(() => {
    penalties = penalties.filter((p) => p.id !== id);
    return finesSnapshot();
  });

export const assessFine = (input: Pick<AssessedFine, 'agreementId' | 'label' | 'amount' | 'note'>) =>
  mockRequest(() => {
    assessed = [{ ...input, id: newId('FA'), date: DEMO_TODAY, status: 'Pending' }, ...assessed];
    log(input.agreementId, `Fine assessed: ${input.label}, ₹${input.amount.toLocaleString('en-IN')}`);
    return finesSnapshot();
  });

export const setFineStatus = (id: string, status: FineStatus) =>
  mockRequest(() => {
    const f = assessed.find((x) => x.id === id);
    assessed = assessed.map((x) => (x.id === id ? { ...x, status } : x));
    if (f) log(f.agreementId, `Fine "${f.label}" marked ${status.toLowerCase()}`);
    return finesSnapshot();
  });

// ---------------------------------------------------------------- Details: e-signature and activity

const detailSnapshot = () => ({ esign, activity, deposits, applied, assessed });
export const loadAgreementDetail = () => mockRequest(detailSnapshot);

export const sendForESign = (input: Pick<ESignRequest, 'agreementId' | 'channel' | 'recipient'>) =>
  mockRequest(() => {
    esign = [...esign.filter((e) => e.agreementId !== input.agreementId), { ...input, status: 'Sent', sentOn: DEMO_TODAY }];
    log(input.agreementId, `E-signature request sent by ${input.channel} to ${input.recipient}`);
    return detailSnapshot();
  });

export const setESignStatus = (agreementId: string, status: ESignStatus) =>
  mockRequest(() => {
    esign = esign.map((e) => (e.agreementId === agreementId ? { ...e, status } : e));
    log(agreementId, `E-signature request marked ${status.toLowerCase()}`);
    return detailSnapshot();
  });

export const logAgreementActivity = (agreementId: string, text: string) =>
  mockRequest(() => {
    log(agreementId, text);
    return detailSnapshot();
  });
