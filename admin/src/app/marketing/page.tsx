'use client';

import { SectionPage } from '../../components/portal/SectionPage';
import CampaignsTab from '../../features/marketing/CampaignsTab';
import CustomerSegmentsTab from '../../features/marketing/CustomerSegmentsTab';
import ReferralCodesTab from '../../features/marketing/ReferralCodesTab';
import CustomerCommissionTab from '../../features/marketing/CustomerCommissionTab';
import LoyaltyPointsTab from '../../features/marketing/LoyaltyPointsTab';
import GiftsRewardsTab from '../../features/marketing/GiftsRewardsTab';
import AutomationTab from '../../features/marketing/AutomationTab';

export default function MarketingPage() {
  return (
    <SectionPage
      section="marketing"
      pendingIntegration="Simulated: real WhatsApp, SMS and email integration is pending. Campaigns and gifts are recorded here, but no message is sent and no gift is dispatched."
      tabs={{
        campaigns: CampaignsTab,
        'customer-segments': CustomerSegmentsTab,
        'referral-codes': ReferralCodesTab,
        'customer-commission': CustomerCommissionTab,
        'loyalty-points': LoyaltyPointsTab,
        'gifts-and-rewards': GiftsRewardsTab,
        automation: AutomationTab,
      }}
    />
  );
}
