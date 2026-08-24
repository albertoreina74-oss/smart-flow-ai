import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildResultHtml(text: string): string {
  const paragraphs = escapeHtml(text)
    .split('\n')
    .map((line) => `<p>${line || '&nbsp;'}</p>`)
    .join('\n');
  return `
    <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; line-height: 1.5; color: #111;">
        <h2 style="margin-bottom: 24px;">Smart Flow AI</h2>
        ${paragraphs}
      </body>
    </html>
  `;
}

async function shareFile(uri: string, mimeType: string, uti: string, dialogTitle: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('La condivisione non è disponibile su questo dispositivo.');
  }
  await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle });
}

export async function exportResultAsPdf(text: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: buildResultHtml(text) });
  await shareFile(uri, 'application/pdf', 'com.adobe.pdf', 'Esporta come PDF');
}

export async function exportResultAsMarkdown(text: string): Promise<void> {
  const file = new File(Paths.cache, `smart-flow-${Date.now()}.md`);
  file.create();
  file.write(text);
  await shareFile(file.uri, 'text/markdown', 'net.daringfireball.markdown', 'Esporta come Markdown');
}
