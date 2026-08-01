import { z } from "zod";

const loose = z.union([z.string(), z.number(), z.null()]).optional();
const looseArray = z.union([z.array(z.union([z.string(), z.number()])), z.null()]).optional();

export const xtreamUserInfoSchema = z.object({
  username: z.string().optional(),
  auth: z.union([z.literal(0), z.literal(1), z.string()]).optional(),
  status: z.string().optional(),
  exp_date: loose,
  is_trial: loose,
  active_cons: loose,
  max_connections: loose,
  created_at: loose,
  allowed_output_formats: z.array(z.string()).optional(),
  message: z.string().optional(),
});

export const xtreamServerInfoSchema = z.object({
  url: z.string().optional(),
  port: loose,
  https_port: loose,
  server_protocol: z.string().optional(),
  timezone: z.string().optional(),
  timestamp_now: loose,
  time_now: z.string().optional(),
});

export const xtreamAuthSchema = z.object({
  user_info: xtreamUserInfoSchema,
  server_info: xtreamServerInfoSchema.optional(),
});

export type XtreamAuthResponse = z.infer<typeof xtreamAuthSchema>;

export const xtreamCategorySchema = z.object({
  category_id: z.union([z.string(), z.number()]),
  category_name: z.string(),
  parent_id: loose,
});

export const xtreamLiveStreamSchema = z.object({
  num: loose,
  name: z.string(),
  stream_id: z.union([z.string(), z.number()]),
  stream_icon: z.union([z.string(), z.null()]).optional(),
  epg_channel_id: z.union([z.string(), z.null()]).optional(),
  added: loose,
  category_id: loose,
  category_ids: looseArray,
  tv_archive: loose,
  tv_archive_duration: loose,
  direct_source: z.union([z.string(), z.null()]).optional(),
});

export const xtreamVodStreamSchema = z.object({
  num: loose,
  name: z.string(),
  title: z.union([z.string(), z.null()]).optional(),
  stream_id: z.union([z.string(), z.number()]),
  stream_icon: z.union([z.string(), z.null()]).optional(),
  container_extension: z.union([z.string(), z.null()]).optional(),
  category_id: loose,
  category_ids: looseArray,
  year: loose,
  rating: loose,
  plot: z.union([z.string(), z.null()]).optional(),
  genre: z.union([z.string(), z.null()]).optional(),
  cast: z.union([z.string(), z.null()]).optional(),
  director: z.union([z.string(), z.null()]).optional(),
  episode_run_time: loose,
  added: loose,
});

export const xtreamSeriesSchema = z.object({
  num: loose,
  name: z.string(),
  title: z.union([z.string(), z.null()]).optional(),
  series_id: z.union([z.string(), z.number()]),
  cover: z.union([z.string(), z.null()]).optional(),
  backdrop_path: looseArray,
  category_id: loose,
  category_ids: looseArray,
  year: loose,
  rating: loose,
  plot: z.union([z.string(), z.null()]).optional(),
  genre: z.union([z.string(), z.null()]).optional(),
  cast: z.union([z.string(), z.null()]).optional(),
  director: z.union([z.string(), z.null()]).optional(),
  episode_run_time: loose,
  last_modified: loose,
});

export const xtreamEpisodeSchema = z.object({
  id: z.union([z.string(), z.number()]),
  episode_num: loose,
  title: z.union([z.string(), z.null()]).optional(),
  container_extension: z.union([z.string(), z.null()]).optional(),
  season: loose,
  added: loose,
  info: z
    .object({
      duration_secs: loose,
      movie_image: z.union([z.string(), z.null()]).optional(),
      plot: z.union([z.string(), z.null()]).optional(),
    })
    .partial()
    .optional(),
});

export const xtreamSeriesInfoSchema = z.object({
  info: z.record(z.unknown()).optional(),
  seasons: z.array(z.record(z.unknown())).optional(),

  episodes: z.record(z.array(z.unknown())).optional(),
});

export const xtreamShortEpgEntrySchema = z.object({
  id: loose,
  title: z.string().optional(),
  description: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  start_timestamp: loose,
  stop_timestamp: loose,
  lang: z.string().optional(),
});

export const xtreamShortEpgSchema = z.object({
  epg_listings: z.array(xtreamShortEpgEntrySchema).optional(),
});

export interface SampleValidationResult {
  ok: boolean;
  checked: number;

  error: string | null;
}

const SAMPLE_SIZE = 25;

export function validateSample(
  items: unknown[],
  schema: z.ZodTypeAny,
  label: string,
): SampleValidationResult {
  if (items.length === 0) return { ok: true, checked: 0, error: null };

  const indices = new Set<number>();
  const step = Math.max(1, Math.floor(items.length / SAMPLE_SIZE));
  for (let i = 0; i < items.length && indices.size < SAMPLE_SIZE; i += step) {
    indices.add(i);
  }
  indices.add(items.length - 1);

  for (const index of indices) {
    const result = schema.safeParse(items[index]);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path.join(".") ?? "?";
      return {
        ok: false,
        checked: indices.size,
        error: `${label}[${index}] beklenen yapıda değil: "${path}" — ${issue?.message ?? "bilinmeyen hata"}`,
      };
    }
  }

  return { ok: true, checked: indices.size, error: null };
}
