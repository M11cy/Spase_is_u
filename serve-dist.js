import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, relative, sep } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const host = "127.0.0.1";
const preferredPorts = Array.from({ length: 11 }, (_, index) => 5173 + index);
const noOpen = process.argv.includes("--no-open");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".ttf", "font/ttf"],
  [".mp3", "audio/mpeg"]
]);

if (!existsSync(join(root, "index.html"))) {
  console.error("dist/index.html was not found. Run npm run build first.");
  process.exit(1);
}

function openBrowser(url) {
  if (noOpen) {
    return;
  }

  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

function safeFilePath(requestUrl) {
  const url = new URL(requestUrl, `http://${host}/`);
  const decodedPath = decodeURIComponent(url.pathname);
  const cleanPath = normalize(decodedPath).replace(/^[/\\]+/, "");
  let filePath = join(root, cleanPath);

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  const rel = relative(root, filePath);
  if (rel.startsWith("..") || rel.includes(`..${sep}`)) {
    return null;
  }

  return filePath;
}

function createApp() {
  return createServer(async (req, res) => {
    if (!req.url || !["GET", "HEAD"].includes(req.method ?? "")) {
      res.writeHead(405);
      res.end();
      return;
    }

    let filePath = safeFilePath(req.url);
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      filePath = join(root, "index.html");
    }

    const contentType = mimeTypes.get(extname(filePath).toLowerCase()) ?? "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache");

    if (req.method === "HEAD") {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      if (contentType.startsWith("text/")) {
        res.end(await readFile(filePath));
      } else {
        createReadStream(filePath).pipe(res);
      }
    } catch {
      res.writeHead(500);
      res.end("Server error");
    }
  });
}

function listenOn(port) {
  return new Promise((resolve, reject) => {
    const server = createApp();
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

let server = null;
let selectedPort = null;

for (const port of preferredPorts) {
  try {
    server = await listenOn(port);
    selectedPort = port;
    break;
  } catch (error) {
    if (error.code !== "EADDRINUSE") {
      throw error;
    }
  }
}

if (!server || !selectedPort) {
  console.error("No free port found from 5173 to 5183.");
  process.exit(1);
}

const url = `http://${host}:${selectedPort}/`;
console.log(`Site is running: ${url}`);
console.log("Keep this window open while using the site. Press Ctrl+C to stop.");
openBrowser(url);
