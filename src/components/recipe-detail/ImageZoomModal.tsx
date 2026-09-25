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
    // Reset zoom when image changes
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
      role="dialog"
      aria-modal="true"
      aria-label="Photo Lightbox"
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md select-none animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
    >
      {/* Top Toolbar */}
      <div
        className="flex justify-between items-center px-5 py-3 bg-black/50 border-b border-white/10 text-white z-10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded font-bold text-sm cursor-pointer"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-xs font-semibold min-w-[48px] text-center">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded font-bold text-sm cursor-pointer"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded font-semibold text-xs cursor-pointer ml-1"
          >
            Reset
          </button>
        </div>

        <button
          onClick={onClose}
          className="px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded font-bold text-sm cursor-pointer"
          aria-label="Close image modal"
        >
          ✕
        </button>
      </div>

      {/* Content Frame */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center p-6 relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <img
          src={imageSrc}
          alt="Enlarged photo"
          onClick={toggleImageClick}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoomScale})`,
            cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          }}
          className="max-w-[90vw] max-h-[82vh] object-contain rounded-lg shadow-2xl transition-transform duration-150"
        />
      </div>
    </div>
  );
};
