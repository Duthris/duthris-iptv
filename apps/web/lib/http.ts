import { createHttpClient, type HttpClient } from "@iptv/core";
import { isDesktop } from "./platform";

export const PROXY_PATH = "/api/proxy";

function proxyUrlFor(url: string): string | null {
  if (isDesktop()) return null;
  return `${PROXY_PATH}?url=${encodeURIComponent(url)}`;
}

let client: HttpClient | null = null;

export function getHttpClient(): HttpClient {
  if (!client) {
    client = createHttpClient({ proxyUrlFor });
  }
  return client;
}

export function createWorkerHttpClient(): HttpClient {
  return createHttpClient({ proxyUrlFor: (url) => `${PROXY_PATH}?url=${encodeURIComponent(url)}` });
}
