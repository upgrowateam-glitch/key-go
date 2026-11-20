import { useRouter } from '@/shims/expo-router';
import { CalendarCheck, CalendarClock, Car, FileText, Fuel, Gauge, IndianRupee, LayoutGrid, MapPin, Pencil, Tag, Wrench, Zap } from 'lucide-react-native';
import { useRouter as useNextRouter, useParams, usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  ChipGroup,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Screen,
  StatusBadge,
  VEHICLE_PHOTO_ASPECT,
  VehiclePhoto,
} from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR, formatKm } from '../../lib/format';
import { categoryOf, loadFleetExtras, readFleetExtras } from '../../services/fleet';
import { useResource } from '../../services/mockClient';
import { useThemeColors, useThemedStyles } from '../../theme';
import { VehicleStatus } from '../../types';
import { makeStyles } from './detailStyles';
import { DocumentsTab } from './tabs/DocumentsTab';
import { FastagTab } from './tabs/FastagTab';
import { FinancialsTab } from './tabs/FinancialsTab';
import { FuelTab } from './tabs/FuelTab';
import { GpsTab } from './tabs/GpsTab';
import { MaintenanceTab } from './tabs/MaintenanceTab';
import { OverviewTab } from './tabs/OverviewTab';
import { RentalHistoryTab } from './tabs/RentalHistoryTab';
import { VehicleForm } from './VehicleForm';
import { HeroStat, VehicleTabs } from './ui';

const TABS = [
  { slug: 'overview', label: 'Overview', icon: LayoutGrid },
  { slug: 'documents', label: 'Documents', icon: FileText },
  { slug: 'gps-tracking', label: 'GPS Tracking', icon: MapPin },
  { slug: 'fastag', label: 'FASTag', icon: Tag },
  { slug: 'fuel-history', label: 'Fuel History', icon: Fuel },
  { slug: 'maintenance', label: 'Maintenance', icon: Wrench },
  { slug: 'rental-history', label: 'Rental History', icon: CalendarClock },
  { slug: 'financials', label: 'Financials', icon: IndianRupee },
] as const;

/** What each status means, shown under the badge. Only Maintenance is switched by hand; Sold comes from the sale. */
const STATUS_HELP: Record<VehicleStatus, string> = {
  Available: 'Ready to rent. Status follows the bookings automatically.',
  Reserved: 'Booked for today; becomes On Rent at the pickup inspection.',
  'On Rent': 'Out with a customer; becomes Available after the return.',
  Maintenance: 'Not offered to customers until you put it back in service.',
  Sold: 'This vehicle has been sold.',
};

function VehicleDetail() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const nextRouter = useNextRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const params = useParams();
  const id = decodeURIComponent(String(params?.id ?? ''));
  const { isPhone, isDesktop } = useResponsive();
  const { vehicles, bookings, updateVehicleStatus } = useApp();
  const extras = useResource(loadFleetExtras);
  const [editing, setEditing] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<VehicleStatus | null>(null);

  const active = TABS.find((t) => t.slug === search.get('tab')) ?? TABS[0];
  const history = useMemo(() => bookings.filter((b) => b.vehicleId === id), [bookings, id]);
  const v = vehicles.find((x) => x.id === id);

  if (!v) {
    return (
      <Screen>
        <PageHeader title="Vehicle not found" back />
        <Card style={{ marginTop: 16 }}>
          <EmptyState
            title="Unknown vehicle"
            message={`There is no vehicle with ID "${id}". It may have been removed or the link is wrong.`}
            icon={(c) => <Car size={22} color={c} />}
            action={<Button label="Back to vehicles" variant="outline" onPress={() => router.replace('/fleet' as any)} />}
          />
        </Card>
      </Screen>
    );
  }

  const isSold = v.status === 'Sold';
  const refreshExtras = () => extras.setData(readFleetExtras());
  const changeTab = (label: string) => {
    const slug = TABS.find((t) => t.label === label)!.slug;
    nextRouter.replace(`${pathname}?tab=${slug}`);
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Vehicle"
        title={v.name}
        subtitle={`${v.vehicleNumber} · ${v.type} · ${v.fuel}`}
        back
        actions={
          isSold || !extras.data ? undefined : (
            <Button label="Edit vehicle" variant="outline" icon={(c) => <Pencil size={14} color={c} />} onPress={() => setEditing(true)} />
          )
        }
      />

      <Card padded={false} style={{ overflow: 'hidden', marginTop: 16 }}>
        <View style={[styles.heroRow, isPhone && { flexDirection: 'column' }]}>
          <View style={[styles.heroImageWrap, isPhone ? { aspectRatio: VEHICLE_PHOTO_ASPECT } : { width: isDesktop ? 480 : 340, minHeight: 260 }]}>
            {v.imageAsset ? (
              <VehiclePhoto source={v.imageAsset} style={StyleSheet.absoluteFill} radius={0} accessibilityLabel={`Photo of ${v.name}`} />
            ) : (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Car size={48} color={colors.secondaryText} />
                <Text style={styles.muted}>No photo on file</Text>
              </View>
            )}
            <View style={styles.paintChip}>
              <View style={[styles.paintDot, { backgroundColor: v.color }]} />
              <Text style={styles.paintText}>
                {v.brand ? `${v.brand} · ` : ''}
                {v.type}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1, padding: isPhone ? 14 : 20, gap: 14 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}>
              <StatusBadge status={v.status} />
              {v.badge ? <Badge label={v.badge} tone="highlight" /> : null}
              {v.photoNeedsReplacement ? <Badge label="Showroom photo needed" tone="warning" /> : null}
              <View style={styles.codeChip}>
                <Text style={styles.codeText}>{v.code ?? `ID ${v.id}`}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <HeroStat icon={IndianRupee} label="Daily rate" value={formatINR(v.pricePerDay)} tone="success" />
              <HeroStat icon={Gauge} label="Odometer" value={formatKm(v.odometerKm)} tone="info" />
              <HeroStat
                icon={v.fuel === 'Electric' ? Zap : Fuel}
                label={v.fuel === 'Electric' ? 'Charge' : 'Fuel'}
                value={`${v.fuelLevelPercent}%`}
                tone={v.fuelLevelPercent < 25 ? 'warning' : 'primary'}
              />
              <HeroStat icon={CalendarCheck} label="Bookings" value={String(history.length)} tone="violet" />
            </View>
            <View style={styles.statusBox}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.muted}>{STATUS_HELP[v.status]}</Text>
              {isSold ? null : (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      marginTop: 8,
                      flexWrap: 'wrap',
                    }}>
                    {v.status === 'Maintenance' ? (
                      <Button label="Back in service" size="sm" onPress={() => setPendingStatus('Available')} />
                    ) : (
                      <Button
                        label="Put in maintenance"
                        size="sm"
                        variant="outline"
                        disabled={v.status === 'On Rent'}
                        onPress={() => setPendingStatus('Maintenance')}
                      />
                    )}
                  </View>
                  <Text style={[styles.hint, { marginTop: 6 }]}>
                    Available, Reserved and On Rent follow the bookings. To mark as sold, use the Financials tab.
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </Card>

      <View style={{ marginTop: 20 }}>
        <VehicleTabs tabs={TABS} value={active.label} onChange={changeTab} />
        {!extras.data ? (
          <ResourceState loading={extras.loading} error={extras.error} onRetry={extras.reload} />
        ) : (
          <>
            {active.slug === 'overview' ? <OverviewTab v={v} category={categoryOf(extras.data, v.id)} /> : null}
            {active.slug === 'documents' ? <DocumentsTab v={v} extras={extras.data} onChanged={refreshExtras} /> : null}
            {active.slug === 'gps-tracking' ? <GpsTab v={v} extras={extras.data} onChanged={refreshExtras} /> : null}
            {active.slug === 'fastag' ? <FastagTab v={v} /> : null}
            {active.slug === 'fuel-history' ? <FuelTab v={v} /> : null}
            {active.slug === 'maintenance' ? <MaintenanceTab v={v} /> : null}
            {active.slug === 'rental-history' ? <RentalHistoryTab v={v} /> : null}
            {active.slug === 'financials' ? <FinancialsTab v={v} /> : null}
          </>
        )}
      </View>

      {editing && extras.data ? (
        <VehicleForm vehicle={v} category={categoryOf(extras.data, v.id)} onClose={() => setEditing(false)} onSaved={refreshExtras} />
      ) : null}
      <ConfirmDialog
        visible={pendingStatus !== null}
        title={pendingStatus === 'Maintenance' ? `Put ${v.name} in maintenance?` : `Put ${v.name} back in service?`}
        message={
          pendingStatus === 'Maintenance'
            ? `${v.vehicleNumber} will not be offered to customers. Confirmed bookings stay; move them if the car will not be ready.`
            : `${v.vehicleNumber} becomes available again (or Reserved/On Rent if a booking needs it).`
        }
        confirmLabel={pendingStatus === 'Maintenance' ? 'Put in maintenance' : 'Back in service'}
        onConfirm={() => {
          if (pendingStatus) updateVehicleStatus(v.id, pendingStatus);
          setPendingStatus(null);
        }}
        onCancel={() => setPendingStatus(null)}
      />
    </Screen>
  );
}

export default function VehicleDetailScreen() {
  return (
    <Suspense fallback={null}>
      <VehicleDetail />
    </Suspense>
  );
}
