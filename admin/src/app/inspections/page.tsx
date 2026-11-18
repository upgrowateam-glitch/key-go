'use client';

import { SectionPage } from '../../components/portal/SectionPage';
import { PickupInspectionTab, ReturnInspectionTab } from '../../features/inspections/QueueTabs';
import DamageReportsTab from '../../features/inspections/DamageReportsTab';
import InspectionHistoryTab from '../../features/inspections/InspectionHistoryTab';

export default function InspectionsPage() {
  return (
    <SectionPage
      section="inspections"
      tabs={{
        'pickup-inspection': PickupInspectionTab,
        'return-inspection': ReturnInspectionTab,
        'damage-reports': DamageReportsTab,
        'inspection-history': InspectionHistoryTab,
      }}
    />
  );
}
