import React, { useState } from 'react';
import { Text, View, ImageBackground, type ImageSourcePropType } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/kit';
import { KeyGoLogo } from '../components/ui/KeyGoLogo';
import { completeOnboarding } from '../services/auth';
import { useThemeColors } from '../theme';

/** Each slide has its own illustrated background (assets/images/onboarding-1..3.jpg). */
const SLIDES: { title: string; body: string; image: ImageSourcePropType }[] = [
  { title: 'Find the right car', body: 'Search the KeyGo fleet by category, fuel and transmission, and see what is free for your dates.', image: require('../../assets/images/onboarding-1.jpg') },
  { title: 'Book in minutes', body: 'Choose daily, weekly or monthly pricing, see the full price breakdown and pay online.', image: require('../../assets/images/onboarding-2.jpg') },
  { title: 'Sign and drive', body: 'Upload your documents once, sign your agreement on your phone and follow your rental from pickup to return.', image: require('../../assets/images/onboarding-3.jpg') },
];

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const finish = (href: string) => {
    completeOnboarding();
    router.replace(href as any);
  };

  return (
    <ImageBackground
      source={slide.image}
      resizeMode="cover"
      // Fit the picture to the screen (otherwise it is drawn at its full 1080 x 1920 size)
      imageStyle={{ width: '100%', height: '100%' }}
      style={{ flex: 1, backgroundColor: colors.nav, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
      <KeyGoLogo size={34} showText />
      {/* The picture fills the top; the words sit lower, on the calm dark part above the buttons */}
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 28 }}>
        <Text style={{ color: colors.onNav, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' }}>{slide.title}</Text>
        <Text style={{ color: colors.navInactive, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 340 }}>{slide.body}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 24 }}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={{ width: i === index ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? colors.navActive : colors.navLine }} />
          ))}
        </View>
      </View>
      {last ? (
        <View style={{ gap: 10 }}>
          <Button label="Create account" variant="highlight" size="lg" fullWidth onPress={() => finish('/register')} />
          <Button label="I already have an account" variant="outline" size="lg" fullWidth onPress={() => finish('/login')} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Button label="Next" variant="highlight" size="lg" fullWidth onPress={() => setIndex(index + 1)} />
          <Button label="Skip" variant="outline" size="lg" fullWidth onPress={() => finish('/login')} />
        </View>
      )}
    </ImageBackground>
  );
}
