import { z } from "zod";
import { looksLikeXtreamUrl, parseXtreamCredentials } from "@iptv/core";

export const MAX_M3U_FILE_BYTES = 200 * 1024 * 1024;

const nameField = z
  .string()
  .trim()
  .min(1, "Bir isim girin")
  .max(60, "İsim en fazla 60 karakter olabilir");

const httpUrlField = z
  .string()
  .trim()
  .min(1, "Adres girin")
  .refine((value) => /^https?:\/\//i.test(value), "Adres http:// veya https:// ile başlamalı")
  .refine((value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, "Adres geçerli bir URL değil");

export const m3uUrlFormSchema = z.object({
  name: nameField,
  url: httpUrlField,
});

export type M3uUrlForm = z.infer<typeof m3uUrlFormSchema>;

export const m3uFileFormSchema = z.object({
  name: nameField,
  content: z
    .string()
    .min(1, "Dosya boş görünüyor")
    .refine(
      (value) => value.includes("#EXTM3U") || value.includes("#EXTINF"),
      "Bu bir M3U playlist dosyası değil (#EXTINF satırı bulunamadı)",
    ),
});

export type M3uFileForm = z.infer<typeof m3uFileFormSchema>;

export const xtreamFormSchema = z
  .object({
    name: nameField,
    host: z.string().trim().min(1, "Sunucu adresi girin"),
    username: z.string().trim().min(1, "Kullanıcı adı girin"),
    password: z.string().min(1, "Parola girin"),
  })
  .superRefine((value, ctx) => {
    try {
      parseXtreamCredentials(value.host, {
        username: value.username,
        password: value.password,
      });
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["host"],
        message: error instanceof Error ? error.message : "Sunucu adresi geçersiz",
      });
    }
  });

export type XtreamForm = z.infer<typeof xtreamFormSchema>;

export function detectXtreamFromUrl(
  url: string,
): { baseUrl: string; username: string; password: string } | null {
  if (!looksLikeXtreamUrl(url)) return null;
  try {
    return parseXtreamCredentials(url);
  } catch {
    return null;
  }
}

export function suggestNameFromUrl(url: string): string {
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `http://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Playlist";
  }
}

export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}
