'use client';

import { useRouter } from '@/shims/expo-router';
import { Plus } from 'lucide-react-native';
import { Button } from '../../components/kit';
import { SectionPage } from '../../components/portal/SectionPage';
import { BookingListTab } from '../../features/bookings/BookingListTab';
import { CalendarTab } from '../../features/bookings/CalendarTab';
import { CreateBookingTab } from '../../features/bookings/CreateBookingTab';
import { QuotesTab } from '../../features/bookings/QuotesTab';

function CreateBookingAction() {
  const router = useRouter();
  return <Button label="Create booking" icon={(c) => <Plus size={16} color={c} />} onPress={() => router.push('/bookings?tab=create-booking')} />;
}

export default function BookingsPage() {
  return (
    <SectionPage
      section="bookings"
      actions={<CreateBookingAction />}
      tabs={{ 'booking-list': BookingListTab, calendar: CalendarTab, 'create-booking': CreateBookingTab, quotes: QuotesTab }}
    />
  );
}
