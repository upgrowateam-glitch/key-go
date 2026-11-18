'use client';

import { SectionPage } from '../../components/portal/SectionPage';
import NotificationCenterTab from '../../features/notifications/NotificationCenterTab';
import RemindersTab from '../../features/notifications/RemindersTab';
import TemplatesTab from '../../features/notifications/TemplatesTab';
import AutomationTab from '../../features/notifications/AutomationTab';
import DeliveryHistoryTab from '../../features/notifications/DeliveryHistoryTab';
import WhatsAppSmsSettingsTab from '../../features/notifications/WhatsAppSmsSettingsTab';

export default function NotificationsPage() {
  return (
    <SectionPage
      section="notifications"
      pendingIntegration="Simulated messaging: real WhatsApp and SMS integration is pending, so nothing is sent. Messages are queued and marked delivered locally, and automation rules do not run."
      tabs={{
        'notification-center': NotificationCenterTab,
        reminders: RemindersTab,
        templates: TemplatesTab,
        automation: AutomationTab,
        'delivery-history': DeliveryHistoryTab,
        'whatsapp-and-sms-settings': WhatsAppSmsSettingsTab,
      }}
    />
  );
}
