import { app, net } from "electron";

const DOH_SERVERS = ["https://cloudflare-dns.com/dns-query", "https://dns.google/dns-query"];

const PROBE_TIMEOUT_MS = 4000;

const PROBE_NAME = "example.com";

function probe(server: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = setTimeout(() => finish(false), PROBE_TIMEOUT_MS);

    const request = net.request({
      method: "GET",
      url: `${server}?name=${PROBE_NAME}&type=A`,
    });
    request.setHeader("accept", "application/dns-json");

    request.on("response", (response) => {
      response.on("data", () => undefined);
      response.on("end", () => {
        clearTimeout(timer);
        finish(response.statusCode === 200);
      });
    });

    request.on("error", () => {
      clearTimeout(timer);
      finish(false);
    });

    request.end();
  });
}

export async function configureSecureDns(): Promise<boolean> {
  const reachable: string[] = [];

  for (const server of DOH_SERVERS) {
    if (await probe(server)) reachable.push(server);
  }

  if (reachable.length === 0) {
    console.info("[dns] DoH sunucusuna ulaşılamadı, sistem DNS'i kullanılıyor");
    return false;
  }

  try {
    app.configureHostResolver({
      secureDnsMode: "secure",
      secureDnsServers: reachable,
    });
    console.info(`[dns] DNS-over-HTTPS etkin: ${reachable.join(", ")}`);
    return true;
  } catch (error) {
    console.warn("[dns] host çözümleyici yapılandırılamadı:", error);
    return false;
  }
}
