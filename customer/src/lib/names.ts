import type { Customer } from '../types';

/** The name to greet a customer by: their nickname if they set one in Profile, otherwise their first name. */
export function callName(c?: Pick<Customer, 'firstName' | 'nickname'> | null): string {
  return c?.nickname?.trim() || c?.firstName?.trim() || '';
}

/** "Good morning" (5:00–11:59), "Good afternoon" (12:00–16:59) or "Good evening" (17:00–4:59), by the phone's clock. */
export function greetingAt(d: Date): { text: string; part: 'morning' | 'afternoon' | 'evening' } {
  const h = d.getHours();
  if (h >= 5 && h < 12) return { text: 'Good morning', part: 'morning' };
  if (h >= 12 && h < 17) return { text: 'Good afternoon', part: 'afternoon' };
  return { text: 'Good evening', part: 'evening' };
}
