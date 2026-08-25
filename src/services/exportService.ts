import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { markdownTableToCsv } from '../utils/markdownTable';
import { buildDocxBytes } from '../utils/docxBuilder';

export type PdfQuality = 'high' | 'compact';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const PDF_QUALITY_STYLES: Record<PdfQuality, { fontSize: number; lineHeight: number; padding: number; signatureWidth: number }> = {
  high: { fontSize: 15, lineHeight: 1.6, padding: 40, signatureWidth: 180 },
  // Smaller font, tighter spacing and margins produce noticeably fewer
  // pages (and therefore a smaller file) for longer results — the only
  // lever expo-print's HTML-to-PDF rendering exposes, since it doesn't
  // support raster/image-quality compression directly.
  compact: { fontSize: 11, lineHeight: 1.35, padding: 20, signatureWidth: 110 },
};

function buildResultHtml(text: string, signatureDataUri?: string, quality: PdfQuality = 'high'): string {
  const { fontSize, lineHeight, padding, signatureWidth } = PDF_QUALITY_STYLES[quality];
  const paragraphs = escapeHtml(text)
    .split('\n')
    .map((line) => `<p>${line || '&nbsp;'}</p>`)
    .join('\n');
  const signatureBlock = signatureDataUri
    ? `
        <div style="margin-top: ${quality === 'high' ? 56 : 32}px; display: flex; flex-direction: column; align-items: flex-end;">
          <img src="${signatureDataUri}" style="width: ${signatureWidth}px; height: auto;" />
          <div style="width: ${signatureWidth}px; border-top: 1px solid #999; margin-top: 4px; padding-top: 4px; font-size: 11px; color: #666; text-align: center;">
            Firmato digitalmente
          </div>
        </div>
      `
    : '';
  return `
    <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; padding: ${padding}px; line-height: ${lineHeight}; font-size: ${fontSize}px; color: #111;">
        <h2 style="margin-bottom: 24px;">Smart Flow AI</h2>
        ${paragraphs}
        ${signatureBlock}
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

export async function exportResultAsPdf(
  text: string,
  signatureDataUri?: string,
  quality: PdfQuality = 'high',
): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: buildResultHtml(text, signatureDataUri, quality) });
  await shareFile(uri, 'application/pdf', 'com.adobe.pdf', 'Esporta come PDF');
}

/** Opens the native print sheet (AirPrint on iOS) instead of exporting a file. */
export async function printResult(
  text: string,
  signatureDataUri?: string,
  quality: PdfQuality = 'high',
): Promise<void> {
  await Print.printAsync({ html: buildResultHtml(text, signatureDataUri, quality) });
}

export async function exportResultAsMarkdown(text: string): Promise<void> {
  const file = new File(Paths.cache, `smart-flow-${Date.now()}.md`);
  file.create();
  file.write(text);
  await shareFile(file.uri, 'text/markdown', 'net.daringfireball.markdown', 'Esporta come Markdown');
}

export async function exportResultAsTxt(text: string): Promise<void> {
  const file = new File(Paths.cache, `smart-flow-${Date.now()}.txt`);
  file.create();
  file.write(text);
  await shareFile(file.uri, 'text/plain', 'public.plain-text', 'Esporta come TXT');
}

export async function exportResultAsDocx(text: string): Promise<void> {
  const bytes = await buildDocxBytes(text);
  const file = new File(Paths.cache, `smart-flow-${Date.now()}.docx`);
  file.create();
  file.write(bytes);
  await shareFile(
    file.uri,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'org.openxmlformats.wordprocessingml.document',
    'Esporta come Word',
  );
}

export async function exportResultAsCsv(text: string): Promise<void> {
  const csv = markdownTableToCsv(text);
  const file = new File(Paths.cache, `smart-flow-${Date.now()}.csv`);
  file.create();
  file.write(csv);
  await shareFile(file.uri, 'text/csv', 'public.comma-separated-values-text', 'Esporta come CSV');
}
