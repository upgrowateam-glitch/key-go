import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { mix, useThemeColors } from '../../theme';

interface KeyGoMarkProps {
  size?: number;
  /** Render the mark on the brand-colored app-icon tile. */
  tile?: boolean;
  /** Key colour; defaults to gold on the tile and primary green without it. */
  color?: string;
}

// Key bow + shaft + tooth, with a forward chevron as the tip ("Go").
// Geometry matches scripts/generate_keygo_assets.py (100x100 viewBox).
export const KeyGoMark: React.FC<KeyGoMarkProps> = ({ size = 32, tile = true, color }) => {
  const colors = useThemeColors();
  const inset = tile ? 'translate(11 11) scale(0.78)' : undefined;
  const keyColor = color ?? (tile ? colors.highlight : colors.primaryText);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="kgTile" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={mix(colors.primary, '#FFFFFF', 0.12)} />
          <Stop offset="1" stopColor={mix(colors.primary, '#000000', 0.15)} />
        </LinearGradient>
      </Defs>
      {tile && (
        <Rect
          x="0.5"
          y="0.5"
          width="99"
          height="99"
          rx="26"
          fill="url(#kgTile)"
          stroke={colors.navLine}
          strokeWidth="1.5"
        />
      )}
      <Path
        transform={inset}
        fill={keyColor}
        d="M46 45.5H79V54.5H46Z M54 50H57.5A2 2 0 0 1 59.5 52V62A2 2 0 0 1 57.5 64H54A2 2 0 0 1 52 62V52A2 2 0 0 1 54 50Z"
      />
      <Circle transform={inset} cx="33" cy="50" r="14" stroke={keyColor} strokeWidth="9" fill="none" />
      <Path
        transform={inset}
        d="M67 36L81 50L67 64"
        stroke={keyColor}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
};

interface KeyGoLogoProps {
  size?: number;
  showText?: boolean;
  showTagline?: boolean;
  /** Wordmark color; defaults to the navigation text color (logo sits on the nav bar). */
  textColor?: string;
  accentColor?: string;
  /** Show the mark on its app-icon tile (default) or as a bare gold key, for photos. */
  tile?: boolean;
}

export const KeyGoLogo: React.FC<KeyGoLogoProps> = ({
  size = 32,
  showText = true,
  showTagline = false,
  textColor,
  accentColor,
  tile = true,
}) => {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <KeyGoMark size={size} tile={tile} color={tile ? undefined : colors.highlight} />

      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.brandName, { color: textColor ?? colors.onNav }]}>
            Key<Text style={{ color: accentColor ?? colors.navActive }}>Go</Text>
          </Text>
          {showTagline && (
            <Text style={[styles.tagline, { color: colors.navInactive }]}>Rent. Unlock. Drive.</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textContainer: {
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: -1,
  },
});
