import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Ellipse, Path, Line, Rect, Circle } from 'react-native-svg';
import { CarKind } from '../../types';

interface CarIllustrationProps {
  color?: string;
  kind?: CarKind;
  width?: number;
  height?: number;
}

export const CarIllustration: React.FC<CarIllustrationProps> = ({
  color = '#3D7BFF',
  kind = 'suv',
  width = 280,
  height = 120,
}) => {
  const roofPaths: Record<CarKind, string> = {
    suv: 'M70 70 L110 38 H225 L262 70',
    sedan: 'M80 72 L125 42 H215 L258 72',
    sport: 'M95 74 L150 46 H220 L270 76',
    ev: 'M78 72 L128 40 H222 L262 72',
  };

  const roof = roofPaths[kind] || roofPaths.suv;
  const h = kind === 'suv' ? 70 : kind === 'sport' ? 76 : 72;

  // Window path calculation
  const windowPath = roof.replace(/^M(\d+) (\d+)/, (_, a, b) => `M${+a + 14} ${+b - 2}`);

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg viewBox="0 0 340 150" width="100%" height="100%">
        {/* Ground Shadow */}
        <Ellipse cx="170" cy="132" rx="150" ry="8" fill="#000000" opacity={0.5} />
        
        {/* Car Main Body */}
        <Path
          d={`${roof} L300 ${h + 6} Q318 ${h + 10} 318 ${h + 26} V112 Q318 118 310 118 H28 Q20 118 20 110 V${h + 20} Q22 ${h + 4} 50 ${h} Z`}
          fill={color}
        />
        
        {/* Glass Tint / Windows */}
        <Path d={`${windowPath} Z`} fill="#0d1117" opacity={0.85} />
        
        {/* Door Pillar Line */}
        <Line
          x1="170"
          y1={kind === 'suv' ? 40 : 44}
          x2="170"
          y2={h}
          stroke={color}
          strokeWidth={5}
        />
        
        {/* Side Trim Accent */}
        <Path d={`M20 ${h + 34} H318`} stroke="#000000" strokeOpacity={0.25} strokeWidth={2} />
        
        {/* Headlight (Warm Light) */}
        <Rect x="296" y={h + 12} width="20" height="7" rx="3" fill="#fff8d0" />
        
        {/* Taillight (Red Accent) */}
        <Rect x="22" y={h + 14} width="14" height="7" rx="3" fill="#ff4d5e" />
        
        {/* Wheels */}
        {[88, 254].map((x, idx) => (
          <React.Fragment key={idx}>
            <Circle cx={x} cy="116" r="24" fill="#0b0d10" />
            <Circle cx={x} cy="116" r="13" fill="#3a424d" />
            <Circle cx={x} cy="116" r="5" fill="#8a94a3" />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
