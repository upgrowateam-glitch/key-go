import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDate } from '../../lib/format';
import { billManualToll, isManualToll, loadManualTolls } from '../../services/fastag';
import { useResource } from '../../services/mockClient';
import type { FASTagLog } from '../../types';

export const LOW_BALANCE = 500;
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type BillingState = 'Billed' | 'Unbilled' | 'Company';
export const billingState = (l: FASTagLog): BillingState => (!l.bookingId ? 'Company' : l.billedToCustomer ? 'Billed' : 'Unbilled');
export const logDateLabel = (l: FASTagLog) => `${formatDate(l.dateTime.slice(0, 10), false)} · ${l.dateTime.slice(11)}`;
export const sumTolls = (ls: FASTagLog[]) => ls.reduce((s, l) => s + l.amount, 0);
export const monthLabel = (ym: string) => `${MONTHS[parseInt(ym.slice(5, 7), 10) - 1]} ${ym.slice(0, 4)}`;

/** Toll entries from the workspace plus the ones added by hand, and billing that works for both. */
export function useTolls() {
  const { fastagLogs, billTollToCustomer, showToast } = useApp();
  const manual = useResource(loadManualTolls);
  const logs = useMemo(() => [...(manual.data ?? []), ...fastagLogs], [manual.data, fastagLogs]);
  const bill = (id: string) => {
    if (!isManualToll(id)) {
      billTollToCustomer(id);
      return;
    }
    billManualToll(id).then(
      (d) => {
        manual.setData(d);
        showToast('Toll added to customer bill');
      },
      (e: Error) => showToast(e.message)
    );
  };
  return { logs, bill, manual };
}
