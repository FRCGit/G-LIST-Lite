import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = "out";
const exportStaticDir = join(outDir, "_next", "static");
const buildStaticDir = join(".next", "static");
const hostingerStaticDir = join(outDir, "next-static");
const textExtensions = new Set([".html", ".js", ".json", ".txt"]);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      walk(path, files);
    } else {
      files.push(path);
    }
  }

  return files;
}

function extensionFor(path) {
  const dotIndex = path.lastIndexOf(".");
  return dotIndex === -1 ? "" : path.slice(dotIndex);
}

if (!existsSync(outDir)) {
  throw new Error(`Missing static export directory: ${outDir}`);
}

const sourceStaticDir = existsSync(exportStaticDir)
  ? exportStaticDir
  : existsSync(buildStaticDir)
    ? buildStaticDir
    : null;

if (!sourceStaticDir) {
  throw new Error(
    `Missing static asset directory. Checked ${exportStaticDir} and ${buildStaticDir}.`
  );
}

mkdirSync(hostingerStaticDir, { recursive: true });
cpSync(sourceStaticDir, hostingerStaticDir, { recursive: true });

let rewrittenFiles = 0;

for (const file of walk(outDir)) {
  if (!textExtensions.has(extensionFor(file))) {
    continue;
  }

  const original = readFileSync(file, "utf8");
  const rewritten = original.replaceAll("/_next/static/", "/next-static/");

  if (rewritten !== original) {
    writeFileSync(file, rewritten);
    rewrittenFiles += 1;
  }
}

console.log(
  `Prepared Hostinger export: copied ${sourceStaticDir} to ${hostingerStaticDir} and rewrote ${rewrittenFiles} files.`
);
