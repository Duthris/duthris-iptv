import { app, net, protocol } from "electron";
import { existsSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const RENDERER_SCHEME = "app";
export const RENDERER_ORIGIN = `${RENDERER_SCHEME}://local`;

export function registerRendererScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: RENDERER_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function rendererRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "renderer")
    : join(__dirname, "..", "..", "..", "web", "out");
}

function resolveFile(root: string, pathname: string): string {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded).replace(/^([/\\])+/, "");

  const candidatePath = join(root, relative);
  if (!candidatePath.startsWith(root + sep) && candidatePath !== root) {
    return join(root, "index.html");
  }

  const candidates = relative
    ? [candidatePath, `${candidatePath}.html`, join(candidatePath, "index.html")]
    : [join(root, "index.html")];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return join(root, "index.html");
}

export function handleRendererScheme(): void {
  const root = rendererRoot();

  protocol.handle(RENDERER_SCHEME, (request) => {
    const url = new URL(request.url);
    const file = resolveFile(root, url.pathname);
    return net.fetch(pathToFileURL(file).toString());
  });
}
