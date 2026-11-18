import { newId } from '../config/defaults';
import { serverDoc } from '../lib/serverState';
import { TODAY } from '../lib/today';

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

// ---------------------------------------------------------------- server documents

/** Clauses printed on every agreement; staff edit them in Rental Agreements → Terms. */
const termsDoc = serverDoc<{ version: number; clauses: TermClause[] }>('agreements.terms', {
  version: 1,
  clauses: [
    { id: 'tc-1', category: 'Returns', title: 'Return condition', body: 'The vehicle must be returned at the agreed date, time and location with the same fuel/charge level as at pickup.', required: true, active: true, updatedOn: '' },
    { id: 'tc-2', category: 'Charges', title: 'FASTag tolls', body: 'FASTag toll charges incurred during the rental are billed to the customer and may be deducted from the security deposit.', required: false, active: true, updatedOn: '' },
    { id: 'tc-3', category: 'Liability', title: 'Traffic violations', body: 'The customer is responsible for traffic violations and challans during the rental period.', required: true, active: true, updatedOn: '' },
    { id: 'tc-4', category: 'Usage', title: 'Permitted use', body: 'The vehicle must not be used for racing, towing, commercial ride-hailing or driven by anyone not listed on this agreement.', required: true, active: true, updatedOn: '' },
    { id: 'tc-5', category: 'Liability', title: 'Damage assessment', body: 'Damage beyond the pickup inspection record is assessed at return and charged as per the inspection report.', required: true, active: true, updatedOn: '' },
    { id: 'tc-6', category: 'Charges', title: 'Deposit refund', body: 'The security deposit is refunded within 48 hours of return after deducting applicable charges.', required: false, active: true, updatedOn: '' },
    { id: 'tc-7', category: 'Usage', title: 'Lawful driving', body: 'Speed limits and all applicable laws of India must be followed at all times.', required: false, active: true, updatedOn: '' },
  ],
});

/** Charges listed on every agreement. The server reads the same document when a customer signs in the app. */
const penaltiesDoc = serverDoc<PenaltyRule[]>('agreements.penalties', [
  { id: 'f1', label: 'Late return (per hour)', amount: 500, basis: 'Per hour', active: true },
  { id: 'f2', label: 'Smoking / deep cleaning', amount: 2000, basis: 'Flat', active: true },
  { id: 'f3', label: 'Lost key or key fob', amount: 5000, basis: 'Flat', active: true },
  { id: 'f4', label: 'Traffic challan admin fee (plus actual fine)', amount: 250, basis: 'Actual + fee', active: true },
]);

const discountRulesDoc = serverDoc<DiscountRule[]>('agreements.discountRules', [
  { id: 'dr-1', name: 'Weekly rental', kind: 'Percent', value: 10, appliesTo: 'Rentals of 7 days or more', active: true },
  { id: 'dr-2', name: 'Monthly rental', kind: 'Percent', value: 20, appliesTo: 'Rentals of 30 days or more', active: true },
]);

/** Money and paperwork recorded against agreements. */
interface Ledger {
  assessed: AssessedFine[];
  applied: AppliedDiscount[];
  deposits: DepositEntry[];
  esign: ESignRequest[];
  activity: AgreementActivity[];
}
const ledgerDoc = serverDoc<Ledger>('agreements.ledger', { assessed: [], applied: [], deposits: [], esign: [], activity: [] });

const ledger = () => ledgerDoc.get();
const saveLedger = (patch: Partial<Ledger>) => ledgerDoc.set({ ...ledger(), ...patch });
const withActivity = (agreementId: string, text: string): Pick<Ledger, 'activity'> => ({
  activity: [{ id: newId('ACT'), agreementId, date: TODAY, text }, ...ledger().activity],
});

// ---------------------------------------------------------------- Used synchronously by the signing screen

export const activeTerms = () => termsDoc.get().clauses.filter((t) => t.active);
export const activePenalties = () => penaltiesDoc.get().filter((p) => p.active);

// ---------------------------------------------------------------- Terms

const termsSnapshot = () => termsDoc.get();
export const loadTerms = async () => termsSnapshot();

const saveClauses = async (clauses: TermClause[]) => {
  await termsDoc.set({ version: termsDoc.get().version + 1, clauses });
  return termsSnapshot();
};

export const saveTerm = (input: Pick<TermClause, 'title' | 'body' | 'category' | 'required'>, id?: string) => {
  const clauses = termsDoc.get().clauses;
  return saveClauses(
    id
      ? clauses.map((t) => (t.id === id ? { ...t, ...input, active: input.required ? true : t.active, updatedOn: TODAY } : t))
      : [...clauses, { ...input, id: newId('tc'), active: true, updatedOn: TODAY }]
  );
};

export const setTermActive = (id: string, active: boolean) => saveClauses(termsDoc.get().clauses.map((t) => (t.id === id ? { ...t, active, updatedOn: TODAY } : t)));

export const removeTerm = (id: string) => saveClauses(termsDoc.get().clauses.filter((t) => t.id !== id));

// ---------------------------------------------------------------- Deposits & discounts

const moneySnapshot = () => ({ deposits: ledger().deposits, applied: ledger().applied, rules: discountRulesDoc.get() });
export const loadDepositsAndDiscounts = async () => moneySnapshot();

export const addDepositEntry = async (input: Omit<DepositEntry, 'id' | 'date'>) => {
  await saveLedger({
    deposits: [{ ...input, id: newId('DEP'), date: TODAY }, ...ledger().deposits],
    ...withActivity(input.agreementId, `Deposit ${input.kind.toLowerCase()} of ₹${input.amount.toLocaleString('en-IN')}: ${input.reason}`),
  });
  return moneySnapshot();
};

export const applyDiscount = async (input: Omit<AppliedDiscount, 'id' | 'date'>) => {
  await saveLedger({
    applied: [{ ...input, id: newId('DIS'), date: TODAY }, ...ledger().applied],
    ...withActivity(input.agreementId, `Discount of ₹${input.amount.toLocaleString('en-IN')} applied: ${input.reason}`),
  });
  return moneySnapshot();
};

export const removeAppliedDiscount = async (id: string) => {
  const d = ledger().applied.find((x) => x.id === id);
  await saveLedger({
    applied: ledger().applied.filter((x) => x.id !== id),
    ...(d ? withActivity(d.agreementId, `Discount of ₹${d.amount.toLocaleString('en-IN')} removed`) : {}),
  });
  return moneySnapshot();
};

export const saveDiscountRule = async (input: Omit<DiscountRule, 'id' | 'active'>, id?: string) => {
  const rules = discountRulesDoc.get();
  await discountRulesDoc.set(id ? rules.map((r) => (r.id === id ? { ...r, ...input } : r)) : [...rules, { ...input, id: newId('dr'), active: true }]);
  return moneySnapshot();
};

export const setDiscountRuleActive = async (id: string, active: boolean) => {
  await discountRulesDoc.set(discountRulesDoc.get().map((r) => (r.id === id ? { ...r, active } : r)));
  return moneySnapshot();
};

export const removeDiscountRule = async (id: string) => {
  await discountRulesDoc.set(discountRulesDoc.get().filter((r) => r.id !== id));
  return moneySnapshot();
};

// ---------------------------------------------------------------- Fines

const finesSnapshot = () => ({ rules: penaltiesDoc.get(), assessed: ledger().assessed });
export const loadFines = async () => finesSnapshot();

export const savePenalty = async (input: Pick<PenaltyRule, 'label' | 'amount' | 'basis'>, id?: string) => {
  const rules = penaltiesDoc.get();
  await penaltiesDoc.set(id ? rules.map((p) => (p.id === id ? { ...p, ...input } : p)) : [...rules, { ...input, id: newId('f'), active: true }]);
  return finesSnapshot();
};

export const setPenaltyActive = async (id: string, active: boolean) => {
  await penaltiesDoc.set(penaltiesDoc.get().map((p) => (p.id === id ? { ...p, active } : p)));
  return finesSnapshot();
};

export const removePenalty = async (id: string) => {
  await penaltiesDoc.set(penaltiesDoc.get().filter((p) => p.id !== id));
  return finesSnapshot();
};

export const assessFine = async (input: Pick<AssessedFine, 'agreementId' | 'label' | 'amount' | 'note'>) => {
  await saveLedger({
    assessed: [{ ...input, id: newId('FA'), date: TODAY, status: 'Pending' }, ...ledger().assessed],
    ...withActivity(input.agreementId, `Fine assessed: ${input.label}, ₹${input.amount.toLocaleString('en-IN')}`),
  });
  return finesSnapshot();
};

export const setFineStatus = async (id: string, status: FineStatus) => {
  const f = ledger().assessed.find((x) => x.id === id);
  await saveLedger({
    assessed: ledger().assessed.map((x) => (x.id === id ? { ...x, status } : x)),
    ...(f ? withActivity(f.agreementId, `Fine "${f.label}" marked ${status.toLowerCase()}`) : {}),
  });
  return finesSnapshot();
};

// ---------------------------------------------------------------- Details: e-signature and activity

const detailSnapshot = () => {
  const l = ledger();
  return { esign: l.esign, activity: l.activity, deposits: l.deposits, applied: l.applied, assessed: l.assessed };
};
export const loadAgreementDetail = async () => detailSnapshot();

export const sendForESign = async (input: Pick<ESignRequest, 'agreementId' | 'channel' | 'recipient'>) => {
  await saveLedger({
    esign: [...ledger().esign.filter((e) => e.agreementId !== input.agreementId), { ...input, status: 'Sent', sentOn: TODAY }],
    ...withActivity(input.agreementId, `E-signature request sent by ${input.channel} to ${input.recipient}`),
  });
  return detailSnapshot();
};

export const setESignStatus = async (agreementId: string, status: ESignStatus) => {
  await saveLedger({
    esign: ledger().esign.map((e) => (e.agreementId === agreementId ? { ...e, status } : e)),
    ...withActivity(agreementId, `E-signature request marked ${status.toLowerCase()}`),
  });
  return detailSnapshot();
};

export const logAgreementActivity = async (agreementId: string, text: string) => {
  await saveLedger(withActivity(agreementId, text));
  return detailSnapshot();
};
