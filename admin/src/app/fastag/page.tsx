'use client';

import { SectionPage } from '../../components/portal/SectionPage';
import FastagOverviewTab from '../../features/fastag/FastagOverviewTab';
import TollTransactionsTab from '../../features/fastag/TollTransactionsTab';
import CustomerTollBillingTab from '../../features/fastag/CustomerTollBillingTab';
import TollReportsTab from '../../features/fastag/TollReportsTab';

export default function FastagPage() {
  return (
    <SectionPage
      section="fastag"
      pendingIntegration="FASTag balances and toll entries are sample data. They will come from the issuing bank / NETC API later; recharges are simulated."
      tabs={{
        'fastag-overview': FastagOverviewTab,
        'toll-transactions': TollTransactionsTab,
        'customer-toll-billing': CustomerTollBillingTab,
        'toll-reports': TollReportsTab,
      }}
    />
  );
}
