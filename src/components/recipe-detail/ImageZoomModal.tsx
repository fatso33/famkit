import React, { useState, useEffect, useRef } from 'react';
import { useDialogDismiss } from '../../hooks/useDialogDismiss';
import { UiTranslations } from '../../i18n/translations';

interface ImageZoomModalProps {
  imageSrc: string;
  onClose: () => void;
  t: UiTranslations;
}

// Mount only while open, keyed by imageSrc so zoom/pan state resets per image.
export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ imageSrc, onClose, t }) => {
  const [zoomScale, setZoomScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const didPan = useRef(false);
  const backdropProps = useDialogDismiss(onClose);

  // Lock page scroll behind the lightbox.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleZoomIn = () =>
    setZoomScale((prev) => Math.min(3.5, Number((prev + 0.35).toFixed(2))));

  const handleZoomOut = () =>
    setZoomScale((prev) => {
      const next = Math.max(1, Number((prev - 0.35).toFixed(2)));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });

  const handleReset = () => {
    setZoomScale(1);
    setPosition({ x: 0, y: 0 });
  };

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
      <div className="image-modal-toolbar">
        <div className="image-modal-controls">
          <button
            className="image-modal-btn"
            id="zoomOutBtn"
            aria-label={t.zoomOut}
            title={t.zoomOut}
            onClick={handleZoomOut}
          >
            −
          </button>
          <span
            id="zoomLevelText"
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              minWidth: '48px',
              textAlign: 'center',
            }}
          >
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            className="image-modal-btn"
            id="zoomInBtn"
            aria-label={t.zoomIn}
            title={t.zoomIn}
            onClick={handleZoomIn}
          >
            +
          </button>
          <button
            className="image-modal-btn"
            id="zoomResetBtn"
            title={t.zoomResetTitle}
            onClick={handleReset}
          >
            {t.zoomReset}
          </button>
        </div>
        <button
          className="image-modal-btn"
          id="closeImageModalBtn"
          aria-label={t.closePhotoPreview}
          style={{ fontSize: '1.15rem', padding: '0.35rem 0.75rem' }}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Drag-to-pan, wheel zoom, click-to-zoom and click-empty-space-to-close are mouse
          conveniences; the toolbar buttons and Escape cover the same actions from the keyboard. */}
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
