'use client';

import { SectionPage } from '../../components/portal/SectionPage';
import MaintenanceOverviewTab from '../../features/maintenance/MaintenanceOverviewTab';
import ServiceScheduleTab from '../../features/maintenance/ServiceScheduleTab';
import MaintenanceHistoryTab from '../../features/maintenance/MaintenanceHistoryTab';
import ExpensesTab from '../../features/maintenance/ExpensesTab';
import RenewalRemindersTab from '../../features/maintenance/RenewalRemindersTab';

export default function MaintenancePage() {
  return (
    <SectionPage
      section="maintenance"
      tabs={{
        'maintenance-overview': MaintenanceOverviewTab,
        'service-schedule': ServiceScheduleTab,
        'maintenance-history': MaintenanceHistoryTab,
        expenses: ExpensesTab,
        'renewal-reminders': RenewalRemindersTab,
      }}
    />
  );
}
