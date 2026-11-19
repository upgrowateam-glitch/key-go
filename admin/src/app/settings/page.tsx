'use client';

import { SectionPage } from '../../components/portal/SectionPage';
import CompanyProfileTab from '../../features/settings/CompanyProfileTab';
import BranchesTab from '../../features/settings/BranchesTab';
import MasterDataTab from '../../features/settings/MasterDataTab';
import UsersRolesTab from '../../features/settings/UsersRolesTab';
import PermissionsTab from '../../features/settings/PermissionsTab';
import RentalPricingTab from '../../features/settings/RentalPricingTab';
import BookingPoliciesTab from '../../features/settings/BookingPoliciesTab';
import PaymentSettingsTab from '../../features/settings/PaymentSettingsTab';
import NotificationSettingsTab from '../../features/settings/NotificationSettingsTab';
import TermsTab from '../../features/settings/TermsTab';
import ThemeTab from '../../features/settings/ThemeTab';

export default function SettingsPage() {
  return (
    <SectionPage
      section="settings"
      tabs={{
        'company-profile': CompanyProfileTab,
        branches: BranchesTab,
        'master-data': MasterDataTab,
        'users-and-roles': UsersRolesTab,
        permissions: PermissionsTab,
        'rental-pricing': RentalPricingTab,
        'booking-policies': BookingPoliciesTab,
        'payment-settings': PaymentSettingsTab,
        'notification-settings': NotificationSettingsTab,
        'terms-and-conditions': TermsTab,
        theme: ThemeTab,
      }}
    />
  );
}
