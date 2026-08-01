import { HttpError, type FetchOptions, type HttpClient } from "../http.js";
import { asInt, asString } from "../coerce.js";
import type { ParsedPlaylist, ProgressCallback, SourceStats, StreamEndpoints } from "../types.js";
import {
  applyCategoryCounts,
  normalizeCategories,
  normalizeEpisodes,
  normalizeLiveStreams,
  normalizeSeries,
  normalizeVodInfo,
  normalizeVodStreams,
  type VodInfo,
} from "./normalize.js";
import {
  validateSample,
  xtreamAuthSchema,
  xtreamCategorySchema,
  xtreamLiveStreamSchema,
  xtreamSeriesInfoSchema,
  xtreamSeriesSchema,
  xtreamVodStreamSchema,
  type XtreamAuthResponse,
} from "./schemas.js";
import { buildApiUrl, buildStreamEndpoints, buildXmltvUrl, type XtreamCredentials } from "./url.js";

export class XtreamError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "XtreamError";
  }
}

export interface XtreamAccount {
  username: string;
  status: string;
  isTrial: boolean;
  activeConnections: number;
  maxConnections: number;
  expiresAt: number | null;
  allowedFormats: string[];
  serverTimezone: string | null;
  message: string | null;

  endpoints: StreamEndpoints;
}

export interface FetchCatalogOptions {
  onProgress?: ProgressCallback;
  signal?: AbortSignal;

  includeEpisodes?: boolean;
}

export class XtreamClient {
  readonly credentials: XtreamCredentials;
  private readonly http: HttpClient;

  constructor(http: HttpClient, credentials: XtreamCredentials) {
    this.http = http;
    this.credentials = credentials;
  }

  private async call<T>(
    action: string | undefined,
    params: Record<string, string | number> = {},
    options?: FetchOptions,
  ): Promise<T> {
    const url = buildApiUrl(this.credentials, action, params);
    try {
      return await this.http.json<T>(url, options);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        throw new XtreamError("Kullanıcı adı veya parola hatalı", error);
      }
      const label = action ?? "auth";
      throw new XtreamError(
        `Xtream isteği başarısız (${label}): ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
        error,
      );
    }
  }

  private async callList(
    action: string,
    params: Record<string, string | number> = {},
    options?: FetchOptions,
  ): Promise<unknown[]> {
    const data = await this.call<unknown>(action, params, options);
    if (Array.isArray(data)) return data;

    return [];
  }

  async authenticate(options?: FetchOptions): Promise<XtreamAccount> {
    const raw = await this.call<unknown>(undefined, {}, options);
    const parsed = xtreamAuthSchema.safeParse(raw);

    if (!parsed.success) {
      throw new XtreamError(
        "Sunucu beklenen Xtream yanıtını döndürmedi. Adres bir Xtream paneli olmayabilir.",
      );
    }

    const response: XtreamAuthResponse = parsed.data;
    const user = response.user_info;
    const authValue = user.auth;
    const authenticated = authValue === 1 || authValue === "1";

    if (!authenticated) {
      throw new XtreamError(user.message ?? "Giriş reddedildi — kullanıcı adı veya parola hatalı");
    }

    const status = user.status ?? "Unknown";
    if (status.toLowerCase() === "expired") {
      throw new XtreamError("Aboneliğin süresi dolmuş");
    }
    if (status.toLowerCase() === "banned" || status.toLowerCase() === "disabled") {
      throw new XtreamError("Hesap devre dışı bırakılmış");
    }

    const expSeconds = asInt(user.exp_date);

    return {
      username: user.username ?? this.credentials.username,
      status,
      isTrial: asString(user.is_trial) === "1",
      activeConnections: asInt(user.active_cons) ?? 0,
      maxConnections: asInt(user.max_connections) ?? 1,
      expiresAt: expSeconds !== null && expSeconds > 0 ? expSeconds * 1000 : null,
      allowedFormats: user.allowed_output_formats ?? ["ts"],
      serverTimezone: response.server_info?.timezone ?? null,
      message: user.message ?? null,
      endpoints: buildStreamEndpoints(this.credentials, response.server_info),
    };
  }

  getLiveCategories(options?: FetchOptions) {
    return this.callList("get_live_categories", {}, options);
  }

  getLiveStreams(categoryId?: string, options?: FetchOptions) {
    return this.callList(
      "get_live_streams",
      categoryId ? { category_id: categoryId } : {},
      options,
    );
  }

  getVodCategories(options?: FetchOptions) {
    return this.callList("get_vod_categories", {}, options);
  }

  getVodStreams(categoryId?: string, options?: FetchOptions) {
    return this.callList("get_vod_streams", categoryId ? { category_id: categoryId } : {}, options);
  }

  getSeriesCategories(options?: FetchOptions) {
    return this.callList("get_series_categories", {}, options);
  }

  getSeries(categoryId?: string, options?: FetchOptions) {
    return this.callList("get_series", categoryId ? { category_id: categoryId } : {}, options);
  }

  async getVodInfo(vodId: number | string, options?: FetchOptions): Promise<VodInfo | null> {
    const raw = await this.call<unknown>("get_vod_info", { vod_id: vodId }, options);
    return normalizeVodInfo(raw);
  }

  async getSeriesEpisodes(
    seriesId: number | string,
    seriesItemId: string,
    sourceId: string,
    options?: FetchOptions,
  ) {
    const raw = await this.call<unknown>("get_series_info", { series_id: seriesId }, options);
    const parsed = xtreamSeriesInfoSchema.safeParse(raw);
    if (!parsed.success) return [];
    return normalizeEpisodes(parsed.data.episodes, sourceId, seriesItemId);
  }

  getShortEpg(streamId: number | string, limit = 4, options?: FetchOptions) {
    return this.call<unknown>("get_short_epg", { stream_id: streamId, limit }, options);
  }

  get xmltvUrl(): string {
    return buildXmltvUrl(this.credentials);
  }

  async fetchCatalog(
    sourceId: string,
    options: FetchCatalogOptions = {},
  ): Promise<{ playlist: ParsedPlaylist; stats: SourceStats; warnings: string[] }> {
    const { onProgress, signal } = options;
    const warnings: string[] = [];
    const fetchOptions: FetchOptions = signal ? { signal } : {};

    const steps = 6;
    let step = 0;
    const report = (label: string) => {
      onProgress?.({
        phase: "download",
        ratio: step / steps,
        processed: step,
        total: steps,
        label,
      });
    };

    report("Kategoriler alınıyor");
    const [rawLiveCats, rawVodCats, rawSeriesCats] = await Promise.all([
      this.getLiveCategories(fetchOptions),
      this.getVodCategories(fetchOptions),
      this.getSeriesCategories(fetchOptions),
    ]);
    step = 3;

    report("Canlı kanallar alınıyor");
    const rawLive = await this.getLiveStreams(undefined, fetchOptions);
    step = 4;

    report("Filmler alınıyor");
    const rawVod = await this.getVodStreams(undefined, fetchOptions);
    step = 5;

    report("Diziler alınıyor");
    const rawSeries = await this.getSeries(undefined, fetchOptions);
    step = 6;

    onProgress?.({
      phase: "normalize",
      ratio: null,
      processed: 0,
      total: null,
      label: "Katalog işleniyor",
    });

    const checks = [
      validateSample(rawLiveCats, xtreamCategorySchema, "canlı kategori"),
      validateSample(rawLive, xtreamLiveStreamSchema, "canlı kanal"),
      validateSample(rawVod, xtreamVodStreamSchema, "film"),
      validateSample(rawSeries, xtreamSeriesSchema, "dizi"),
    ];
    for (const check of checks) {
      if (!check.ok && check.error) warnings.push(check.error);
    }

    const liveCategories = normalizeCategories(rawLiveCats, sourceId, "live");
    const vodCategories = normalizeCategories(rawVodCats, sourceId, "vod");
    const seriesCategories = normalizeCategories(rawSeriesCats, sourceId, "series");

    const live = normalizeLiveStreams(rawLive, sourceId);
    const vod = normalizeVodStreams(rawVod, sourceId);
    const series = normalizeSeries(rawSeries, sourceId);

    applyCategoryCounts(liveCategories, live);
    applyCategoryCounts(vodCategories, vod);
    applyCategoryCounts(seriesCategories, series);

    const categories = [...liveCategories, ...vodCategories, ...seriesCategories].filter(
      (category) => category.itemCount > 0,
    );

    const playlist: ParsedPlaylist = {
      live,
      vod,
      series,
      episodes: [],
      categories,
      epgUrl: this.xmltvUrl,
    };

    const stats: SourceStats = {
      liveCount: live.length,
      vodCount: vod.length,
      seriesCount: series.length,
      categoryCount: categories.length,
      epgProgramCount: 0,
    };

    return { playlist, stats, warnings };
  }
}
