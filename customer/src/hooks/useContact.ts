import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface CompanyContact {
  name: string;
  phone: string;
  email: string;
  address: string;
  supportHours: string;
  website: string;
}

let cached: CompanyContact | null = null;

/** KeyGo's phone, email and support hours, as entered in the admin portal's company settings. */
export function useContact() {
  const [contact, setContact] = useState<CompanyContact | null>(cached);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (cached) return;
    let alive = true;
    api<CompanyContact>('/public/contact', { auth: false })
      .then((c) => {
        cached = c;
        if (alive) setContact(c);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);
  return { contact, loading: !contact && !failed, failed };
}

/** Digits for wa.me / tel: links; a 10-digit Indian number gets the 91 country code. */
export function phoneDigits(phone: string) {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
}
