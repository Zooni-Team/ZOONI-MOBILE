import React, { useRef, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export default function DraggableList({ items, onReorder, renderItem, itemHeight = 66, disabled = false }) {
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [hoverIndex, setHoverIndex]       = useState(null);

  const dragY        = useRef(new Animated.Value(0)).current;
  const startY       = useRef(0);
  const activeIdx    = useRef(null);
  const hoverRef     = useRef(null);
  const containerRef = useRef(null);
  const containerTop = useRef(0);

  hoverRef.current = hoverIndex;

  // Extrae pageY compatible con web (touches[0]) y mobile (pageY directo)
  const getPageY = (e) => {
    if (e.nativeEvent.touches && e.nativeEvent.touches.length > 0) {
      return e.nativeEvent.touches[0].pageY;
    }
    return e.nativeEvent.pageY;
  };

  const measureContainer = () => {
    containerRef.current?.measure((x, y, w, h, px, py) => {
      containerTop.current = py;
    });
  };

  const onTouchStart = (index, e) => {
    if (disabled) return;
    measureContainer();
    startY.current    = getPageY(e);
    activeIdx.current = index;
    dragY.setValue(0);
    setDraggingIndex(index);
    setHoverIndex(index);
  };

  const onTouchMove = (e) => {
    if (activeIdx.current === null) return;
    const pageY = getPageY(e);
    const dy    = pageY - startY.current;
    dragY.setValue(dy);

    const relY = pageY - containerTop.current;
    const over = Math.min(Math.max(0, Math.floor(relY / itemHeight)), items.length - 1);
    setHoverIndex(over);
  };

  const onTouchEnd = () => {
    if (activeIdx.current === null) return;
    const from = activeIdx.current;
    const to   = hoverRef.current !== null ? hoverRef.current : from;

    dragY.setValue(0);
    setDraggingIndex(null);
    setHoverIndex(null);
    activeIdx.current = null;

    if (to !== from) {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorder(next);
    }
  };

  return (
    <View
      ref={containerRef}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {items.map((item, index) => {
        const isDragging = draggingIndex === index;
        const isHover    = hoverIndex === index && draggingIndex !== null && draggingIndex !== index;
        return (
          <Animated.View
            key={item.seccion ?? index}
            style={[
              isDragging && { transform: [{ translateY: dragY }], zIndex: 99, opacity: 0.85 },
              isHover    && styles.hoverTarget,
            ]}
            onTouchStart={(e) => onTouchStart(index, e)}
          >
            {renderItem({ item, index, isDragging })}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hoverTarget: { borderTopWidth: 2, borderTopColor: '#2DBD72' },
});
