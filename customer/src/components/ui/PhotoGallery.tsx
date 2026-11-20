import React, { useRef, useState } from 'react';
import { Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { API_URL } from '../../lib/api';
import { useThemeColors } from '../../theme';

export interface GalleryPhoto {
  slot: string;
  label: string;
  /** Server path, e.g. /public/vehicles/car-1/photos/<file id>. */
  path: string;
}

/**
 * All the views of a car, main photo first: swipe left/right or use the arrows; dots and a label show which view
 * is on screen. Fills its parent (give the parent the photo's aspect ratio).
 */
export function PhotoGallery({ photos, carName }: { photos: GalleryPhoto[]; carName: string }) {
  const colors = useThemeColors();
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const last = photos.length - 1;

  const go = (i: number) => {
    const next = Math.max(0, Math.min(last, i));
    setIndex(next);
    scroller.current?.scrollTo({ x: next * width, animated: true });
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i <= last) setIndex(i);
  };

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        accessibilityLabel={`Photos of ${carName}`}>
        {photos.map((p) => (
          <View key={p.slot} style={{ width: width || 1, height: '100%', backgroundColor: '#EEF0EF' }}>
            <Image source={{ uri: `${API_URL}${p.path}` }} resizeMode="contain" style={styles.fill} accessibilityLabel={`${carName}: ${p.label}`} />
          </View>
        ))}
      </ScrollView>

      {photos.length > 1 ? (
        <>
          {index > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" onPress={() => go(index - 1)} style={[styles.arrow, { left: 10 }]} hitSlop={8}>
              <ChevronLeft size={22} color="#FFFFFF" />
            </Pressable>
          ) : null}
          {index < last ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Next photo" onPress={() => go(index + 1)} style={[styles.arrow, { right: 10 }]} hitSlop={8}>
              <ChevronRight size={22} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <View style={styles.label}>
            <Text style={styles.labelText}>
              {photos[index]?.label} · {index + 1}/{photos.length}
            </Text>
          </View>
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {photos.map((p, i) => (
              <Pressable key={p.slot} onPress={() => go(i)} hitSlop={6}>
                <View style={[styles.dot, { backgroundColor: i === index ? colors.highlight : 'rgba(255,255,255,0.7)', width: i === index ? 18 : 7 }]} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  labelText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  dot: { height: 7, borderRadius: 4 },
});
