'use client';

import { SectionPage } from '../../components/portal/SectionPage';
import CustomerTab from '../../features/reports/CustomerTab';
import FastagTab from '../../features/reports/FastagTab';
import IncomeExpenseTab from '../../features/reports/IncomeExpenseTab';
import MaintenanceTab from '../../features/reports/MaintenanceTab';
import PeriodReportsTab from '../../features/reports/PeriodReportsTab';
import { ReportsProvider } from '../../features/reports/reportsShared';
import SummaryTab from '../../features/reports/SummaryTab';
import VehicleTab from '../../features/reports/VehicleTab';

export default function ReportsPage() {
  return (
    <ReportsProvider>
      <SectionPage
        section="reports"
        pendingIntegration="Sample data. Every figure is derived from local sample records. CSV is a real download; PDF is simulated."
        tabs={{
          summary: SummaryTab,
          'vehicle-wise': VehicleTab,
          'customer-wise': CustomerTab,
          'income-and-expense': IncomeExpenseTab,
          maintenance: MaintenanceTab,
          fastag: FastagTab,
          'period-reports': PeriodReportsTab,
        }}
      />
    </ReportsProvider>
  );
}
