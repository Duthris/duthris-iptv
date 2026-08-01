import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 128 * 1024 * 1024;
const TIMEOUT_MS = 120_000;

const ALLOWED_CONTENT_TYPES = [
  "text/",
  "application/json",
  "application/xml",
  "application/x-mpegurl",
  "application/vnd.apple.mpegurl",
  "application/octet-stream",
  "application/gzip",
  "application/x-gzip",
  "audio/x-mpegurl",
  "audio/mpegurl",
];

const BLOCKED_CONTENT_TYPES = ["video/", "audio/mp", "audio/aac", "image/"];

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return true;
  }
  if (host === "::1" || host === "0.0.0.0") return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const octets = ipv4.slice(1, 5).map((part) => Number.parseInt(part, 10));
    const [a = 0, b = 0] = octets;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224) return true;
  }

  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;

  return false;
}

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request): Promise<NextResponse | Response> {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get("url");

  if (!target) return errorResponse("url parametresi gerekli", 400);

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return errorResponse("Geçersiz url", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return errorResponse("Yalnızca http/https desteklenir", 400);
  }

  if (isBlockedHost(parsed.hostname)) {
    return errorResponse("Bu adrese erişime izin verilmiyor", 403);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
        Accept: "*/*",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return errorResponse(`Kaynak sunucu ${upstream.status} döndürdü`, upstream.status);
    }

    const contentType = (upstream.headers.get("content-type") ?? "").toLowerCase();

    if (BLOCKED_CONTENT_TYPES.some((blocked) => contentType.startsWith(blocked))) {
      return errorResponse(
        "Bu içerik türü proxy üzerinden aktarılmaz. Video akışları doğrudan oynatılır.",
        415,
      );
    }

    if (contentType && !ALLOWED_CONTENT_TYPES.some((allowed) => contentType.startsWith(allowed))) {
      return errorResponse(`Desteklenmeyen içerik türü: ${contentType}`, 415);
    }

    const declaredLength = Number.parseInt(upstream.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
      return errorResponse("Kaynak yanıtı çok büyük", 413);
    }

    if (!upstream.body) {
      return errorResponse("Kaynak sunucu boş yanıt döndürdü", 502);
    }

    let transferred = 0;
    const limited = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controllerRef) {
        transferred += chunk.byteLength;
        if (transferred > MAX_BYTES) {
          controllerRef.error(new Error("Yanıt boyutu sınırı aşıldı"));
          return;
        }
        controllerRef.enqueue(chunk);
      },
    });

    return new Response(upstream.body.pipeThrough(limited), {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "no-store",

        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("Kaynak sunucu zaman aşımına uğradı", 504);
    }
    return errorResponse(error instanceof Error ? error.message : "Kaynağa ulaşılamadı", 502);
  } finally {
    clearTimeout(timeout);
  }
}
