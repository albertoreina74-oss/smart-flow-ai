import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export type EnhancedScan = {
  uri: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
};

/**
 * A crop area expressed as fractions (0..1) of the source image, so it can be
 * drawn against a scaled-down on-screen preview and still map back onto the
 * full-resolution original.
 */
export type NormalizedCropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

const MAX_WIDTH = 1600;
const BORDER_TRIM_RATIO = 0.025;

function coversWholeFrame(rect: NormalizedCropRect) {
  return (
    rect.originX <= 0.005 && rect.originY <= 0.005 && rect.width >= 0.995 && rect.height >= 0.995
  );
}

export async function enhanceScanImage(
  uri: string,
  originalWidth: number,
  originalHeight: number,
): Promise<EnhancedScan> {
  const trimX = Math.round(originalWidth * BORDER_TRIM_RATIO);
  const trimY = Math.round(originalHeight * BORDER_TRIM_RATIO);
  const cropWidth = Math.max(1, originalWidth - trimX * 2);
  const cropHeight = Math.max(1, originalHeight - trimY * 2);

  const result = await manipulateAsync(
    uri,
    [
      { crop: { originX: trimX, originY: trimY, width: cropWidth, height: cropHeight } },
      { resize: { width: Math.min(MAX_WIDTH, cropWidth) } },
    ],
    { base64: true, compress: 0.92, format: SaveFormat.JPEG },
  );

  if (!result.base64) {
    throw new Error("Impossibile elaborare l'immagine scansionata.");
  }

  return {
    uri: result.uri,
    base64: result.base64,
    mimeType: 'image/jpeg',
    width: result.width,
    height: result.height,
  };
}

/**
 * Crops a scan down to the area the user selected in `CropModal`, then feeds
 * only that region into the OCR-bound encode step.
 */
export async function cropAndEnhanceScanImage(
  uri: string,
  originalWidth: number,
  originalHeight: number,
  rect: NormalizedCropRect,
): Promise<EnhancedScan> {
  // A hand-drawn selection is already exactly the area the user wants, so the
  // blind border trim `enhanceScanImage` applies would eat into their choice.
  // It's only still useful when they confirmed without narrowing anything,
  // where it goes on shaving the usual camera-edge junk.
  if (coversWholeFrame(rect)) {
    return enhanceScanImage(uri, originalWidth, originalHeight);
  }

  const originX = clampOrigin(Math.round(rect.originX * originalWidth), originalWidth - 1);
  const originY = clampOrigin(Math.round(rect.originY * originalHeight), originalHeight - 1);
  const cropWidth = clampSize(Math.round(rect.width * originalWidth), originalWidth - originX);
  const cropHeight = clampSize(Math.round(rect.height * originalHeight), originalHeight - originY);

  const result = await manipulateAsync(
    uri,
    [
      { crop: { originX, originY, width: cropWidth, height: cropHeight } },
      { resize: { width: Math.min(MAX_WIDTH, cropWidth) } },
    ],
    { base64: true, compress: 0.92, format: SaveFormat.JPEG },
  );

  if (!result.base64) {
    throw new Error("Impossibile elaborare l'area selezionata.");
  }

  return {
    uri: result.uri,
    base64: result.base64,
    mimeType: 'image/jpeg',
    width: result.width,
    height: result.height,
  };
}

function clampOrigin(value: number, max: number) {
  return Math.max(0, Math.min(value, Math.max(0, max)));
}

function clampSize(value: number, max: number) {
  return Math.max(1, Math.min(value, Math.max(1, max)));
}

// For pages captured via the native VisionKit scanner: the contour
// detection, perspective correction and crop already happened on-device, so
// this only normalizes size/encoding for upload — re-cropping would cut into
// an already-tight edge.
export async function normalizeNativeScan(uri: string): Promise<EnhancedScan> {
  const { width } = await getImageSize(uri);
  const actions = width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];

  const result = await manipulateAsync(uri, actions, {
    base64: true,
    compress: 0.92,
    format: SaveFormat.JPEG,
  });

  if (!result.base64) {
    throw new Error("Impossibile elaborare l'immagine scansionata.");
  }

  return {
    uri: result.uri,
    base64: result.base64,
    mimeType: 'image/jpeg',
    width: result.width,
    height: result.height,
  };
}
