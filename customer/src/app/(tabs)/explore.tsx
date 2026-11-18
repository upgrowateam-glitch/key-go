import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, X, Filter, LayoutGrid, List } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { CarCard, customerAvailability } from '../../components/ui/CarCard';
import {
  Screen,
  PageHeader,
  Card,
  Grid,
  Button,
  ChipGroup,
  SegmentedControl,
  ToggleRow,
  EmptyState,
  Badge,
} from '../../components/kit';
import { useResponsive } from '../../hooks/useResponsive';
import { Vehicle } from '../../types';

const CATEGORIES = ['All', 'Hatchback', 'Sedan', 'SUV', 'MUV'] as const;
type Category = (typeof CATEGORIES)[number];
const TRANSMISSIONS = ['All', 'Auto', 'Manual'] as const;
type Transmission = (typeof TRANSMISSIONS)[number];
const SORTS = ['recommended', 'low', 'high'] as const;
type Sort = (typeof SORTS)[number];
const VIEWS = ['grid', 'list'] as const;
type ViewMode = (typeof VIEWS)[number];

export default function FleetScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isPhone, cols } = useResponsive();
  const { vehicles, selectedCategory, setSelectedCategory } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [transmission, setTransmission] = useState<Transmission>('All');
  const [fuel, setFuel] = useState<string>('All');
  const [sort, setSort] = useState<Sort>('recommended');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [view, setView] = useState<ViewMode>('grid');

  // Vehicles that have left the fleet are never shown to customers
  const catalog = useMemo(() => vehicles.filter((v) => v.status !== 'Sold'), [vehicles]);
  const fuelOptions = useMemo(() => ['All', ...Array.from(new Set(catalog.map((v) => v.fuel)))], [catalog]);

  const category: Category = (CATEGORIES as readonly string[]).includes(selectedCategory) ? (selectedCategory as Category) : 'All';
  const q = searchQuery.trim().toLowerCase();

  const filtered = useMemo(() => {
    const list = catalog.filter((v) => {
      const matchesQuery =
        !q || v.name.toLowerCase().includes(q) || (v.brand?.toLowerCase().includes(q) ?? false) || v.type.toLowerCase().includes(q);
      return (
        matchesQuery &&
        (category === 'All' || v.type === category) &&
        (transmission === 'All' || v.transmission === transmission) &&
        (fuel === 'All' || v.fuel === fuel) &&
        (!availableOnly || customerAvailability(v).bookable)
      );
    });
    const byAvail = (a: Vehicle, b: Vehicle) => Number(customerAvailability(b).bookable) - Number(customerAvailability(a).bookable);
    return [...list].sort((a, b) => {
      if (sort === 'low') return a.pricePerDay - b.pricePerDay;
      if (sort === 'high') return b.pricePerDay - a.pricePerDay;
      return byAvail(a, b);
    });
  }, [catalog, q, category, transmission, fuel, availableOnly, sort]);

  const availableCount = filtered.filter((v) => customerAvailability(v).bookable).length;
  const hasFilters = q.length > 0 || category !== 'All' || transmission !== 'All' || fuel !== 'All' || availableOnly || sort !== 'recommended';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setTransmission('All');
    setFuel('All');
    setSort('recommended');
    setAvailableOnly(false);
  };

  const openCar = (vehicle: Vehicle) => router.push(`/car/${vehicle.id}` as any);

  return (
    <Screen bottomInset={64}>
      <PageHeader
        eyebrow="Explore fleet"
        title="Find your car"
        subtitle={`${filtered.length} ${filtered.length === 1 ? 'car' : 'cars'} · ${availableCount} available to book now`}
        actions={
          <SegmentedControl
            options={VIEWS}
            value={view}
            onChange={setView}
            labels={{ grid: 'Grid', list: 'List' }}
          />
        }
      />

      <Card style={{ marginTop: 12 }}>
        <View style={[styles.searchBox]}>
          <Search size={18} color={colors.primaryText} />
          <TextInput
            accessibilityLabel="Search cars"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by model, brand or category"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <X size={16} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.filters, !isPhone && { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 }]}>
          <FilterGroup label="Category">
            <ChipGroup options={CATEGORIES} value={category} onChange={(c) => setSelectedCategory(c)} scroll={isPhone} />
          </FilterGroup>
          <FilterGroup label="Transmission">
            <SegmentedControl options={TRANSMISSIONS} value={transmission} onChange={setTransmission} />
          </FilterGroup>
          <FilterGroup label="Fuel">
            <ChipGroup options={fuelOptions} value={fuel} onChange={setFuel} scroll={isPhone} />
          </FilterGroup>
          <FilterGroup label="Sort by price">
            <SegmentedControl
              options={SORTS}
              value={sort}
              onChange={setSort}
              labels={{ recommended: 'Recommended', low: 'Low to high', high: 'High to low' }}
            />
          </FilterGroup>
        </View>

        <View style={[styles.footerRow, isPhone && { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ flex: 1 }}>
            <ToggleRow
              label="Available now only"
              description="Booked or in-service cars are shown but can't be booked"
              value={availableOnly}
              onValueChange={setAvailableOnly}
            />
          </View>
          <Button
            label="Reset filters"
            variant="outline"
            size="sm"
            disabled={!hasFilters}
            onPress={resetFilters}
            icon={(c) => <Filter size={14} color={c} />}
          />
        </View>
      </Card>

      {hasFilters ? (
        <View style={styles.activeRow}>
          <Text style={styles.activeText}>Filtered:</Text>
          {q ? <Badge label={`"${searchQuery.trim()}"`} tone="primary" /> : null}
          {category !== 'All' ? <Badge label={category} tone="primary" /> : null}
          {transmission !== 'All' ? <Badge label={transmission} tone="primary" /> : null}
          {fuel !== 'All' ? <Badge label={fuel} tone="primary" /> : null}
          {availableOnly ? <Badge label="Available now" tone="primary" /> : null}
          {sort !== 'recommended' ? <Badge label={sort === 'low' ? 'Price low to high' : 'Price high to low'} tone="primary" /> : null}
        </View>
      ) : null}

      <View style={{ marginTop: 16 }}>
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              title="No cars match your filters"
              message="Try a different category, fuel type or search keyword."
              icon={(c) => <Filter size={22} color={c} />}
              action={<Button label="Reset filters" onPress={resetFilters} />}
            />
          </Card>
        ) : view === 'grid' ? (
          <Grid cols={cols(1, 2, 3)} gap={16}>
            {filtered.map((vehicle) => (
              <CarCard key={vehicle.id} vehicle={vehicle} onPressRent={openCar} onPressDetails={openCar} />
            ))}
          </Grid>
        ) : (
          <Grid cols={cols(1, 1, 2)} gap={12}>
            {filtered.map((vehicle) => (
              <CarCard key={vehicle.id} vehicle={vehicle} variant="compact" onPressRent={openCar} onPressDetails={openCar} />
            ))}
          </Grid>
        )}
      </View>

      <View style={styles.legend}>
        {view === 'grid' ? <LayoutGrid size={14} color={colors.muted} /> : <List size={14} color={colors.muted} />}
        <Text style={styles.legendText}>Prices are per day before taxes. Weekly and monthly discounts apply at checkout.</Text>
      </View>
    </Screen>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      {children}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      borderRadius: 12,
      paddingHorizontal: 12,
      minHeight: 44,
    },
    searchInput: {
      flex: 1,
      color: colors.txt,
      fontSize: 14,
      paddingVertical: 10,
    },
    filters: {
      marginTop: 4,
    },
    filterGroup: {
      marginTop: 14,
    },
    filterLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 6,
    },
    activeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
    },
    activeText: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    legendText: {
      color: colors.muted,
      fontSize: 12,
      flex: 1,
    },
  });
