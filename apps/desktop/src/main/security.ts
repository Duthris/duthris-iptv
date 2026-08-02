import { app, session, type Session } from "electron";

const APP_SCHEMES = new Set(["file:", "devtools:", "chrome-extension:"]);

function isAppOrigin(url: string, devServer: string | null): boolean {
  try {
    const parsed = new URL(url);
    if (APP_SCHEMES.has(parsed.protocol)) return true;
    if (devServer && url.startsWith(devServer)) return true;
    return false;
  } catch {
    return true;
  }
}

const bypassedHosts = new Set<string>();

export function getBypassedCertificateHosts(): string[] {
  return Array.from(bypassedHosts).sort();
}

export function installCertificateBypass(devServer: string | null): void {
  app.on("certificate-error", (event, _webContents, url, error, _certificate, callback) => {
    if (isAppOrigin(url, devServer)) {
      callback(false);
      return;
    }

    try {
      bypassedHosts.add(new URL(url).host);
    } catch {
      /* yok say */
    }

    console.warn(`[cert] yok sayıldı: ${error} — ${safeHost(url)}`);
    event.preventDefault();
    callback(true);
  });
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(bilinmeyen)";
  }
}

const IPTV_USER_AGENT = "VLC/3.0.20 LibVLC/3.0.20";

/**
 * Hosts that must see an ordinary browser.
 *
 * The rewrite below exists for IPTV panels, which want a player identity and
 * no Referer. An embedded trailer wants the opposite: YouTube refuses to play
 * for something calling itself VLC, and its embed rules are decided by the
 * Referer this would otherwise strip.
 */
const BROWSER_IDENTITY_HOSTS = [
  "youtube.com",
  "youtube-nocookie.com",
  "ytimg.com",
  "googlevideo.com",
  "google.com",
];

function wantsBrowserIdentity(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BROWSER_IDENTITY_HOSTS.some((base) => host === base || host.endsWith(`.${base}`));
  } catch {
    return false;
  }
}

export function installHeaderBypass(targetSession: Session, devServer: string | null): void {
  targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (isAppOrigin(details.url, devServer) || wantsBrowserIdentity(details.url)) {
      callback({ requestHeaders: details.requestHeaders });
      return;
    }

    const headers = { ...details.requestHeaders };
    delete headers["Origin"];
    delete headers["origin"];
    delete headers["Referer"];
    delete headers["referer"];
    headers["User-Agent"] = IPTV_USER_AGENT;

    callback({ requestHeaders: headers });
  });

  targetSession.webRequest.onHeadersReceived((details, callback) => {
    if (isAppOrigin(details.url, devServer) || wantsBrowserIdentity(details.url)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    const headers = { ...details.responseHeaders };

    for (const key of Object.keys(headers)) {
      if (key.toLowerCase().startsWith("access-control-")) delete headers[key];
    }
    headers["Access-Control-Allow-Origin"] = ["*"];
    headers["Access-Control-Allow-Headers"] = ["*"];
    headers["Access-Control-Allow-Methods"] = ["GET", "HEAD", "OPTIONS"];

    callback({ responseHeaders: headers });
  });
}

export function installNetworkPolicies(devServer: string | null): void {
  installCertificateBypass(devServer);
  installHeaderBypass(session.defaultSession, devServer);
}
