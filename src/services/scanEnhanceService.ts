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

const MAX_WIDTH = 1600;
const BORDER_TRIM_RATIO = 0.025;

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
