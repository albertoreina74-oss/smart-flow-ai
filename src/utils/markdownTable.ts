const SEPARATOR_ROW_PATTERN = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

export function markdownTableToRows(markdown: string): string[][] {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const tableLines = lines.filter((line) => line.includes('|') && !SEPARATOR_ROW_PATTERN.test(line));

  // Falls back to one column per line when the model didn't return a
  // Markdown table (e.g. the user edited the result afterward), so the
  // export still produces a usable file instead of an empty one.
  if (tableLines.length === 0) {
    return lines.map((line) => [line]);
  }

  return tableLines.map((line) =>
    line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim()),
  );
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function markdownTableToCsv(markdown: string): string {
  return rowsToCsv(markdownTableToRows(markdown));
}
