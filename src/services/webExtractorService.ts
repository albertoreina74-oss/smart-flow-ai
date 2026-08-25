const JINA_READER_ROOT = 'https://r.jina.ai/';
const REQUEST_TIMEOUT_MS = 25000;

export type ExtractedArticle = {
  title: string;
  content: string;
  url: string;
};

/** Adds a scheme if the user typed a bare domain, then validates the result is a real URL. */
function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Inserisci un indirizzo web.');
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    // eslint-disable-next-line no-new
    new URL(withScheme);
  } catch {
    throw new Error('Indirizzo web non valido. Controlla e riprova.');
  }
  return withScheme;
}

type JinaReaderResponse = {
  code?: number;
  message?: string;
  readableMessage?: string;
  data?: {
    title?: string;
    content?: string;
    url?: string;
  } | null;
};

/**
 * Extracts a clean title + main-content text from any public web page via
 * the Jina AI Reader service (`r.jina.ai`), which strips navigation, ads and
 * boilerplate HTML server-side and returns readable article text.
 */
export async function extractArticleFromUrl(rawUrl: string): Promise<ExtractedArticle> {
  const targetUrl = normalizeUrl(rawUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${JINA_READER_ROOT}${targetUrl}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Tempo scaduto durante il caricamento della pagina. Riprova.');
    }
    throw new Error('Connessione assente o instabile. Controlla la rete e riprova.');
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: JinaReaderResponse | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || (payload.code ?? 200) >= 400) {
    if (response.status === 422) {
      throw new Error('Indirizzo web non raggiungibile. Controlla che sia corretto.');
    }
    if (response.status === 429) {
      throw new Error('Troppe richieste di estrazione in questo momento. Riprova tra poco.');
    }
    throw new Error(
      payload?.readableMessage || payload?.message || `Impossibile estrarre il contenuto (errore ${response.status}).`,
    );
  }

  const title = payload.data?.title?.trim() || 'Senza titolo';
  const content = payload.data?.content?.trim() || '';

  if (!content) {
    throw new Error('Nessun contenuto testuale trovato in questa pagina.');
  }

  return { title, content, url: payload.data?.url ?? targetUrl };
}
