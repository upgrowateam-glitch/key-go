'use client';

import { SectionPage } from '../../components/portal/SectionPage';
import ActiveRentalsTab from '../../features/tracking/ActiveRentalsTab';
import GpsMapTab from '../../features/tracking/GpsMapTab';
import OverdueRentalsTab from '../../features/tracking/OverdueRentalsTab';
import UtilizationTab from '../../features/tracking/UtilizationTab';

export default function TrackingPage() {
  return (
    <SectionPage
      section="tracking"
      tabs={{
        'active-rentals': ActiveRentalsTab,
        'gps-map': GpsMapTab,
        'overdue-rentals': OverdueRentalsTab,
        utilization: UtilizationTab,
      }}
    />
  );
}
