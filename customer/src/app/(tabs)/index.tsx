import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search,
  Zap,
  ShieldCheck,
  Navigation,
  Headphones,
  Smartphone,
  X,
  SearchX,
  KeyRound,
  LayoutGrid,
  CarFront,
  Car,
  Gem,
} from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { boxShadow, useThemeColors, useThemedStyles, BRAND, type ThemeColors } from '../../theme';
import { CarCard } from '../../components/ui/CarCard';
import { FeaturedCarousel } from '../../components/home/FeaturedCarousel';
import { HomeHero } from '../../components/home/HomeHero';
import { RentalPlanner } from '../../components/home/RentalPlanner';
import { HowItWorks } from '../../components/home/HowItWorks';
import { StatsCard } from '../../components/home/StatsCard';
import {
  Screen,
  Section,
  Grid,
  Card,
  Button,
  EmptyState,
} from '../../components/kit';
import { useResponsive } from '../../hooks/useResponsive';
import { Vehicle } from '../../types';

// Official manufacturer logos (sourced from Wikimedia), trimmed and scaled onto
// identical 3:2 transparent canvases so they read at a consistent size.
// Colors and proportions are untouched — never swap these for icons or initials.
const BASE_BRANDS: { name: string; logo: number }[] = [
  { name: 'Toyota', logo: require('../../../assets/images/brand_toyota.png') },
  { name: 'Hyundai', logo: require('../../../assets/images/brand_hyundai.png') },
  { name: 'Tata', logo: require('../../../assets/images/brand_tata.png') },
  { name: 'Kia', logo: require('../../../assets/images/brand_kia.png') },
  { name: 'Volkswagen', logo: require('../../../assets/images/brand_volkswagen.png') },
  { name: 'BMW', logo: require('../../../assets/images/brand_bmw.png') },
  { name: 'Audi', logo: require('../../../assets/images/brand_audi.png') },
  { name: 'Mercedes', logo: require('../../../assets/images/brand_mercedes.png') },
  { name: 'Porsche', logo: require('../../../assets/images/brand_porsche.png') },
];
const MARQUEE_BRANDS = [...BASE_BRANDS, ...BASE_BRANDS, ...BASE_BRANDS];
const BRAND_ITEM_WIDTH = 96 + 12;
const SINGLE_BRAND_LOOP_LEN = BASE_BRANDS.length * BRAND_ITEM_WIDTH;

type Category = string;
// Icon per car type; types KeyGo adds later use the plain car icon
const CATEGORY_ICONS: Record<string, typeof Car> = { All: LayoutGrid, Hatchback: Car, Sedan: Car, SUV: CarFront, MUV: Gem };

const CARD_WIDTH = 296;
const CARD_GAP = 16;
const INTERVAL_STEP = CARD_WIDTH + CARD_GAP;

export default function HomeScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { width, isPhone, gutter, cols } = useResponsive();

  // ---------- Entrance: the road video plays in the hero, then the showroom video in the card below ----------
  const { vehicles, selectedCategory, setSelectedCategory, bookingDraft, showToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTrendingIndex, setActiveTrendingIndex] = useState(0);

  // Customers never see vehicles that have left the fleet
  const customerFleet = useMemo(() => vehicles.filter((v) => v.status !== 'Sold'), [vehicles]);
  const lowestPrice = customerFleet.reduce((m, v) => Math.min(m, v.pricePerDay), Number.POSITIVE_INFINITY);

  // ---------- Brand marquee ----------
  const brandScrollRef = useRef<ScrollView>(null);
  const brandScrollPos = useRef(0);
  const isBrandInteracting = useRef(false);
  const brandResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const marqueeInterval = setInterval(() => {
      if (isBrandInteracting.current) return;
      brandScrollPos.current += 1.5;
      if (brandScrollPos.current >= SINGLE_BRAND_LOOP_LEN) brandScrollPos.current = 0;
      brandScrollRef.current?.scrollTo({ x: brandScrollPos.current, animated: false });
    }, 30);
    return () => clearInterval(marqueeInterval);
  }, []);

  const handleBrandTouchStart = () => {
    isBrandInteracting.current = true;
    if (brandResumeTimer.current) clearTimeout(brandResumeTimer.current);
  };
  const handleBrandTouchEnd = () => {
    if (brandResumeTimer.current) clearTimeout(brandResumeTimer.current);
    brandResumeTimer.current = setTimeout(() => {
      isBrandInteracting.current = false;
    }, 3000);
  };

  // ---------- Hot picks carousel ----------
  const trendingRef = useRef<ScrollView>(null);
  const isInteracting = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hotPicksVehicles = useMemo(
    () => [...customerFleet].sort((a, b) => Number(b.status === 'Available') - Number(a.status === 'Available')).slice(0, 5),
    [customerFleet]
  );

  useEffect(() => {
    if (hotPicksVehicles.length < 2) return;
    const autoSlideTimer = setInterval(() => {
      if (isInteracting.current) return;
      setActiveTrendingIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % hotPicksVehicles.length;
        trendingRef.current?.scrollTo({ x: nextIndex * INTERVAL_STEP, animated: true });
        return nextIndex;
      });
    }, 4500);
    return () => clearInterval(autoSlideTimer);
  }, [hotPicksVehicles.length]);

  const handleTouchStart = () => {
    isInteracting.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };
  const handleTouchEnd = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isInteracting.current = false;
    }, 3500);
  };

  useEffect(
    () => () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      if (brandResumeTimer.current) clearTimeout(brandResumeTimer.current);
    },
    []
  );

  // ---------- Catalog filtering ----------
  // Car types offered: those of the cars on show, in KeyGo's order
  const CATEGORIES = useMemo(() => ['All', ...Array.from(new Set(vehicles.filter((v) => v.status !== 'Sold').map((v) => v.type)))], [vehicles]);
  const category: Category = CATEGORIES.includes(selectedCategory) ? selectedCategory : 'All';
  const q = searchQuery.trim().toLowerCase();
  const filteredVehicles = customerFleet.filter((v) => {
    const matchesCategory = category === 'All' || v.type === category;
    const matchesQuery =
      !q || v.name.toLowerCase().includes(q) || (v.brand?.toLowerCase().includes(q) ?? false) || v.type.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });
  const hasFilters = q.length > 0 || category !== 'All';
  const matchesSearch = (v: Vehicle) =>
    !q || v.name.toLowerCase().includes(q) || (v.brand?.toLowerCase().includes(q) ?? false) || v.type.toLowerCase().includes(q);
  const categoryCount = (c: Category) => customerFleet.filter((v) => (c === 'All' || v.type === c) && matchesSearch(v)).length;

  const handleBookingSearch = () => {
    showToast(`Showing available cars for ${bookingDraft.pickupLocation || 'your search'}`);
    router.push('/(tabs)/explore' as any);
  };
  const openCar = (vehicle: Vehicle) => router.push(`/car/${vehicle.id}` as any);
  const handleBrandSelect = (brandName: string) =>
    setSearchQuery((prev) => (prev.toLowerCase() === brandName.toLowerCase() ? '' : brandName));
  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
  };

  return (
    <Screen bottomInset={64}>
      {/* --- HERO --- */}
      <View style={{ marginHorizontal: -gutter, marginTop: -16 }}>
        <HomeHero width={width} gutter={gutter} />
      </View>
      <View style={{ marginTop: 18 }}>
        <StatsCard />
      </View>
      <View style={{ marginTop: 16 }}>
        <FeaturedCarousel width={width - gutter * 2} lowestPrice={lowestPrice} onOpenFleet={() => router.push('/(tabs)/explore' as any)} />
      </View>
      <View style={{ marginTop: 16 }}>
        <RentalPlanner onSearch={handleBookingSearch} />
      </View>
      <View style={{ marginTop: 16 }}>
        <HowItWorks />
      </View>

      {/* --- TOP BRANDS (MARQUEE) --- */}
      <Section
        title="Top brands"
        subtitle="Tap a brand to filter the catalog"
        action={<Button label="View all" variant="ghost" size="sm" onPress={() => router.push('/(tabs)/explore' as any)} />}>
        <ScrollView
          ref={brandScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onTouchStart={handleBrandTouchStart}
          onTouchEnd={handleBrandTouchEnd}
          onScrollBeginDrag={handleBrandTouchStart}
          onScrollEndDrag={handleBrandTouchEnd}
          onMomentumScrollEnd={handleBrandTouchEnd}
          onScroll={(e) => {
            brandScrollPos.current = e.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
          {MARQUEE_BRANDS.map((brand, i) => {
            const isSelected = q === brand.name.toLowerCase();
            return (
              <TouchableOpacity
                key={`${brand.name}-${i}`}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${brand.name}`}
                accessibilityState={{ selected: isSelected }}
                style={[styles.brandCardItem, isSelected && styles.brandCardItemSelected]}
                onPress={() => handleBrandSelect(brand.name)}>
                <View style={styles.brandLogoTile}>
                  <Image
                    source={brand.logo}
                    style={styles.brandLogoImage}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                </View>
                <Text style={[styles.brandItemName, isSelected && { color: colors.primaryText }]} numberOfLines={1}>
                  {brand.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Section>

      {/* --- HOT PICKS (AUTO-SLIDE CAROUSEL) --- */}
      <Section
        title="Hot picks"
        subtitle="Curated favourites this week"
        action={<Button label={`Explore (${customerFleet.length})`} variant="ghost" size="sm" onPress={() => router.push('/(tabs)/explore' as any)} />}>
        <ScrollView
          ref={trendingRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={INTERVAL_STEP}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onScrollBeginDrag={handleTouchStart}
          onScrollEndDrag={handleTouchEnd}
          onMomentumScrollEnd={handleTouchEnd}
          onScroll={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / INTERVAL_STEP);
            setActiveTrendingIndex(Math.max(0, Math.min(index, hotPicksVehicles.length - 1)));
          }}
          contentContainerStyle={{ gap: CARD_GAP, paddingVertical: 4, paddingRight: 4 }}>
          {hotPicksVehicles.map((vehicle) => (
            <CarCard key={`hot-${vehicle.id}`} vehicle={vehicle} cardWidth={CARD_WIDTH} onPressRent={openCar} onPressDetails={openCar} />
          ))}
        </ScrollView>
        <View style={styles.dotsRow}>
          {hotPicksVehicles.map((v, idx) => (
            <TouchableOpacity
              key={v.id}
              accessibilityRole="button"
              accessibilityLabel={`Show ${v.name}`}
              hitSlop={8}
              onPress={() => {
                setActiveTrendingIndex(idx);
                trendingRef.current?.scrollTo({ x: idx * INTERVAL_STEP, animated: true });
              }}>
              <View style={[styles.dotItem, activeTrendingIndex === idx && styles.dotItemActive]} />
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* --- CATALOG: SEARCH + CATEGORY FILTERS --- */}
      <Section
        title={q ? `Search results (${filteredVehicles.length})` : 'Pick your ride'}
        subtitle="Search and filter the full catalog"
        action={hasFilters ? <Button label="Reset" variant="ghost" size="sm" onPress={clearAllFilters} /> : undefined}>
        <View style={[styles.catalogControls, !isPhone && { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={[styles.searchBar, !isPhone && { flex: 1, maxWidth: 440 }]}>
            <View style={styles.searchIcon}>
              <Search size={17} color={colors.primaryText} />
            </View>
            <TextInput
              accessibilityLabel="Search cars"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search car, brand or type"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" style={styles.searchClear} onPress={() => setSearchQuery('')}>
                <X size={15} color={colors.txt} />
              </TouchableOpacity>
            ) : (
              <View style={styles.searchCount}>
                <Text style={styles.searchCountText}>{customerFleet.length} cars</Text>
              </View>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={!isPhone ? { flex: 1 } : undefined} contentContainerStyle={styles.catChips}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              const Icon = CATEGORY_ICONS[c] ?? Car;
              const count = categoryCount(c);
              return (
                <TouchableOpacity
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`${c}, ${count} cars`}
                  accessibilityState={{ selected: active }}
                  activeOpacity={0.85}
                  onPress={() => setSelectedCategory(c)}
                  style={[styles.catChip, active && styles.catChipActive]}>
                  <Icon size={15} color={active ? colors.highlight : colors.primaryText} />
                  <Text style={[styles.catChipText, active && { color: colors.onPrimary }]}>{c}</Text>
                  <View style={[styles.catCount, active && { backgroundColor: colors.highlight }]}>
                    <Text style={[styles.catCountText, active && { color: colors.onHighlight }]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {filteredVehicles.length > 0 ? (
          <Grid cols={cols(1, 2, 3)} gap={16}>
            {filteredVehicles.map((vehicle) => (
              <CarCard key={vehicle.id} vehicle={vehicle} variant="catalog" onPressRent={openCar} onPressDetails={openCar} />
            ))}
          </Grid>
        ) : (
          <Card>
            <EmptyState
              title="No vehicles match your search"
              message={q ? `We couldn't find cars matching "${searchQuery}". Try SUV, Sedan, Electric or Luxury.` : 'No cars in this category right now.'}
              icon={(c) => <SearchX size={22} color={c} />}
              action={<Button label="Clear search and filters" onPress={clearAllFilters} />}
            />
          </Card>
        )}
      </Section>

      {/* --- WHY KEYGO --- */}
      <Section title="Rental, without the headaches" subtitle="Why drivers choose KeyGo">
        <View style={[!isPhone && { flexDirection: 'row', gap: 12 }]}>
          <Card tone="primary" style={[styles.featBigCard, !isPhone && { flex: 1, marginBottom: 0 }]}>
            <Text style={styles.featBigNum}>0%</Text>
            <Text style={styles.featBigTitle}>Hidden fees. Ever.</Text>
            <Text style={styles.featBigDesc}>
              The price you see is the price you pay. Insurance and taxes shown upfront at checkout.
            </Text>
          </Card>
          <View style={!isPhone ? { flex: 1.3 } : undefined}>
            <Grid cols={2} gap={12} style={{ marginBottom: -12 }}>
              {[
                { t: 'Full insurance', d: 'Zero-liability cover on every trip.', Icon: ShieldCheck },
                { t: '60-min delivery', d: 'At your doorstep in major cities.', Icon: Zap },
                { t: 'Unlimited km', d: 'Take the long road. No caps.', Icon: Navigation },
                { t: '24/7 roadside help', d: 'Real people on call, day or night.', Icon: Headphones },
              ].map((f) => (
                <Card key={f.t} style={{ minHeight: 128 }}>
                  <View style={styles.featIcon}>
                    <f.Icon size={20} color={colors.secondaryText} />
                  </View>
                  <Text style={styles.featSmallTitle}>{f.t}</Text>
                  <Text style={styles.featSmallDesc}>{f.d}</Text>
                </Card>
              ))}
            </Grid>
          </View>
        </View>
      </Section>

      {/* --- KEYLESS CTA --- */}
      <Card tone="soft" style={[styles.ctaCard, !isPhone && { flexDirection: 'row', alignItems: 'center', gap: 20 }]}>
        <View style={styles.ctaIcon}>
          <Smartphone size={28} color={colors.onPrimary} />
        </View>
        <View style={[{ flex: isPhone ? undefined : 1 }, isPhone && { alignItems: 'center' }]}>
          <Text style={[styles.ctaTitle, isPhone && { textAlign: 'center' }]}>Unlock your car with your phone</Text>
          <Text style={[styles.ctaSub, isPhone && { textAlign: 'center' }]}>Keyless entry, live trip view and instant extensions.</Text>
        </View>
        <Button label="Try keyless unlock" onPress={() => router.push('/(tabs)/bookings' as any)} icon={(c) => <KeyRound size={16} color={c} />} style={isPhone ? { alignSelf: 'center' } : undefined} />
      </Card>

    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    hero: {
      paddingTop: 8,
    },
    heroEyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    heroEyebrowText: {
      color: colors.primaryText,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    heroTitle: {
      color: colors.txt,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -1.1,
      marginTop: 14,
      marginBottom: 10,
      lineHeight: 40,
    },
    heroTitleDesktop: {
      fontSize: 48,
      lineHeight: 54,
      letterSpacing: -1.6,
    },
    heroAccent: {
      color: colors.primaryText,
    },
    heroLead: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 460,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      paddingVertical: 12,
      maxWidth: 460,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.line,
    },
    statNumber: {
      color: colors.txt,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    statLabel: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 2,
    },
    heroArtBox: {
      position: 'relative',
    },
    floatingTag: {
      position: 'absolute',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      ...boxShadow(colors.shadow, { y: 2, blur: 8, opacity: 0.08 }),
      elevation: 2,
    },
    tagLabel: { color: colors.muted, fontSize: 10 },
    tagVal: { color: colors.txt, fontSize: 12, fontWeight: '800' },

    panelHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    panelTitle: {
      color: colors.txt,
      fontSize: 17,
      fontWeight: '800',
    },

    brandCardItem: {
      width: 96,
      height: 104,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 10,
      gap: 8,
    },
    brandCardItemSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    brandLogoTile: {
      // 3:2 to match the logo canvases; always white because the official
      // artwork is designed for light backgrounds (dark marks like Kia and Audi)
      width: 72,
      height: 48,
      borderRadius: 10,
      backgroundColor: BRAND.white,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 4,
    },
    brandLogoImage: {
      width: '100%',
      height: '100%',
    },
    brandItemName: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
    },

    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
    },
    dotItem: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.lineStrong,
    },
    dotItemActive: {
      width: 20,
      backgroundColor: colors.primary,
    },

    catalogControls: {
      gap: 12,
      marginBottom: 14,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.line,
      paddingLeft: 6,
      paddingRight: 8,
      minHeight: 54,
      gap: 10,
      ...boxShadow(colors.shadow, { y: 4, blur: 12, opacity: 0.06 }),
      elevation: 2,
    },
    searchIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchInput: {
      flex: 1,
      color: colors.txt,
      fontSize: 15,
      paddingVertical: 12,
    },
    searchClear: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.bg2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchCount: {
      backgroundColor: colors.highlightSoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    searchCountText: {
      color: colors.onHighlight,
      fontSize: 12,
      fontWeight: '800',
    },
    catChips: {
      gap: 8,
      paddingVertical: 2,
      paddingRight: 4,
    },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      height: 42,
      paddingLeft: 13,
      paddingRight: 6,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
    },
    catChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    catChipText: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    catCount: {
      minWidth: 26,
      height: 26,
      borderRadius: 13,
      paddingHorizontal: 6,
      backgroundColor: colors.bg2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catCountText: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: '800',
    },

    stepCard: {
      minHeight: 150,
    },
    stepTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    stepIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepNum: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.muted,
      letterSpacing: 0.5,
    },
    stepTitle: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 4,
    },
    stepDesc: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
    },

    featBigCard: {
      padding: 24,
      marginBottom: 12,
      justifyContent: 'center',
    },
    featBigNum: {
      color: colors.highlight,
      fontSize: 44,
      fontWeight: '800',
    },
    featBigTitle: {
      color: colors.onPrimary,
      fontSize: 24,
      fontWeight: '800',
      marginVertical: 6,
    },
    featBigDesc: {
      color: colors.onPrimary,
      opacity: 0.85,
      fontSize: 13,
      lineHeight: 19,
    },
    featIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.secondarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featSmallTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 10,
    },
    featSmallDesc: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
      lineHeight: 16,
    },

    starsRow: {
      flexDirection: 'row',
      gap: 4,
      marginBottom: 10,
    },
    reviewText: {
      color: colors.txt,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 14,
      flexGrow: 1,
    },
    reviewWho: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    whoName: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
    },
    whoTrip: {
      color: colors.muted,
      fontSize: 11,
    },

    ctaCard: {
      marginTop: 28,
      padding: 20,
      gap: 12,
      alignItems: 'flex-start',
    },
    ctaIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    ctaTitle: {
      color: colors.txt,
      fontSize: 18,
      fontWeight: '800',
    },
    ctaSub: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 4,
    },
  });
