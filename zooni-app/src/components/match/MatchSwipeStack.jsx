/**
 * Stack de tarjetas con gestos de swipe y animaciones.
 */

import React, {
  useRef, useCallback, useEffect, forwardRef, useImperativeHandle,
} from 'react';
import {
  View, StyleSheet, Animated, PanResponder, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MatchProfileCard from './MatchProfileCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const FLY_OUT_MS = 200;

const MatchSwipeStack = forwardRef(function MatchSwipeStack({
  perfiles,
  currentIndex,
  cardHeight,
  cardWidth,
  onSwipeLeft,
  onSwipeRight,
  onCardPress,
}, ref) {
  const position = useRef(new Animated.ValueXY()).current;
  const lockedRef = useRef(false);
  const onSwipeLeftRef = useRef(onSwipeLeft);
  const onSwipeRightRef = useRef(onSwipeRight);

  onSwipeLeftRef.current = onSwipeLeft;
  onSwipeRightRef.current = onSwipeRight;

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH * 0.2],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const nopeOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.2, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const resetPosition = useCallback(() => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
  }, [position]);

  const flyOut = useCallback((direction, callback) => {
    if (lockedRef.current) return;
    lockedRef.current = true;

    const x = direction === 'right' ? SCREEN_WIDTH * 1.15 : -SCREEN_WIDTH * 1.15;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      lockedRef.current = false;
      callback?.();
    };

    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: FLY_OUT_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished !== false) finish();
    });

    setTimeout(finish, FLY_OUT_MS + 40);
  }, [position]);

  useEffect(() => {
    position.setValue({ x: 0, y: 0 });
    lockedRef.current = false;
  }, [currentIndex, position]);

  useImperativeHandle(ref, () => ({
    flyOut,
    isLocked: () => lockedRef.current,
  }), [flyOut]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        !lockedRef.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
      onPanResponderMove: (_, { dx, dy }) => {
        position.setValue({ x: dx, y: dy * 0.15 });
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        if (lockedRef.current) return;
        if (dx > SWIPE_THRESHOLD || vx > 0.45) {
          flyOut('right', () => onSwipeRightRef.current?.());
        } else if (dx < -SWIPE_THRESHOLD || vx < -0.45) {
          flyOut('left', () => onSwipeLeftRef.current?.());
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const current = perfiles[currentIndex];
  const next = perfiles[currentIndex + 1];

  if (!current) return null;

  return (
    <View style={[styles.stack, { height: cardHeight, width: cardWidth }]}>
      {next && (
        <View style={[styles.behindCard, { height: cardHeight, width: cardWidth }]}>
          <MatchProfileCard
            perfil={next}
            cardHeight={cardHeight}
            cardWidth={cardWidth}
          />
        </View>
      )}

      <Animated.View
        style={[
          styles.topCard,
          {
            transform: [
              { translateX: position.x },
              { translateY: position.y },
              { rotate },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <MatchProfileCard
          perfil={current}
          cardHeight={cardHeight}
          cardWidth={cardWidth}
          onPress={onCardPress ? () => onCardPress(current) : undefined}
        />

        <Animated.View style={[styles.overlayLike, { opacity: likeOpacity }]} pointerEvents="none">
          <Ionicons name="heart" size={64} color="#2DBD72" />
        </Animated.View>
        <Animated.View style={[styles.overlayNope, { opacity: nopeOpacity }]} pointerEvents="none">
          <Ionicons name="close" size={64} color="#E63946" />
        </Animated.View>
      </Animated.View>
    </View>
  );
});

export default MatchSwipeStack;

const styles = StyleSheet.create({
  stack: { alignItems: 'center', justifyContent: 'center' },
  behindCard: {
    position: 'absolute',
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  topCard: { position: 'absolute', width: '100%', height: '100%' },
  // El sello aparece del lado hacia el que se desliza: corazón a la DERECHA
  // (swipe derecha = like), X a la IZQUIERDA (swipe izquierda = rechazo).
  overlayLike: {
    position: 'absolute', top: 36, right: 20,
    borderWidth: 4, borderColor: '#2DBD72', borderRadius: 12, padding: 6,
  },
  overlayNope: {
    position: 'absolute', top: 36, left: 20,
    borderWidth: 4, borderColor: '#E63946', borderRadius: 12, padding: 6,
  },
});
