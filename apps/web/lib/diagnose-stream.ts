"use client";

import { PROXY_PATH } from "./http";

export type StreamDiagnosis =
  | { kind: "blocked-by-browser"; message: string }
  | { kind: "stream-down"; message: string }
  | { kind: "unknown"; message: string };

const TIMEOUT_MS = 15_000;

export async function diagnoseStream(
  url: string,
  options: { canSwitchToHttp: boolean },
): Promise<StreamDiagnosis> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${PROXY_PATH}?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        kind: "stream-down",
        message:
          response.status === 404 || response.status === 403
            ? "Kanal sağlayıcı tarafında bulunamadı; yayın kaldırılmış olabilir."
            : `Sağlayıcı sunucusu yanıt vermedi (HTTP ${response.status}).`,
      };
    }

    const body = await response.text();
    const looksLikeManifest = body.includes("#EXTM3U") || body.includes("#EXTINF");

    if (!looksLikeManifest) {
      const isHtml = /<html|<!doctype/i.test(body.slice(0, 200));
      return {
        kind: "stream-down",
        message: isHtml
          ? "Kanal sağlayıcı tarafında şu anda yayında değil. (Sağlayıcı yayın yerine hata " +
            "sayfası döndürdü.) Büyük listelerde ölü kanal bulunması olağandır."
          : "Sağlayıcı boş yanıt döndürdü; kanal şu anda yayında değil.",
      };
    }

    return {
      kind: "blocked-by-browser",
      message: options.canSwitchToHttp
        ? "Yayın sağlayıcıda çalışıyor ancak tarayıcı bağlantıyı reddetti. Bunun en sık " +
          "sebebi sağlayıcının HTTPS sertifikasının geçersiz olmasıdır. Yayın protokolünü " +
          "HTTP'ye çevirip tekrar deneyin."
        : "Yayın sağlayıcıda çalışıyor ancak tarayıcı bağlantıyı reddetti (geçersiz " +
          "sertifika ya da güvenlik kısıtı). Windows uygulamasında bu kısıt yoktur.",
    };
  } catch {
    return {
      kind: "unknown",
      message: "Yayının durumu belirlenemedi. Bağlantınızı kontrol edip tekrar deneyin.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
