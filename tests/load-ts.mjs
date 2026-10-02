import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";

// Transpile pure domain modules with the repository's pinned compiler.
// Production code keeps Expo's resolution; tests do not import React Native.
const cache = new Map();
const require = createRequire(import.meta.url);
export function loadTs(relative) {
  const file = path.resolve(relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = new Module(file);
  cache.set(file, mod);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod.require = specifier => specifier.startsWith(".")
    ? loadTs(path.resolve(path.dirname(file), specifier.endsWith(".ts") ? specifier : specifier + ".ts"))
    : require(specifier);
  const result = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
  });
  mod._compile(result.outputText, file);
  return mod.exports;
}

export function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key) { await Promise.resolve(); return values.get(key) ?? null; },
    async setItem(key, value) { await Promise.resolve(); values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}
