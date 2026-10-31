// Completes `vite build --mode pages` (run from frontend/ after it) for GitHub Pages:
// - self-hosts Pyodide in dist/pyodide/: the runtime from the `pyodide` npm package, plus the
//   wheels the engine imports, downloaded from the matching Pyodide release and checked against
//   the SHA-256 in its lock file;
// - adds the backend package as dist/pyodide/roboroute.whl (built with uv);
// - copies index.html to 404.html, so Pages serves the app for deep links such as /arena.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PACKAGES = ["numpy", "fastapi", "scipy"]; // and their dependencies
const RUNTIME = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

const runtimeDir = "node_modules/pyodide";
const outDir = "dist/pyodide";
const cacheDir = "node_modules/.cache/pyodide";
const { version } = JSON.parse(readFileSync(join(runtimeDir, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(join(runtimeDir, "pyodide-lock.json"), "utf8"));

mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });
for (const file of RUNTIME) copyFileSync(join(runtimeDir, file), join(outDir, file));

const wanted = new Set();
const visit = (name) => {
  const key = name.toLowerCase().replace(/[-_.]+/g, "-"); // PEP 503 name
  if (wanted.has(key)) return;
  const entry = lock.packages[key];
  if (!entry) throw new Error(`Package ${name} is not in Pyodide ${version}.`);
  wanted.add(key);
  entry.depends.forEach(visit);
};
PACKAGES.forEach(visit);

for (const key of wanted) {
  const { file_name: file, sha256 } = lock.packages[key];
  const cached = join(cacheDir, file);
  if (!existsSync(cached)) {
    const url = `https://cdn.jsdelivr.net/pyodide/v${version}/full/${file}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    writeFileSync(cached, Buffer.from(await response.arrayBuffer()));
  }
  const data = readFileSync(cached);
  if (createHash("sha256").update(data).digest("hex") !== sha256) {
    throw new Error(`${file} does not match the SHA-256 in pyodide-lock.json.`);
  }
  writeFileSync(join(outDir, file), data);
}

const wheelDir = mkdtempSync(join(tmpdir(), "roboroute-wheel-"));
execFileSync("uv", ["build", "--wheel", "--out-dir", wheelDir], {
  cwd: "../backend",
  stdio: "inherit",
});
const [wheel] = readdirSync(wheelDir).filter((name) => name.endsWith(".whl"));
copyFileSync(join(wheelDir, wheel), join(outDir, "roboroute.whl"));

// Pages cannot send headers, so the server's Content-Security-Policy goes in a <meta> tag
// (frame-ancestors, which a <meta> cannot carry, is not part of BASE_POLICY). The engine worker
// is not covered by it: a worker takes its policy from its own response headers.
const policy = execFileSync(
  "uv",
  [
    "run",
    "python",
    "-c",
    "from roboroute.api.security import BASE_POLICY; print('; '.join(BASE_POLICY))",
  ],
  { cwd: "../backend", encoding: "utf8" },
).trim();
const html = readFileSync("dist/index.html", "utf8");
const withPolicy = html.replace(
  "<head>",
  `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
);
if (withPolicy === html) throw new Error("dist/index.html has no <head> to add the policy to.");
writeFileSync("dist/index.html", withPolicy);
copyFileSync("dist/index.html", "dist/404.html");
console.log(`Pyodide ${version} with ${wanted.size} packages and ${wheel} in ${outDir}.`);
