import React, { useEffect, useRef } from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
const FADE_MS = 700;

/**
 * A silent looping video behind a welcome slide (the car driving along the road on slide 1).
 * - The video's first frame is shown as a still while the video loads, and as a cross-fade at the end of each
 *   run: the last frame fades into the first, the video restarts underneath, and the still fades away, so the
 *   loop has no visible jump.
 * - A dark fade at the bottom keeps the slide's text and buttons readable.
 * - With reduced motion the still is shown and the video does not play.
 */
export function VideoBackground({ video, still }: { video: VideoSource; still: ImageSourcePropType }) {
  const reduceMotion = useReducedMotion();
  const cover = useSharedValue(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const player = useVideoPlayer(video, (p) => {
    p.loop = false;
    p.muted = true;
  });

  useEffect(() => {
    if (reduceMotion) return;
    player.play();
    const ended = player.addListener('playToEnd', () => {
      // empty road → back to the start, through the still
      cover.set(withTiming(1, { duration: FADE_MS }));
      timers.current.push(
        setTimeout(() => {
          player.currentTime = 0;
          player.play();
          timers.current.push(setTimeout(() => cover.set(withTiming(0, { duration: FADE_MS })), 350));
        }, FADE_MS)
      );
    });
    const pending = timers.current;
    return () => {
      ended.remove();
      pending.forEach(clearTimeout);
      player.pause();
    };
  }, [player, reduceMotion, cover]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value }));

  return (
    <View style={FILL} pointerEvents="none">
      {!reduceMotion ? (
        <VideoView
          player={player}
          // fill the screen exactly (otherwise the video can be drawn at its own size)
          style={[FILL, { width: '100%', height: '100%' }]}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
          onFirstFrameRender={() => cover.set(withTiming(0, { duration: 400 }))}
        />
      ) : null}
      <Animated.View style={[FILL, coverStyle]}>
        <Image source={still} resizeMode="cover" style={[FILL, { width: '100%', height: '100%' }]} />
      </Animated.View>
      {/* dark fade behind the title and buttons */}
      <Svg style={FILL} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="slideFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#072A20" stopOpacity="0" />
            <Stop offset="0.55" stopColor="#072A20" stopOpacity="0" />
            <Stop offset="0.72" stopColor="#072A20" stopOpacity="0.7" />
            <Stop offset="0.86" stopColor="#072A20" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#072A20" stopOpacity="0.96" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#slideFade)" />
      </Svg>
    </View>
  );
}
