import React, { useState, useEffect, useRef } from 'react';

interface ImageZoomModalProps {
  imageSrc: string | null;
  onClose: () => void;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  imageSrc,
  onClose,
}) => {
  const [zoomScale, setZoomScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setZoomScale(1);
    setPosition({ x: 0, y: 0 });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (imageSrc) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageSrc, onClose]);

  if (!imageSrc) return null;

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
    if (zoomScale <= 1.05) {
      setZoomScale(2);
    } else {
      handleReset();
    }
  };

  return (
    <div
      className="image-modal-overlay active"
      id="imageZoomModal"
      role="dialog"
      aria-modal="true"
      aria-label="Step Photo Zoom"
      onClick={onClose}
    >
      <div
        className="image-modal-toolbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="image-modal-controls">
          <button
            className="image-modal-btn"
            id="zoomOutBtn"
            aria-label="Zoom out"
            title="Zoom out (−)"
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
            aria-label="Zoom in"
            title="Zoom in (+)"
            onClick={handleZoomIn}
          >
            +
          </button>
          <button
            className="image-modal-btn"
            id="zoomResetBtn"
            title="Reset Zoom"
            onClick={handleReset}
          >
            Reset
          </button>
        </div>
        <button
          className="image-modal-btn"
          id="closeImageModalBtn"
          aria-label="Close image preview"
          style={{ fontSize: '1.15rem', padding: '0.35rem 0.75rem' }}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div
        className="image-modal-content"
        id="imageModalContent"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <img
          id="modalZoomImg"
          className={`zoomable-image ${zoomScale > 1 ? 'is-zoomed' : ''}`}
          src={imageSrc}
          alt="Enlarged dough step visual"
          onClick={toggleImageClick}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoomScale})`,
          }}
        />
      </div>
    </div>
  );
};
