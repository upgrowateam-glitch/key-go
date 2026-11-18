'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { silenceResponderWarnings } from '../../lib/silenceResponderWarnings';

silenceResponderWarnings();

// react-native-web layouts depend on the window size, and the portal is signed-in only, so it renders on the client.
const PortalShell = dynamic(() => import('./PortalShell'), { ssr: false });

export function ClientRoot({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
