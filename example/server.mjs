import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 4173);
const projectRoot = fileURLToPath(new URL("./", import.meta.url));
const publicRoot = join(projectRoot, "public");
const libraryRoot = join(projectRoot, "node_modules", "misakisharp-wasm", "dist");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gz": "application/gzip",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
};

if (!existsSync(libraryRoot)) {
  console.error("Missing misakisharp-wasm. Run 'npm install' before starting the example.");
  process.exit(1);
}

createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const vendorPrefix = "/vendor/misakisharp/";
    const isVendor = pathname.startsWith(vendorPrefix);
    const root = isVendor ? libraryRoot : publicRoot;
    const requested = isVendor ? pathname.slice(vendorPrefix.length) : pathname === "/" ? "index.html" : pathname.slice(1);
    const file = resolve(root, requested);

    if (relative(root, file).startsWith(`..${sep}`) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : String(error));
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`MisakiSharp example: http://localhost:${port}`);
});
