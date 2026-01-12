import { useEffect, useCallback, useRef } from 'react';

export interface ShortcutHandler {
  key: string;
  handler: () => void;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description?: string;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Hook to register keyboard shortcuts.
 *
 * Supported shortcuts for annotation workflow:
 * - ArrowRight / Enter: Next question
 * - ArrowLeft: Previous question
 * - D: Toggle draw mode
 * - R: Read text from box (AI)
 * - S: Skip question
 * - Escape: Cancel drawing
 * - Ctrl+Enter: Finalize annotation
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutHandler[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true, preventDefault = true } = options;

  // Store shortcuts in ref to avoid re-registering on every render
  const shortcutsRef = useRef<ShortcutHandler[]>(shortcuts);

  // Update ref in an effect to avoid updating during render
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape to work even in inputs
        if (event.key !== 'Escape') {
          return;
        }
      }

      const shortcut = shortcutsRef.current.find((s) => {
        const keyMatch = s.key.toLowerCase() === event.key.toLowerCase();
        const ctrlMatch = !!s.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!s.shift === event.shiftKey;
        const altMatch = !!s.alt === event.altKey;

        return keyMatch && ctrlMatch && shiftMatch && altMatch;
      });

      if (shortcut) {
        if (preventDefault) {
          event.preventDefault();
        }
        shortcut.handler();
      }
    },
    [enabled, preventDefault]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

/**
 * Predefined keyboard shortcuts for annotation workflow
 */
export const ANNOTATION_SHORTCUTS = {
  NEXT_QUESTION: 'ArrowRight',
  PREV_QUESTION: 'ArrowLeft',
  TOGGLE_DRAW: 'd',
  READ_TEXT: 'r',
  SKIP_QUESTION: 's',
  CANCEL: 'Escape',
  FINALIZE: 'Enter', // with Ctrl
} as const;

/**
 * Create a keyboard shortcut handler for annotation workflow
 */
export function createAnnotationShortcuts(handlers: {
  onNext?: () => void;
  onPrev?: () => void;
  onToggleDraw?: () => void;
  onRead?: () => void;
  onSkip?: () => void;
  onCancel?: () => void;
  onFinalize?: () => void;
}): ShortcutHandler[] {
  const shortcuts: ShortcutHandler[] = [];

  if (handlers.onNext) {
    shortcuts.push({
      key: ANNOTATION_SHORTCUTS.NEXT_QUESTION,
      handler: handlers.onNext,
      description: 'Next question',
    });
  }

  if (handlers.onPrev) {
    shortcuts.push({
      key: ANNOTATION_SHORTCUTS.PREV_QUESTION,
      handler: handlers.onPrev,
      description: 'Previous question',
    });
  }

  if (handlers.onToggleDraw) {
    shortcuts.push({
      key: ANNOTATION_SHORTCUTS.TOGGLE_DRAW,
      handler: handlers.onToggleDraw,
      description: 'Toggle draw mode',
    });
  }

  if (handlers.onRead) {
    shortcuts.push({
      key: ANNOTATION_SHORTCUTS.READ_TEXT,
      handler: handlers.onRead,
      description: 'Read text from box (AI)',
    });
  }

  if (handlers.onSkip) {
    shortcuts.push({
      key: ANNOTATION_SHORTCUTS.SKIP_QUESTION,
      handler: handlers.onSkip,
      description: 'Skip question',
    });
  }

  if (handlers.onCancel) {
    shortcuts.push({
      key: ANNOTATION_SHORTCUTS.CANCEL,
      handler: handlers.onCancel,
      description: 'Cancel drawing',
    });
  }

  if (handlers.onFinalize) {
    shortcuts.push({
      key: ANNOTATION_SHORTCUTS.FINALIZE,
      handler: handlers.onFinalize,
      ctrl: true,
      description: 'Finalize annotation',
    });
  }

  return shortcuts;
}
