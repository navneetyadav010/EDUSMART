const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "erp");
const distDir = path.join(rootDir, "dist");

const config = {
  apiBase: String(process.env.EDUSMART_API_BASE || "").trim() || "/erp-api",
  socketUrl: String(process.env.EDUSMART_SOCKET_URL || "").trim() || "same-origin",
  socketPath: String(process.env.EDUSMART_SOCKET_PATH || "").trim() || "/socket.io"
};

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
fs.cpSync(sourceDir, distDir, { recursive: true });
fs.writeFileSync(
  path.join(distDir, "config.js"),
  "window.EDUSMART_CONFIG = " + JSON.stringify(config, null, 2) + ";\n"
);

if (!process.env.EDUSMART_API_BASE) {
  console.warn("EDUSMART_API_BASE is not set. The Vercel build will use same-origin API paths.");
}

console.log("Prepared Vercel dist/ with EDUSMART runtime config.");
