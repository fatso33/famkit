import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { useBackStep } from '../../hooks/useBackStep';
import { UiTranslations } from '../../i18n/translations';

interface ImageZoomModalProps {
  imageSrc: string;
  /** Pass false when the browser already animated it (the iOS back swipe). */
  onClose: (animated?: boolean) => void;
  t: UiTranslations;
}

// Mount only while open, keyed by imageSrc so zoom/pan state resets per image.
export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ imageSrc, onClose, t }) => {
  const [zoomScale, setZoomScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const didPan = useRef(false);
  const backdropProps = useDialogDismiss(() => onClose());
  // The back gesture closes the photo, back to the page it was opened from.
  useBackStep(true, onClose);

  // Lock page scroll behind the lightbox.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Setters only, so these stay the same across renders and the key listener is added once.
  const handleZoomIn = useCallback(
    () => setZoomScale((prev) => Math.min(3.5, Number((prev + 0.35).toFixed(2)))),
    [],
  );

  const handleZoomOut = useCallback(
    () =>
      setZoomScale((prev) => {
        const next = Math.max(1, Number((prev - 0.35).toFixed(2)));
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      }),
    [],
  );

  const handleReset = useCallback(() => {
    setZoomScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Keyboard zoom, standing in for the zoom buttons the viewer no longer shows.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') handleZoomIn();
      else if (e.key === '-' || e.key === '−') handleZoomOut();
      else if (e.key === '0') handleReset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleZoomIn, handleZoomOut, handleReset]);

  const focusOnOpen = useCallback((button: HTMLButtonElement | null) => {
    button?.focus({ preventScroll: true });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    didPan.current = false;
    if (zoomScale > 1) {
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomScale > 1) {
      didPan.current = true;
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const toggleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (didPan.current) return; // The click that ends a pan isn't a zoom toggle.
    if (zoomScale <= 1.05) {
      setZoomScale(2);
    } else {
      handleReset();
    }
  };

  return (
    // Backdrop click is a mouse shortcut; keyboard users close with Escape (useDialogDismiss).
    <div
      className="image-modal-overlay active"
      id="imageZoomModal"
      role="dialog"
      aria-modal="true"
      aria-label={t.photoZoomDialog}
      {...backdropProps}
    >
      {/* On screen, the photo closes with the back button in the menu button's place (FloatingMenu)
          or a tap beside it. This one is for the keyboard and screen readers, which start here. */}
      <button
        ref={focusOnOpen}
        type="button"
        className="sr-only"
        id="closeImageModalBtn"
        onClick={() => onClose()}
      >
        {t.closePhotoPreview}
      </button>

      {/* Drag-to-pan, wheel zoom, click-to-zoom and click-empty-space-to-close are mouse
          conveniences; from the keyboard, + and − zoom, 0 resets and Escape closes. */}
      {/* eslint-disable-next-line jsx-a11y-x/no-static-element-interactions, jsx-a11y-x/click-events-have-key-events */}
      <div
        className="image-modal-content"
        id="imageModalContent"
        // Press start is recorded by the overlay's onMouseDown as the event bubbles.
        onClick={backdropProps.onClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* eslint-disable-next-line jsx-a11y-x/click-events-have-key-events, jsx-a11y-x/no-noninteractive-element-interactions */}
        <img
          id="modalZoomImg"
          className={`zoomable-image ${zoomScale > 1 ? 'is-zoomed' : ''}`}
          src={imageSrc}
          alt={t.enlargedPhotoAlt}
          onClick={toggleImageClick}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoomScale})`,
          }}
        />
      </div>
    </div>
  );
};
