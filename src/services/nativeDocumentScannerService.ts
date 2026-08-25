import { Platform } from 'react-native';
import type { ScanDocumentResponse } from 'react-native-document-scanner-plugin';

type ScannerModule = {
  scanDocument: (options?: { croppedImageQuality?: number }) => Promise<ScanDocumentResponse>;
};

let scannerModule: ScannerModule | null | undefined;

// The native module resolves eagerly (TurboModuleRegistry.getEnforcing) as
// soon as its file is evaluated, which throws on any environment where it
// isn't compiled in (web preview, Expo Go, a dev client built before this
// dependency was added). A static top-level import would crash immediately;
// requiring it lazily, only on iOS, and inside a try/catch keeps every other
// environment on the ImagePicker-based fallback in imagePickerService.ts.
function loadScanner(): ScannerModule | null {
  if (scannerModule !== undefined) {
    return scannerModule;
  }
  if (Platform.OS !== 'ios') {
    scannerModule = null;
    return scannerModule;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-document-scanner-plugin');
    scannerModule = (mod?.default ?? mod) as ScannerModule;
  } catch {
    scannerModule = null;
  }
  return scannerModule;
}

export function isNativeDocumentScannerAvailable(): boolean {
  return loadScanner() !== null;
}

export type NativeScanOutcome = {
  imageUris: string[];
  cancelled: boolean;
};

export async function scanDocumentPagesNative(): Promise<NativeScanOutcome | null> {
  const scanner = loadScanner();
  if (!scanner) {
    return null;
  }
  try {
    const response = await scanner.scanDocument({ croppedImageQuality: 92 });
    if (response.status === 'cancel') {
      return { imageUris: [], cancelled: true };
    }
    return { imageUris: response.scannedImages ?? [], cancelled: false };
  } catch {
    return null;
  }
}
