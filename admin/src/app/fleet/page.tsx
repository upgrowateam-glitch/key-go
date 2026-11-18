'use client';

import { Suspense } from 'react';
import FleetScreen from '../../features/fleet/FleetScreen';

/** The fleet list reads its starting filter from the link (Vehicle Sales, Vehicle Categories). */
export default function FleetPage() {
  return (
    <Suspense fallback={null}>
      <FleetScreen />
    </Suspense>
  );
}
