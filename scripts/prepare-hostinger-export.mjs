import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";

const outDir = "out";
const exportStaticDir = join(outDir, "_next", "static");
const buildStaticDir = join(".next", "static");
const serverAppDir = join(".next", "server", "app");
const prefixedStaticPath = join("next-static", "_next", "static");
const hostingerStaticDir = join(outDir, prefixedStaticPath);
const publicStaticDir = join("public", prefixedStaticPath);
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

function copyIfExists(source, destination) {
  if (!existsSync(source)) {
    return false;
  }

  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return true;
}

function segmentDestinationName(name) {
  return `__next.${name.replace(".segment.rsc", "")}.txt`;
}

function copySegments(sourceDir, destinationDir) {
  if (!existsSync(sourceDir)) {
    return 0;
  }

  mkdirSync(destinationDir, { recursive: true });
  let copied = 0;

  for (const name of readdirSync(sourceDir)) {
    const source = join(sourceDir, name);
    const stats = statSync(source);

    if (stats.isDirectory()) {
      mkdirSync(join(destinationDir, `__next.${name}`), { recursive: true });
      continue;
    }

    if (name.endsWith(".segment.rsc")) {
      copyFileSync(source, join(destinationDir, segmentDestinationName(name)));
      copied += 1;
    }
  }

  return copied;
}

function createExportFromBuildOutput() {
  if (existsSync(outDir)) {
    return false;
  }

  const indexHtml = join(serverAppDir, "index.html");

  if (!existsSync(indexHtml)) {
    throw new Error(`Missing export directory ${outDir} and fallback HTML ${indexHtml}.`);
  }

  mkdirSync(outDir, { recursive: true });

  if (existsSync("public")) {
    cpSync("public", outDir, { recursive: true });
  }

  copyFileSync(indexHtml, join(outDir, "index.html"));
  copyIfExists(join(serverAppDir, "index.rsc"), join(outDir, "index.txt"));
  copySegments(join(serverAppDir, "index.segments"), outDir);

  copyIfExists(join(serverAppDir, "_not-found.html"), join(outDir, "404.html"));
  copyIfExists(join(serverAppDir, "_not-found.html"), join(outDir, "_not-found.html"));
  copyIfExists(join(serverAppDir, "_not-found.rsc"), join(outDir, "_not-found.txt"));
  copySegments(join(serverAppDir, "_not-found.segments"), join(outDir, "_not-found"));

  return true;
}

const createdExport = createExportFromBuildOutput();

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

mkdirSync(publicStaticDir, { recursive: true });
cpSync(sourceStaticDir, publicStaticDir, { recursive: true });

let rewrittenFiles = 0;

for (const file of walk(outDir)) {
  if (!textExtensions.has(extensionFor(file))) {
    continue;
  }

  const original = readFileSync(file, "utf8");
  const rewritten = original.replaceAll(
    /(?<!next-static)\/_next\/static\//g,
    "/next-static/_next/static/"
  );

  if (rewritten !== original) {
    writeFileSync(file, rewritten);
    rewrittenFiles += 1;
  }
}

console.log(
  `Prepared Hostinger export: ${createdExport ? "created out from .next/server/app, " : ""}copied ${sourceStaticDir} to ${hostingerStaticDir} and ${publicStaticDir}, then rewrote ${rewrittenFiles} files.`
);
