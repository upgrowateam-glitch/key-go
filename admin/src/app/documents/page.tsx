'use client';

import { Suspense } from 'react';
import DocumentsOverview from '../../features/fleet/DocumentsOverview';

export default function DocumentsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentsOverview />
    </Suspense>
  );
}
