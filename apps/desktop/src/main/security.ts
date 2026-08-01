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

export function installHeaderBypass(targetSession: Session, devServer: string | null): void {
  targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (isAppOrigin(details.url, devServer)) {
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
    if (isAppOrigin(details.url, devServer)) {
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
