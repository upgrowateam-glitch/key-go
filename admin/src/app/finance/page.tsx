'use client';

import { SectionPage } from '../../components/portal/SectionPage';
import ExpensesTab from '../../features/finance/ExpensesTab';
import FinesTab from '../../features/finance/FinesTab';
import LoanEmiTab from '../../features/finance/LoanEmiTab';
import OverviewTab from '../../features/finance/OverviewTab';
import PaymentsTab from '../../features/finance/PaymentsTab';
import ProfitLossTab from '../../features/finance/ProfitLossTab';
import RentalIncomeTab from '../../features/finance/RentalIncomeTab';

export default function FinancePage() {
  return (
    <SectionPage
      section="finance"
      pendingIntegration="Figures come from the records saved in KeyGo. Nothing reaches a bank or accounting system yet. CSV exports are real downloads."
      tabs={{
        overview: OverviewTab,
        'rental-income': RentalIncomeTab,
        expenses: ExpensesTab,
        'loan-emi': LoanEmiTab,
        'payments-and-refunds': PaymentsTab,
        fines: FinesTab,
        'profit-and-loss': ProfitLossTab,
      }}
    />
  );
}
