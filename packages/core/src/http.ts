export interface FetchOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Defaults to GET. Only needed by APIs that take a request body. */
  method?: string;
  body?: string;

  onProgress?: (loadedBytes: number, totalBytes: number | null) => void;
}

export interface HttpClient {
  text(url: string, options?: FetchOptions): Promise<string>;
  json<T = unknown>(url: string, options?: FetchOptions): Promise<T>;
}

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

export interface CreateHttpClientOptions {
  fetchImpl?: typeof fetch;

  proxyUrlFor?: (url: string) => string | null;

  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 256 * 1024 * 1024;

async function readTextStream(
  response: Response,
  url: string,
  maxBytes: number,
  onProgress?: FetchOptions["onProgress"],
): Promise<string> {
  const contentLengthHeader = response.headers.get("content-length");
  const total = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : null;
  const totalBytes = total !== null && Number.isFinite(total) ? total : null;

  if (!response.body) {
    const fallback = await response.text();
    onProgress?.(fallback.length, totalBytes);
    return fallback;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const chunks: string[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    loaded += value.byteLength;
    if (loaded > maxBytes) {
      await reader.cancel();
      throw new HttpError(
        `Yanıt boyutu sınırı aşıldı (${Math.round(maxBytes / 1024 / 1024)} MB)`,
        413,
        url,
      );
    }

    chunks.push(decoder.decode(value, { stream: true }));
    onProgress?.(loaded, totalBytes);
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}

export interface RequestQueueOptions {
  minIntervalMs?: number;

  maxRetries?: number;

  baseBackoffMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function withRequestQueue(
  client: HttpClient,
  options: RequestQueueOptions = {},
): HttpClient {
  const { minIntervalMs = 1000, maxRetries = 3, baseBackoffMs = 1000 } = options;

  let chain: Promise<unknown> = Promise.resolve();
  let lastStartedAt = 0;

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const waitFor = lastStartedAt + minIntervalMs - Date.now();
      if (waitFor > 0) await sleep(waitFor);
      lastStartedAt = Date.now();

      let lastError: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await task();
        } catch (error) {
          lastError = error;

          const retriable =
            !(error instanceof HttpError) || error.status === 0 || error.status >= 500;
          if (!retriable || attempt === maxRetries) break;

          await sleep(baseBackoffMs * 2 ** attempt);
          lastStartedAt = Date.now();
        }
      }
      throw lastError;
    });

    chain = run.catch(() => undefined);
    return run;
  }

  return {
    text: (url, opts) => enqueue(() => client.text(url, opts)),
    json: <T>(url: string, opts?: FetchOptions) => enqueue(() => client.json<T>(url, opts)),
  };
}

export function createHttpClient(options: CreateHttpClientOptions = {}): HttpClient {
  const {
    fetchImpl = globalThis.fetch?.bind(globalThis),
    proxyUrlFor,
    maxBytes = DEFAULT_MAX_BYTES,
  } = options;

  if (!fetchImpl) {
    throw new Error("Bu ortamda fetch bulunamadı; fetchImpl geçilmeli.");
  }

  async function request(url: string, opts: FetchOptions | undefined, viaProxy: boolean) {
    const target = viaProxy && proxyUrlFor ? proxyUrlFor(url) : url;
    if (!target) throw new HttpError("Proxy adresi üretilemedi", 0, url);

    const response = await fetchImpl(target, {
      signal: opts?.signal,
      headers: opts?.headers,
      redirect: "follow",
      ...(opts?.method ? { method: opts.method } : {}),
      ...(opts?.body !== undefined ? { body: opts.body } : {}),

      credentials: "omit",
    });

    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status} — ${response.statusText}`, response.status, url);
    }
    return response;
  }

  async function fetchWithFallback(url: string, opts?: FetchOptions): Promise<Response> {
    try {
      return await request(url, opts, false);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (opts?.signal?.aborted) throw error;
      if (!proxyUrlFor) throw error;
      return request(url, opts, true);
    }
  }

  return {
    async text(url, opts) {
      const response = await fetchWithFallback(url, opts);
      return readTextStream(response, url, maxBytes, opts?.onProgress);
    },

    async json<T>(url: string, opts?: FetchOptions): Promise<T> {
      const response = await fetchWithFallback(url, opts);
      const raw = await readTextStream(response, url, maxBytes, opts?.onProgress);
      const trimmed = raw.trim();
      if (!trimmed) return [] as unknown as T;
      try {
        return JSON.parse(trimmed) as T;
      } catch {
        const preview = trimmed.slice(0, 120).replace(/\s+/g, " ");
        throw new HttpError(`Geçersiz JSON yanıtı: "${preview}"`, 0, url);
      }
    },
  };
}
