// Runs tests/*.browser.cjs against a local server on 127.0.0.1:5173 (the
// origin Sanity's CORS settings allow). Reuses a server that is already
// running there; otherwise starts the Vite dev server and stops it afterwards.
// Usage: npm run test:browser [-- name ...]   e.g. npm run test:browser -- mobileNav
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "http://127.0.0.1:5173";
const filters = process.argv.slice(2);
const tests = readdirSync(path.join(root, "tests"))
  .filter((file) => file.endsWith(".browser.cjs"))
  .filter((file) => !filters.length || filters.some((name) => file.includes(name)))
  .sort();

async function reachable() {
  try {
    return (await fetch(origin, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", ...options });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

let server;
if (await reachable()) {
  console.log(`Using the server already running at ${origin}`);
} else {
  server = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5173", "--strictPort"], {
    cwd: root,
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 60 && !(await reachable()); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!(await reachable())) {
    server.kill();
    console.error(`Could not start the dev server at ${origin}`);
    process.exit(1);
  }
}

const failed = [];
for (const test of tests) {
  console.log(`\n=== ${test}`);
  if ((await run(process.execPath, [path.join("tests", test)], { env: { ...process.env, TEST_ORIGIN: origin } })) !== 0) failed.push(test);
}
server?.kill();

console.log(`\n${tests.length - failed.length}/${tests.length} browser suites passed${failed.length ? `; failed: ${failed.join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
