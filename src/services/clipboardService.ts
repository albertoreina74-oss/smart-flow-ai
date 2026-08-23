import * as Clipboard from 'expo-clipboard';

export async function readClipboard(): Promise<string> {
  return Clipboard.getStringAsync();
}

export async function writeClipboard(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

export function hasClipboardListener(): boolean {
  return typeof Clipboard.addClipboardListener === 'function';
}
