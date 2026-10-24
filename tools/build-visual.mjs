// Build the embedded visual tools: strict TypeScript from visual-src/ into visual/, plus templates, styles, art and the Russian strings.
import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "visual-src");
const output = resolve(root, "visual");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
execFileSync(process.execPath, [resolve(root, "node_modules/typescript/bin/tsc"), "-p", resolve(root, "tsconfig.visual.json")], { cwd: root, stdio: "inherit" });
for (const file of await readdir(source)) {
  if (/\.(css|hbs|webp|zip)$/.test(file) || file === "ru.json") await cp(resolve(source, file), resolve(output, file));
}
console.log(`Built ${output}`);
