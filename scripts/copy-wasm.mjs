// Copies the MediaPipe WebAssembly runtime into public/ so the app serves it
// itself instead of depending on a third-party CDN at run time.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const target = join(root, "public", "mediapipe", "wasm");

if (!existsSync(source)) {
  console.error(`MediaPipe wasm files not found at ${source}. Run "npm install" first.`);
  process.exit(1);
}
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`Copied MediaPipe wasm runtime to ${target}`);
