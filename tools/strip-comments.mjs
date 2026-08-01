import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = ["apps", "packages", "tools"];
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "out",
  "release",
  "build",
  ".git",
]);

const KEEP =
  /eslint-|ts-expect-error|ts-ignore|ts-nocheck|prettier-ignore|@ts-|webpackChunkName|c8 ignore|istanbul|@license|@preserve|^!/;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry");

function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, out);
    else if (
      [".ts", ".tsx", ".mjs", ".js", ".css", ".yml", ".yaml"].includes(extname(entry.name))
    ) {
      out.push(full);
    }
  }
  return out;
}

function scriptKind(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".mjs") || file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function stripScript(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const ranges = new Map();

  const add = (pos, end) => {
    if (KEEP.test(text.slice(pos, end))) return;
    ranges.set(pos, end);
  };

  const visit = (node) => {
    if (ts.isJsxExpression(node) && !node.expression) {
      const inner = text.slice(node.pos, node.end);
      if (!KEEP.test(inner)) ranges.set(node.getStart(source), node.end);
    }
    ts.forEachLeadingCommentRange(text, node.pos, add);
    ts.forEachTrailingCommentRange(text, node.end, add);
    node.forEachChild(visit);
  };

  visit(source);
  ts.forEachLeadingCommentRange(text, source.endOfFileToken.pos, add);

  const sorted = [...ranges.entries()].sort((a, b) => b[0] - a[0]);
  let out = text;
  for (const [pos, end] of sorted) out = out.slice(0, pos) + out.slice(end);
  return out;
}

function stripCss(text) {
  let out = "";
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += text[++i] ?? "";
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      const block = text.slice(i, close === -1 ? text.length : close + 2);
      if (KEEP.test(block)) {
        out += block;
      }
      i = close === -1 ? text.length : close + 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function stripYaml(text) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      let quote = null;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
          if (ch === "\\") i++;
          else if (ch === quote) quote = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quote = ch;
          continue;
        }
        if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
          if (KEEP.test(line.slice(i))) return line;
          return line.slice(0, i).replace(/\s+$/, "");
        }
      }
      return line;
    })
    .filter((line, index, all) => {
      if (line.trim() !== "") return true;
      const previous = all[index - 1];
      return previous === undefined || previous.trim() !== "";
    })
    .join("\n");
}

function tidy(text) {
  return (
    text
      .split(/\r?\n/)
      .filter((line, index, all) => {
        if (line.trim() !== "") return true;
        return index > 0 && all[index - 1].trim() !== "";
      })
      .join("\n")
      .replace(/\{\s*\n\s*\n/g, "{\n")
      .replace(/\n\s*\n(\s*[}\)\]])/g, "\n$1")
      .replace(/^\s*\n+/, "")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

let changed = 0;
let removedLines = 0;

for (const dir of ROOTS) {
  for (const file of collectFiles(join(root, dir))) {
    const original = readFileSync(file, "utf8");
    const extension = extname(file);

    let stripped;
    if (extension === ".css") stripped = stripCss(original);
    else if (extension === ".yml" || extension === ".yaml") stripped = stripYaml(original);
    else stripped = stripScript(original, file);

    const result = extension === ".yml" || extension === ".yaml" ? stripped : tidy(stripped);
    if (result === original) continue;

    changed++;
    removedLines += original.split("\n").length - result.split("\n").length;
    if (!dryRun) writeFileSync(file, result, "utf8");
  }
}

console.log(`${dryRun ? "[dry-run] " : ""}${changed} dosya, ${removedLines} satir azaldi`);
