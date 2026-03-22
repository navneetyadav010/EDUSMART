const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 3000);
const rootDir = path.resolve(__dirname, "..");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp"
};

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);

  if (requestPath === "/api/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, service: "aeron-atelier", timestamp: Date.now() }));
    return;
  }

  let filePath = path.join(rootDir, requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, ""));

  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (!statError && stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    fs.readFile(filePath, (readError, content) => {
      if (readError) {
        fs.readFile(path.join(rootDir, "index.html"), (fallbackError, fallbackContent) => {
          if (fallbackError) {
            response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Unable to load application.");
            return;
          }

          response.writeHead(200, { "Content-Type": mimeTypes[".html"] });
          response.end(fallbackContent);
        });
        return;
      }

      const extension = path.extname(filePath).toLowerCase();
      response.writeHead(200, { "Content-Type": mimeTypes[extension] || "application/octet-stream" });
      response.end(content);
    });
  });
});

server.listen(port, () => {
  console.log("AERON Atelier is running at http://localhost:" + port);
});
