'use client';

import { SectionPage } from '../../components/portal/SectionPage';
import AgreementListTab from '../../features/agreements/AgreementListTab';
import AgreementDetailsTab from '../../features/agreements/AgreementDetailsTab';
import TermsTab from '../../features/agreements/TermsTab';
import DepositsDiscountsTab from '../../features/agreements/DepositsDiscountsTab';
import FinesTab from '../../features/agreements/FinesTab';

export default function AgreementsPage() {
  return (
    <SectionPage
      section="agreements"
      pendingIntegration="E-signature and PDF generation are simulated. Aadhaar eSign and server-side PDFs are pending integration."
      tabs={{
        'agreement-list': AgreementListTab,
        'agreement-details': AgreementDetailsTab,
        'terms-and-conditions': TermsTab,
        'deposits-and-discounts': DepositsDiscountsTab,
        'fines-and-penalties': FinesTab,
      }}
    />
  );
}
