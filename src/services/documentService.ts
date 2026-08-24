import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

export type PickedDocument =
  | { kind: 'text'; text: string }
  | { kind: 'binary'; base64: string; mimeType: string };

const TEXT_MIME_TYPES = new Set(['text/plain']);

export async function pickDocument(): Promise<PickedDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'application/octet-stream';
  const file = new File(asset.uri);

  if (TEXT_MIME_TYPES.has(mimeType)) {
    const text = await file.text();
    return { kind: 'text', text };
  }

  const base64 = await file.base64();
  return { kind: 'binary', base64, mimeType };
}
