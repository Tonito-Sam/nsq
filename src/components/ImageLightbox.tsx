import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  images: string[];
  open: boolean;
  initialIndex?: number;
  onClose: () => void;
}

const ImageLightbox: React.FC<Props> = ({ images, open, initialIndex = 0, onClose }) => {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setIndex(initialIndex || 0);
  }, [open, initialIndex]);

  useEffect(() => {
    // reset zoom/translate when image changes or modal closes/opens
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setIsPanning(false);
    panStart.current = null;
  }, [index, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, images.length, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <button
          aria-label="Close image"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded bg-black/40 text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <button
          aria-label="Previous image"
          onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 z-20 p-2 rounded bg-black/30 text-white"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button
          aria-label="Next image"
          onClick={() => setIndex((i) => (i + 1) % images.length)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 z-20 p-2 rounded bg-black/30 text-white"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        <div
          ref={containerRef}
          className="w-full h-auto max-h-[90vh] rounded overflow-hidden bg-black/90 flex items-center justify-center touch-none"
          onDoubleClick={() => {
            // toggle reset / zoom
            if (scale === 1) setScale(2);
            else {
              setScale(1);
              setTranslate({ x: 0, y: 0 });
            }
          }}
          onWheel={(e) => {
            e.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const cursorX = e.clientX - rect.left;
            const cursorY = e.clientY - rect.top;
            const prevScale = scale;
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            let nextScale = Math.min(4, Math.max(1, prevScale * delta));

            // compute new translate so zoom is centered at cursor
            const nx = (translate.x - cursorX) * (nextScale / prevScale) + cursorX;
            const ny = (translate.y - cursorY) * (nextScale / prevScale) + cursorY;

            setScale(nextScale);
            setTranslate({ x: nx, y: ny });
          }}
          onMouseDown={(e) => {
            if (scale <= 1) return;
            setIsPanning(true);
            panStart.current = { x: e.clientX, y: e.clientY };
          }}
          onMouseMove={(e) => {
            if (!isPanning || !panStart.current) return;
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;
            panStart.current = { x: e.clientX, y: e.clientY };
            setTranslate((t) => ({ x: t.x + dx, y: t.y + dy }));
          }}
          onMouseUp={() => {
            setIsPanning(false);
            panStart.current = null;
          }}
          onMouseLeave={() => {
            setIsPanning(false);
            panStart.current = null;
          }}
        >
          <img
            src={images[index]}
            alt={`image-${index}`}
            draggable={false}
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transition: isPanning ? 'none' : 'transform 120ms ease-out',
              maxHeight: '90vh',
              objectFit: 'contain'
            }}
            className="select-none"
          />
        </div>

        {images.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2 overflow-auto">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setIndex(idx)}
                className={`w-16 h-16 rounded overflow-hidden border ${index === idx ? 'ring-2 ring-purple-500' : 'border-transparent'}`}
              >
                <img src={img} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageLightbox;
