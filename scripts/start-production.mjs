import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import serverEntry from "../dist/server/server.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOST ?? process.env.NITRO_HOST ?? "0.0.0.0";
const publicDir = resolve("dist/client");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

function createRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const host = req.headers.host ?? `${hostname}:${port}`;
  const url = new URL(req.url ?? "/", `${protocol}://${host}`);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  return new Request(url, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

function getPublicFilePath(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const normalizedPath = normalize(decodedPath).replace(/^[/\\]+/, "");
  const filePath = resolve(join(publicDir, normalizedPath));
  const relativePath = relative(publicDir, filePath);

  if (relativePath.startsWith("..") || relativePath === "" || relativePath.includes(`..${sep}`)) {
    return null;
  }

  return filePath;
}

async function servePublicAsset(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const filePath = getPublicFilePath(url.pathname);
  if (!filePath) {
    return false;
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return false;
  }

  if (!fileStat.isFile()) {
    return false;
  }

  const contentType = contentTypes.get(extname(filePath));
  if (contentType) {
    res.setHeader("content-type", contentType);
  }
  res.setHeader("content-length", fileStat.size);
  res.setHeader("cache-control", url.pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate");

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  createReadStream(filePath).pipe(res);
  return true;
}

function getSetCookieValues(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

async function writeResponse(res, response) {
  res.statusCode = response.status;
  res.statusMessage = response.statusText;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });

  const setCookies = getSetCookieValues(response.headers);
  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  }

  if (!response.body) {
    res.end();
    return;
  }

  Readable.fromWeb(response.body).pipe(res);
}

const app = createServer(async (req, res) => {
  try {
    if (await servePublicAsset(req, res)) {
      return;
    }

    const request = createRequest(req);
    const response = await serverEntry.fetch(request);
    await writeResponse(res, response);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
});

app.listen(port, hostname, () => {
  console.log(`Production server listening on http://${hostname}:${port}`);
});
