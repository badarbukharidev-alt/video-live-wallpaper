import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const buildRoot = resolve(process.cwd(), "web-build");
const port = Number(process.env.EXPO_PORT ?? 8081);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveRequestPath(url = "/") {
  const pathname = decodeURIComponent(url.split("?", 1)[0] || "/");
  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolvedPath = resolve(buildRoot, requestedPath);

  if (!resolvedPath.startsWith(`${buildRoot}${sep}`) && resolvedPath !== buildRoot) {
    return null;
  }

  return resolvedPath;
}

const server = createServer(async (request, response) => {
  const candidatePath = resolveRequestPath(request.url);

  if (!candidatePath) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  let filePath = candidatePath;
  try {
    const fileInfo = await stat(filePath);
    if (fileInfo.isDirectory()) {
      filePath = resolve(buildRoot, "index.html");
    }
  } catch {
    // Expo Router handles route requests in the client after the app shell is served.
    filePath = resolve(buildRoot, "index.html");
  }

  try {
    const fileInfo = await stat(filePath);
    const isHtml = extname(filePath) === ".html";
    response.writeHead(200, {
      "Cache-Control": "no-store, max-age=0",
      "Content-Length": fileInfo.size,
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(200, {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "text/html; charset=utf-8",
    }).end("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Video Live Wallpaper</title></head><body style=\"margin:0;background:#F7F7FB;color:#14151D;font-family:system-ui;display:grid;min-height:100vh;place-items:center\"><main style=\"max-width:22rem;padding:2rem;text-align:center\"><strong>Preparing Video Live Wallpaper</strong><p>The latest preview is loading. This page will be ready momentarily.</p></main></body></html>");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Serving exported web preview on http://0.0.0.0:${port}`);
});
