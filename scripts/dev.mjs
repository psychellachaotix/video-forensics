import { spawn } from "node:child_process";
import http from "node:http";

const children = new Set();

function run(command, args) {
  const child = spawn(command, args, {
    cwd: new URL("..", import.meta.url),
    env: process.env,
    stdio: "inherit",
  });
  children.add(child);
  child.once("exit", (code) => {
    children.delete(child);
    if (code && !stopping) shutdown(code);
  });
  return child;
}

function waitForRenderer(attempts = 100) {
  return new Promise((resolve, reject) => {
    const check = (remaining) => {
      const request = http.get("http://127.0.0.1:5174", (response) => {
        response.resume();
        resolve();
      });
      request.once("error", () => {
        if (remaining <= 0) reject(new Error("Renderer se nepodařilo spustit."));
        else setTimeout(() => check(remaining - 1), 200);
      });
    };
    check(attempts);
  });
}

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 250);
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

run("pnpm", ["exec", "vite", "--config", "vite.config.ts"]);
await waitForRenderer();
const electron = run("pnpm", ["exec", "electron", "."]);
electron.once("exit", (code) => shutdown(code ?? 0));