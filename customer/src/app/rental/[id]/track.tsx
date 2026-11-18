import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Car } from 'lucide-react-native';
import { useApp } from '../../../context/AppContext';
import { Card, EmptyState, GpsMapPlaceholder, KeyValueGrid, PageHeader, ProgressBar, Screen, Section, SimulatedNote } from '../../../components/kit';
import { elapsedDays, isOverdue } from '../../../lib/lifecycle';
import { formatDate, formatKm } from '../../../lib/format';

const ROUTE = [
  { x: 0.08, y: 0.82 },
  { x: 0.2, y: 0.7 },
  { x: 0.34, y: 0.72 },
  { x: 0.42, y: 0.5 },
  { x: 0.56, y: 0.44 },
  { x: 0.66, y: 0.3 },
];

export default function TrackRentalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = decodeURIComponent(id ?? '');
  const { bookings, vehicles, currentCustomerId, today } = useApp();
  const booking = bookings.find((b) => b.id === bookingId && b.customerId === currentCustomerId);
  const vehicle = vehicles.find((v) => v.id === booking?.vehicleId);

  if (!booking || !vehicle || booking.status !== 'Active') {
    return (
      <Screen>
        <PageHeader title="Track my car" back />
        <EmptyState title="Tracking isn't available" message="GPS tracking is shown while your rental is active." icon={(c) => <Car size={22} color={c} />} />
      </Screen>
    );
  }

  const overdue = isOverdue(booking, today);
  return (
    <Screen>
      <PageHeader eyebrow="Active rental" title="Track my car" subtitle={`${booking.vehicleName} · ${booking.vehicleNumber}`} back />
      <Section title="Live location" style={{ marginTop: 12 }}>
        <GpsMapPlaceholder
          height={280}
          route={ROUTE}
          markers={[
            { id: 'start', label: 'Pickup', x: ROUTE[0].x, y: ROUTE[0].y, tone: 'neutral' },
            { id: 'now', label: vehicle.gps.area, ...ROUTE[ROUTE.length - 1], tone: overdue ? 'danger' : 'primary' },
          ]}
          caption={`Simulated GPS · updated ${vehicle.gps.updatedAt}`}
        />
      </Section>
      <Section title="Trip">
        <Card>
          <KeyValueGrid
            cols={2}
            items={[
              { label: 'Current area', value: vehicle.gps.area },
              { label: 'Status', value: vehicle.gps.ignitionOn ? `Moving at ${vehicle.gps.speedKmh} km/h` : 'Parked' },
              { label: 'Driven so far', value: formatKm(booking.kmDriven ?? 0) },
              { label: 'Return by', value: `${formatDate(booking.returnDate, false)}, ${booking.returnTime}` },
            ]}
          />
          <ProgressBar value={Math.min(1, elapsedDays(booking, today) / Math.max(1, booking.days))} tone={overdue ? 'danger' : 'primary'} />
        </Card>
      </Section>
      <SimulatedNote>GPS provider integration is pending. The position shown is sample data.</SimulatedNote>
    </Screen>
  );
}
