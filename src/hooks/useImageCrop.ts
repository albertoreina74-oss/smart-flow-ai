import { useCallback, useRef, useState } from 'react';
import type { CropRequest } from '../components/CropModal';
import type { NormalizedCropRect } from '../services/scanEnhanceService';

type PendingCrop = {
  request: CropRequest;
  resolve: (rect: NormalizedCropRect | null) => void;
};

/**
 * Turns the `CropModal` into something a linear `async` scan flow can simply
 * `await`: `requestCrop` opens the modal and resolves once the user confirms
 * (with their selection) or cancels (with `null`), so the pick → crop → OCR
 * pipeline stays readable top to bottom instead of splitting across callbacks.
 */
export function useImageCrop() {
  const [pending, setPending] = useState<PendingCrop | null>(null);
  const pendingRef = useRef<PendingCrop | null>(null);

  const settle = useCallback((rect: NormalizedCropRect | null) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(rect);
  }, []);

  const requestCrop = useCallback(
    (request: CropRequest) =>
      new Promise<NormalizedCropRect | null>((resolve) => {
        // A crop still on screen would otherwise be orphaned by the new one,
        // leaving its awaiting caller hanging forever.
        pendingRef.current?.resolve(null);
        const next = { request, resolve };
        pendingRef.current = next;
        setPending(next);
      }),
    [],
  );

  const confirmCrop = useCallback((rect: NormalizedCropRect) => settle(rect), [settle]);
  const cancelCrop = useCallback(() => settle(null), [settle]);

  return { cropRequest: pending?.request ?? null, requestCrop, confirmCrop, cancelCrop };
}
