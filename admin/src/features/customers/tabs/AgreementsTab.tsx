import { useRouter } from '@/shims/expo-router';
import { FileText } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Column, DataTable, EmptyState, StatusBadge } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { formatDate, formatINR } from '../../../lib/format';
import type { Agreement, Booking } from '../../../types';
import { ListPager, usePaged } from '../../fleet/ListPager';

const COLUMNS: Column<Agreement>[] = [
  { key: 'id', label: 'Agreement', flex: 1, minWidth: 120, value: (a) => a.id },
  { key: 'booking', label: 'Booking', flex: 0.7, minWidth: 90, value: (a) => a.bookingId },
  { key: 'vehicle', label: 'Vehicle', flex: 1, minWidth: 120, value: (a) => a.vehicleNumber },
  { key: 'signed', label: 'Signed', flex: 0.8, minWidth: 100, value: (a) => formatDate(a.signedDate) },
  { key: 'rental', label: 'Rental', flex: 0.8, minWidth: 90, align: 'right', value: (a) => formatINR(a.rentalAmount) },
  { key: 'deposit', label: 'Deposit', flex: 0.8, minWidth: 90, align: 'right', value: (a) => formatINR(a.securityDeposit) },
  { key: 'status', label: 'Status', flex: 0.7, minWidth: 90, render: (a) => <StatusBadge status={a.status} /> },
];

export function AgreementsTab({ history }: { history: Booking[] }) {
  const router = useRouter();
  const { agreements } = useApp();
  const own = useMemo(() => {
    const ids = new Set(history.map((b) => b.id));
    return agreements.filter((a) => ids.has(a.bookingId)).sort((a, b) => (a.signedDate < b.signedDate ? 1 : -1));
  }, [agreements, history]);
  const paged = usePaged(own);
  return (
    <View>
      <DataTable
        columns={COLUMNS}
        rows={paged.rows}
        rowKey={(a) => a.id}
        onRowPress={(a) => router.push(`/bookings/${encodeURIComponent(a.bookingId)}/agreement` as any)}
        empty={<EmptyState compact title="No agreements yet" message="Rental agreements appear here once this customer signs one." icon={(c) => <FileText size={22} color={c} />} />}
      />
      <ListPager paged={paged} />
    </View>
  );
}
