import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
  shouldPreventDefault?: boolean;
}

interface UseLongPressReturn {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

/* 手指移動超過此距離視為捲動：取消長按，也不觸發 click */
const MOVE_THRESHOLD_PX = 10;

export const useLongPress = ({
  onLongPress,
  onClick,
  delay = 800,
  shouldPreventDefault = true
}: UseLongPressOptions): UseLongPressReturn => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef<boolean>(false);
  const hasMovedRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback((event: React.MouseEvent | React.TouchEvent, x: number, y: number) => {
    if (shouldPreventDefault) {
      event.preventDefault();
      event.stopPropagation();
    }

    isLongPressRef.current = false;
    hasMovedRef.current = false;
    startPosRef.current = { x, y };

    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay, shouldPreventDefault]);

  const cancelTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMove = useCallback((x: number, y: number) => {
    if (!startPosRef.current || hasMovedRef.current) return;
    const dx = x - startPosRef.current.x;
    const dy = y - startPosRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
      hasMovedRef.current = true;
      cancelTimer();
    }
  }, [cancelTimer]);

  const clear = useCallback((event: React.MouseEvent | React.TouchEvent, shouldTriggerClick = true) => {
    if (shouldPreventDefault) {
      event.preventDefault();
      event.stopPropagation();
    }

    cancelTimer();

    if (shouldTriggerClick && !isLongPressRef.current && !hasMovedRef.current && onClick) {
      onClick();
    }
    startPosRef.current = null;
  }, [onClick, shouldPreventDefault, cancelTimer]);

  return {
    onMouseDown: (e: React.MouseEvent) => start(e, e.clientX, e.clientY),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchStart: (e: React.TouchEvent) => start(e, e.touches[0].clientX, e.touches[0].clientY),
    onTouchMove: (e: React.TouchEvent) => handleMove(e.touches[0].clientX, e.touches[0].clientY),
    onTouchEnd: (e: React.TouchEvent) => clear(e)
  };
};
