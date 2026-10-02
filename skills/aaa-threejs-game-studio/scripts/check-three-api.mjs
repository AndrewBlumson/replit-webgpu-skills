#!/usr/bin/env node
// Lists what the installed Three.js release has deprecated or no longer ships,
// and where a project's own source still uses those names.
//
//   node check-three-api.mjs /absolute/path/to/project [--json] [--all] [--three DIR]
//
// Reads the three package the project resolves (node_modules/three in the
// project or a parent folder, or --three DIR). No network access or
// dependencies. Names count only where they come from three (an import, a
// THREE. or TSL. prefix, or a method call on a three object). Matches are
// hints to check against the release's source, not proof, and an API removed
// without a warning is found only when it is imported by name.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const valueOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
if (has('--help') || has('-h')) {
  console.log('Usage: node check-three-api.mjs /path/to/project [--json] [--all] [--three DIR]');
  process.exit(0);
}
const json = has('--json');
const listAll = has('--all');
const positional = args.filter((arg, i) => !arg.startsWith('-') && args[i - 1] !== '--three');
const root = path.resolve(positional[0] ?? '.');
const fail = (message) => { console.error(message); process.exit(1); };
if (!fs.existsSync(root)) fail(`Project folder not found: ${root}`);

// never crash on one unreadable file or folder; list what was skipped.
const skipped = [];
const rel = (file) => path.relative(root, file) || '.';
function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { skipped.push(`${rel(file)} (${e.code})`); return null; }
}
function entries(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { skipped.push(`${rel(dir)}/ (${e.code})`); return []; }
}

// resolve three the way Node and Vite do (walk up), or take --three.
function findThree() {
  const explicit = valueOf('--three');
  if (explicit) {
    const dir = path.resolve(explicit);
    if (!fs.existsSync(path.join(dir, 'package.json'))) fail(`--three ${dir} is not a three package folder (no package.json there).`);
    return dir;
  }
  for (let dir = root; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', 'three');
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}
const three = findThree();
if (!three || !fs.existsSync(path.join(three, 'package.json'))) {
  const html = fs.existsSync(path.join(root, 'index.html')) ? read(path.join(root, 'index.html')) ?? '' : '';
  const cdn = html.match(/three@(\d+\.\d+\.\d+)/);
  fail(cdn
    ? `This project loads three ${cdn[1]} from a CDN import map, so there is no installed copy to read.\n`
      + `Install the same release somewhere (npm pack three@${cdn[1]} && tar xzf three-${cdn[1]}.tgz) and pass --three <dir>/package.`
    : `three is not installed for ${root} (no node_modules/three here or in a parent folder).\n`
      + 'Run the package manager install first, or pass --three /path/to/node_modules/three.');
}
const version = JSON.parse(read(path.join(three, 'package.json'))).version;
const manifest = (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); } catch { return null; } })();
const declared = manifest?.dependencies?.three ?? manifest?.devDependencies?.three ?? null;

function walk(dir, extensions, skip, rootOnlySkip = new Set(), depth = 0, project = false) {
  const files = [];
  // a copy of the three package (vendor/three/x.y.z/{build,examples}) is not project code.
  if (project && depth > 0 && (fs.existsSync(path.join(dir, 'build', 'three.core.js')) || fs.existsSync(path.join(dir, 'build', 'three.module.js'))
    || /(?:^|[\\/])examples[\\/]jsm$/.test(dir))) {
    skipped.push(`${rel(dir)}/ (copy of three.js)`); return files;
  }
  for (const entry of entries(dir)) {
    if (skip.has(entry.name) || entry.name.startsWith('.')) continue;
    // dist/build/out are output folders only next to a package.json (src/build/ is code)
    if (rootOnlySkip.has(entry.name) && (depth === 0 || fs.existsSync(path.join(dir, 'package.json')))) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, extensions, skip, rootOnlySkip, depth + 1, project));
    else if (extensions.some((ext) => entry.name.endsWith(ext))) files.push(full);
  }
  return files;
}

// ---------------------------------------------------------------- release side
// Export lists of the entry points, used to (a) tell exported names from
// methods and (b) find imports of names this release no longer ships.
const exportCache = new Map();
function exportsOf(file, seen = new Set()) {
  if (exportCache.has(file)) return exportCache.get(file);
  const names = new Set();
  exportCache.set(file, names);
  const text = seen.has(file) ? null : read(file);
  seen.add(file);
  if (text === null) return names;
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:class|function\*?|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  if (/export\s+default\b/.test(text)) names.add('default');
  for (const m of text.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    for (const name of exportsOf(path.resolve(path.dirname(file), m[1]), seen)) names.add(name);
  }
  return names;
}
const coreExports = exportsOf(path.join(three, 'build', 'three.module.js'));
const webgpuExports = exportsOf(path.join(three, 'build', 'three.webgpu.js'));
const tslExports = exportsOf(path.join(three, 'build', 'three.tsl.js'));
const allExports = new Set([...coreExports, ...webgpuExports, ...tslExports]);
// Type-only names (THREE.IUniform, ColorRepresentation) exist only in @types/three.
const typeNames = new Set();
for (let dir = path.dirname(path.dirname(three)); ; dir = path.dirname(dir)) {
  const types = path.join(dir, 'node_modules', '@types', 'three');
  if (fs.existsSync(types)) {
    for (const file of walk(types, ['.d.ts'], new Set())) {
      for (const m of (read(file) ?? '').matchAll(/export\s+(?:declare\s+)?(?:abstract\s+)?(?:type|interface|class|const|function|enum|namespace)\s+([A-Za-z_$][\w$]*)|export\s*\{([^}]*)\}/g)) {
        if (m[1]) typeNames.add(m[1]);
        for (const part of (m[2] ?? '').split(',')) { const n = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop(); if (n) typeNames.add(n); }
      }
    }
    break;
  }
  if (path.dirname(dir) === dir) break;
}
// An import map or bundler alias may point bare 'three' at the WebGPU build.
const configText = ['index.html', 'vite.config.js', 'vite.config.ts', 'vite.config.mjs']
  .map((name) => (fs.existsSync(path.join(root, name)) ? read(path.join(root, name)) ?? '' : '')).join('\n');
const bareIsWebgpu = /["']three["']\s*:\s*["'][^"']*(?:three\.webgpu\.js|three\/webgpu)/.test(configText);

// Map an import specifier to the file it names in the installed release, per
// the package's "exports" field. Returns undefined for non-three specifiers,
// null for a three subpath that does not exist.
function threeTarget(specifier) {
  const m = specifier.match(/^three(?:@[^/]+)?(\/.*)?$/) ?? specifier.match(/\/three@[^/]+(\/.*)$/);
  if (!m) return undefined;
  const sub = m[1] ?? '';
  const map = { '': bareIsWebgpu ? 'build/three.webgpu.js' : 'build/three.module.js', '/webgpu': 'build/three.webgpu.js', '/tsl': 'build/three.tsl.js',
    '/addons': 'examples/jsm/Addons.js', '/build/three.module.js': 'build/three.module.js',
    '/build/three.webgpu.js': 'build/three.webgpu.js', '/build/three.tsl.js': 'build/three.tsl.js' };
  let target = map[sub];
  if (!target) {
    const addon = sub.match(/^\/(?:addons|examples\/jsm)\/(.+)$/);
    const srcPath = sub.match(/^\/src\/(.+)$/);
    if (addon) target = `examples/jsm/${addon[1]}`;
    else if (srcPath) target = `src/${srcPath[1]}`;
    else return null;
  }
  const full = path.join(three, target);
  return fs.existsSync(full) ? full : null;
}

// Deprecation notices: runtime warnings/errors and JSDoc @deprecated tags.
const SKIP = new Set(['constructor', 'Objects', '…', '%s']);
function oldNameFrom(message) {
  const quoted = message.match(/"([^"]+)"/) ?? message.match(/'([^']+)'/);
  if (quoted) return quoted[1];
  const prefix = message.match(/^(?:THREE\.)?([A-Za-z_$][\w$.]*):\s*(.*)$/);
  if (prefix) {
    const rest = prefix[2];
    if (/^(?:This|The)\s+(?:module|class|loader|method|function)\b/.test(rest)) return prefix[1];
    const name = rest.match(/^(\.?[A-Za-z_$][\w$]*(?:\(\))?)\s/);
    if (name && !/^(?:Accessing|Iterating|Declaration|Shader|Objects)$/.test(name[1])) return name[1];
    return null;
  }
  const leading = message.match(/^(?:THREE\.)?([A-Za-z_$][\w$]*(?:\(\))?)\s+(?:has been|is)\b/);
  return leading ? leading[1] : null;
}
const found = new Map();
function record(oldName, message, source, owner, since) {
  const bare = oldName.replace(/^THREE\./, '').replace(/^\./, '').replace(/\(\)$/, '');
  if (SKIP.has(bare) || bare.length < 3 || !/^[A-Za-z_$][\w$]*$/.test(bare)) return;
  let entry = found.get(bare);
  if (!entry) found.set(bare, entry = { name: bare, owners: new Set(), messages: [], sources: [], hints: [], since: null, file: source.split(':')[0], callable: false });
  if (/\(\)$/.test(oldName) || message.includes(`${bare}()`)) entry.callable = true;
  if (owner) entry.owners.add(owner);
  if (since && !entry.since) entry.since = since;
  if (!entry.messages.includes(message)) { entry.messages.push(message); entry.sources.push(source); }
}
// also "has been replaced", thrown errors.
const messagePattern = /(?:warnOnce|warn|console\.warn|console\.error|error|new Error)\(\s*(['"`])((?:(?!\1).)*?(?:deprecated|renamed|has been removed|has been replaced)(?:(?!\1).)*)\1/gi;
const releaseFiles = [
  ...walk(path.join(three, 'src'), ['.js'], new Set()),
  ...walk(path.join(three, 'examples', 'jsm'), ['.js'], new Set(['libs'])),
];
const releaseText = new Map(releaseFiles.map((file) => [file, read(file) ?? '']));
for (const file of releaseFiles) {
  const text = releaseText.get(file);
  const relative = path.relative(three, file);
  const base = path.basename(file, '.js');
  for (const match of text.matchAll(messagePattern)) {
    const message = match[2].trim();
    if (message.includes('${')) continue;
    let name = oldNameFrom(message);
    const lineNo = text.slice(0, match.index).split('\n').length;
    const enclosing = [...text.slice(Math.max(0, match.index - 1500), match.index)
      .matchAll(/(?:function\s+|(?:const|let)\s+)([A-Za-z_$][\w$]*)\s*(?:=|\()/g)].pop()?.[1];
    if (name && enclosing && name !== enclosing && name.replace(/\(\)$/, '').toLowerCase() === enclosing.toLowerCase()) name = enclosing;
    const since = text.split('\n')[lineNo - 1].match(/@deprecated,?\s*(r\d+)/)?.[1];
    const owner = message.match(/^(?:THREE\.)?([A-Z][\w$]*)(?:\.[\w$]+)?:/)?.[1];
    if (name) record(name, message, `${relative}:${lineNo}`, owner && owner !== 'TSL' ? owner : base, since);
  }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*\*\s*@deprecated\b/.test(lines[i])) continue;
    let start = i; while (start > 0 && !/\/\*\*/.test(lines[start])) start -= 1;
    let end = i; while (end < lines.length && !/\*\//.test(lines[end])) end += 1;
    for (let k = end + 1; k < Math.min(lines.length, end + 3); k += 1) {
      if (lines[k].trim() === '') continue;
      // "this.name =" properties (GTAONode.distanceExponent in r186).
      const declaration = lines[k].match(
        /^\s*(?:export\s+)?(?:static\s+)?(?:async\s+)?(?:function\s+|const\s+|let\s+|class\s+|get\s+|set\s+|this\.)?([A-Za-z_$][\w$]*)\s*(?:=|\(|\{|extends)/);
      if (declaration && !['if', 'for', 'while', 'return', 'switch'].includes(declaration[1])) {
        // take the tag's text plus following lines, and fall back to the
        // block's "use X" sentence when the tag itself is bare (PI2 -> TWO_PI).
        const block = lines.slice(start, end + 1).map((l) => l.replace(/^\s*\/?\*+\/?\s?/, '').trim());
        const tagIndex = i - start;
        let note = block.slice(tagIndex).join(' ').split(/\s@(?!deprecated)/)[0].replace(/\s+/g, ' ').trim();
        const hint = /^@deprecated\s*[,.]?\s*$/.test(note)
          ? block.slice(0, tagIndex).join(' ').match(/[^.]*\b(?:[Pp]lease use|[Uu]se the|replaced by|renamed to)\b[^.]*\./)?.[0].trim() : null;
        record(declaration[1], note, `${relative}:${k + 1}`, base, lines[k].match(/@deprecated,?\s*(r\d+)/)?.[1]);
        if (/^\s*(?:static\s+)?(?:async\s+)?[A-Za-z_$][\w$]*\s*\(/.test(lines[k])) { const e = found.get(declaration[1]); if (e) e.callable = true; }
        if (hint) found.get(declaration[1])?.hints.push(hint);
      }
      break;
    }
  }
}
// A bare "@deprecated" adds nothing when the release also prints a message.
for (const entry of found.values()) {
  if (entry.messages.length > 1) {
    const keep = entry.messages.map((m, i) => [m, entry.sources[i]]).filter(([m]) => !/^@deprecated\s*(?:\(.*\))?$/.test(m));
    entry.messages = keep.map(([m]) => m); entry.sources = keep.map(([, s]) => s);
  }
  if (entry.messages.every((m) => /^@deprecated\s*[,.]?\s*$/.test(m)) && entry.hints.length) entry.messages = [`@deprecated ${entry.hints[0]}`];
  const chainable = new RegExp(`addMethodChaining\\(\\s*'${entry.name}'`);
  entry.exported = allExports.has(entry.name) || exportsOf(path.join(three, entry.file)).has(entry.name);
  entry.chain = entry.exported && tslExports.has(entry.name)
    && releaseFiles.some((f) => f.includes(`${path.sep}nodes${path.sep}`) && chainable.test(releaseText.get(f)));
  if (entry.chain) entry.callable = true;
  entry.replacement = /Async$/.test(entry.name) && /renderer\.init\(\)/.test(entry.messages.join(' '))
    ? `${entry.name.replace(/Async$/, '')}() after one "await renderer.init()"` : entry.messages.join(' ').match(/(?:[Uu]se|renamed to|replaced by|[Pp]lease use)\s+(?:the non-deprecated version\s+)?[`"{]?(?:@link\s+)?\.?([A-Za-z_$][\w$.#]*(?:\(\))?)/)?.[1] ?? null;
}
for (const entry of found.values()) {
  // "has been removed" with no "Using X instead" fallback: the call now does nothing or throws.
  entry.removed = entry.messages.some((m) => /has been removed/i.test(m))
    && !entry.messages.some((m) => !m.startsWith('@deprecated') && /\bUsing\b[^.]*\binstead\b|deprecated/i.test(m));
}
const deprecations = [...found.values()].sort((a, b) => a.name.localeCompare(b.name));

// ---------------------------------------------------------------- project side
// blank out comments (/* */ across lines, //, <!-- -->) and string
// contents, keeping module specifiers and line structure. Handles CRLF.
function codeOnly(text, markup) {
  const out = [];
  const blank = (s) => s.replace(/[^\r\n]/g, ' ');
  let plain = 0; // start of the pending run of ordinary code
  const flush = (i) => { if (i > plain) out.push(text.slice(plain, i)); };
  for (let i = 0; i < text.length;) {
    const c = text[i];
    const next = text[i + 1];
    let stop = -1;
    let replacement = null;
    if (markup && c === '<' && text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4); stop = end < 0 ? text.length : end + 3;
      replacement = blank(text.slice(i, stop));
    } else if (c === '/' && next === '/') {
      stop = i; while (stop < text.length && text[stop] !== '\n' && text[stop] !== '\r') stop += 1;
      replacement = blank(text.slice(i, stop));
    } else if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2); stop = end < 0 ? text.length : end + 2;
      replacement = blank(text.slice(i, stop));
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== c && (c === '`' || text[j] !== '\n')) j += text[j] === '\\' ? 2 : 1;
      stop = Math.min(j + 1, text.length);
      const literal = text.slice(i, stop);
      const specifier = /(?:\bfrom|\bimport|\bimport\s*\(|\brequire\s*\()\s*$/.test(text.slice(Math.max(0, i - 40), i));
      replacement = specifier || c === '`' ? literal : c + blank(literal.slice(1, -1)) + (literal.length > 1 ? literal.slice(-1) : '');
    }
    if (replacement === null) { i += 1; continue; }
    flush(i); out.push(replacement); i = stop; plain = stop;
  }
  flush(text.length);
  return out.join('');
}
const IDENT = '[A-Za-z_$][\\w$]*';
function importsOf(code) {
  const namespaces = new Map([['THREE', null], ['TSL', 'tsl']]); // alias -> target file (null: any)
  const bindings = new Map(); // local name -> { imported, specifier, target }
  const specifiers = [];
  const add = (local, imported, specifier, target) => bindings.set(local, { imported, specifier, target });
  for (const m of code.matchAll(/\bimport\s+(?:type\s+)?([\w$*{}\s,]+?)\s+from\s*(['"])([^'"]+)\2|\bimport\s*\(\s*(['"])([^'"]+)\4|\brequire\s*\(\s*(['"])([^'"]+)\6\s*\)/g)) {
    const specifier = m[3] ?? m[5] ?? m[7];
    const target = threeTarget(specifier);
    specifiers.push({ specifier, target, index: m.index });
    if (target === undefined || !m[1]) continue;
    const clause = m[1];
    const ns = clause.match(new RegExp(`\\*\\s*as\\s+(${IDENT})`));
    if (ns) namespaces.set(ns[1], target);
    const named = clause.match(/\{([^}]*)\}/);
    for (const part of named ? named[1].split(',') : []) {
      const [imported, local] = part.replace(/^\s*type\s+/, '').trim().split(/\s+as\s+/);
      if (imported) add((local ?? imported).trim(), imported.trim(), specifier, target);
    }
  }
  for (const m of code.matchAll(new RegExp(`\\b(?:const|let|var)\\s+(${IDENT})\\s*=\\s*require\\(\\s*['"]three[^'"]*['"]\\s*\\)`, 'g'))) namespaces.set(m[1], null);
  // const { Fn, uniform } = THREE.TSL / TSL / THREE
  for (const m of code.matchAll(new RegExp(`\\b(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*(${IDENT})(\\.TSL)?\\b`, 'g'))) {
    if (!namespaces.has(m[2])) continue;
    for (const part of m[1].split(',')) {
      const [imported, local] = part.trim().split(/\s*:\s*/);
      if (imported) add((local ?? imported).trim(), imported.trim(), `${m[2]}${m[3] ?? ''}`, m[3] ? 'tsl' : null);
    }
  }
  return { namespaces, bindings, specifiers };
}
// Names common enough in ordinary code that a bare word match means nothing:
// they need a receiver created from the three class.
const RECEIVER = { scale: 'Matrix3', rotate: 'Matrix3', translate: 'Matrix3', parse: 'DRACOExporter' };

const extensions = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx', '.html', '.vue', '.svelte'];
const projectFiles = walk(root, extensions, new Set(['node_modules']), new Set(['dist', 'build', 'out', 'coverage']), 0, true);
const deprecatedByName = new Map(deprecations.map((d) => [d.name, d]));
const anyName = new RegExp(`\\b(?:${deprecations.map((d) => d.name.replace(/[$]/g, '\\$')).join('|')})\\b`);
const uses = [];
const missing = [];
let scanned = 0;
// Method and function names the project defines itself: a member call to one of
// these (settings.setResolution(w, h)) is more likely the project's own.
const projectDefined = new Set();
const definition = new RegExp(`(?:function\\s+|(?<![.\\w$]))(${deprecations.map((d) => d.name.replace(/[$]/g, '\\$')).join('|')})\\s*\\([^)]*\\)\\s*\\{|\\b(${deprecations.map((d) => d.name.replace(/[$]/g, '\\$')).join('|')})\\s*=\\s*(?:async\\s*)?(?:function\\b|\\([^)]*\\)\\s*=>)`, 'g');
const ambiguous = new Map();
for (const file of projectFiles) {
  const text = read(file) ?? '';
  for (const m of text.matchAll(definition)) projectDefined.add(m[1] ?? m[2]);
}
for (const file of projectFiles) {
  const text = read(file);
  if (text === null) continue;
  // a vendored or bundled three build is not the project's own code.
  if (/Copyright 20\d\d-20\d\d Three\.js Authors/.test(text.slice(0, 600)) || /\bREVISION\s*=\s*['"]\d+/.test(text.slice(0, 20000))) {
    skipped.push(`${rel(file)} (vendored three.js build)`); continue;
  }
  if (text.length > 4e6) { skipped.push(`${rel(file)} (${(text.length / 1e6).toFixed(1)} MB, generated?)`); continue; }
  if (text.length > 1e5 && /[^\n]{5000}/.test(text)) { skipped.push(`${rel(file)} (minified bundle)`); continue; }
  scanned += 1;
  const code = codeOnly(text, /\.(?:html|vue|svelte)$/.test(file));
  const { namespaces, bindings, specifiers } = importsOf(code);
  const usesThree = specifiers.some((s) => s.target !== undefined) || /\b(?:THREE|TSL)\./.test(code);
  // Variables that hold a node made by a three/TSL call: const u = uniform(1), this.u = THREE.TSL.uniform(1)
  const nodeVars = new Set();
  for (const m of code.matchAll(new RegExp(`(?:this\\.)?(${IDENT})\\s*=\\s*(?:(${IDENT})\\.)?(?:TSL\\.)?(${IDENT})\\s*\\(`, 'g'))) {
    if ((m[2] && namespaces.has(m[2])) || (!m[2] && bindings.has(m[3]))) nodeVars.add(m[1]);
  }
  const lines = code.split('\n');
  const rawLines = text.split('\n');
  const starts = [0];
  for (let i = code.indexOf('\n'); i >= 0; i = code.indexOf('\n', i + 1)) starts.push(i + 1);
  const lineOf = (index) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= index) lo = mid; else hi = mid - 1; } return lo + 1; };
  const push = (list, item) => list.push({ file: rel(file), ...item, code: rawLines[item.line - 1].trim().slice(0, 140) });

  // Imports of paths or names this release does not ship.
  for (const s of specifiers) {
    if (s.target === null) push(missing, { line: lineOf(s.index), name: s.specifier, message: `"${s.specifier}" does not exist in three ${version}.` });
  }
  for (const [local, b] of bindings) {
    if (local !== b.imported && deprecatedByName.has(b.imported) && !RECEIVER[b.imported]) {   // import { PostProcessing as PP }
      const at = code.search(new RegExp(`\\b${b.imported.replace(/[$]/g, '\\$')}\\s+as\\s+${local.replace(/[$]/g, '\\$')}\\b`));
      if (at >= 0) push(uses, { line: lineOf(at), name: b.imported });
    }
    const target = b.target === 'tsl' ? path.join(three, 'build', 'three.tsl.js') : b.target;
    if (!target) continue;
    const names = target === null ? allExports : exportsOf(target);
    if (!names.has(b.imported) && !deprecatedByName.has(b.imported) && !typeNames.has(b.imported)) {
      const at = code.search(new RegExp(`\\b${b.imported.replace(/[$]/g, '\\$')}\\b`));
      push(missing, { line: lineOf(Math.max(at, 0)), name: b.imported, message: `${b.specifier} does not export "${b.imported}" in three ${version}.` });
    }
  }
  for (const [alias, target] of namespaces) {
    const names = target === 'tsl' ? tslExports : target ? exportsOf(target) : allExports;
    for (const m of code.matchAll(new RegExp(`(?<![\\w$.])${alias}\\.(${IDENT})`, 'g'))) {
      if (alias === 'THREE' && m[1] === 'TSL') continue;
      if (!names.has(m[1]) && !deprecatedByName.has(m[1]) && !typeNames.has(m[1]) && /^[A-Z]|^[a-z]+[A-Z]/.test(m[1])) {
        push(missing, { line: lineOf(m.index), name: `${alias}.${m[1]}`, message: `${m[1]} is not exported by three ${version}${target ? ` (${path.relative(three, target === 'tsl' ? path.join(three, 'build/three.tsl.js') : target)})` : ''}.` });
      }
    }
  }

  // Deprecated names, import-aware.
  const receivers = {};
  for (const [name, cls] of Object.entries(RECEIVER)) {
    receivers[name] = [...code.matchAll(new RegExp(`(${IDENT})\\s*=\\s*new\\s+(?:${IDENT}\\.)?${cls}\\s*\\(`, 'g'))].map((m) => m[1]);
  }
  lines.forEach((line, index) => {
    if (!anyName.test(line)) return;
    for (const m of line.matchAll(new RegExp(anyName.source, 'g'))) {
      const entry = deprecatedByName.get(m[0]);
      const before = line.slice(Math.max(0, m.index - 200), m.index);
      const after = line.slice(m.index + m[0].length);
      const member = /\.\s*$/.test(before);
      const nsMatch = before.match(new RegExp(`(${IDENT})(\\.TSL)?\\.\\s*$`));
      let hit = false;
      if (RECEIVER[entry.name]) {
        hit = member && (receivers[entry.name].includes(nsMatch?.[1]) || new RegExp(`\\b${RECEIVER[entry.name]}\\b`).test(line)) && /^\s*\(/.test(after);
      } else if (entry.name === 'resolution') {
        const owners = [...code.matchAll(new RegExp(`(${IDENT})\\s*=\\s*(?:reflector|gaussianBlur)\\s*\\(`, 'g'))].map((r) => r[1]);
        if (member && owners.includes(nsMatch?.[1])) { hit = true; }
        const window = lines.slice(Math.max(0, index - 6), index + 1).join('\n');
        hit ||= /\b(?:reflector|gaussianBlur)\s*\((?:[^()]|\([^()]*\))*$/.test(window.slice(0, window.length - line.length + m.index));
      } else if (entry.exported && nsMatch && namespaces.has(nsMatch[1])) {
        hit = true;                                          // THREE.Clock, TSL.cache
      } else if (entry.exported && !member && bindings.has(m[0])) {
        hit = true;                                          // imported from three by name
      } else if (entry.exported && !member && entry.name.length >= 12 && !bindings.has(m[0])
        && !new RegExp(`(?:function\\s+|class\\s+|(?:const|let|var)\\s+|import\\s*\\{[^}]*)\\b${m[0]}\\b`).test(code)) {
        hit = true;                                          // distinctive TSL/core name used bare
      } else if (member && (!entry.exported || entry.chain)) {
        // a method or property: only as a member, only if the file does not define it itself
        const ownDefinition = new RegExp(`(?:function\\s+${m[0]}\\b|(?:const|let|var)\\s+${m[0]}\\s*=|(?<![.\\w$])${m[0]}\\s*\\([^)]*\\)\\s*\\{)`).test(code);
        // a TSL chain method needs a node receiver: foo(...).label(, a line starting .label(, or a node variable
        const nodeReceiver = /\)\s*\.\s*$|^\s*\.\s*$/.test(before) || nodeVars.has(nsMatch?.[1]);
        hit = !ownDefinition && (!entry.chain || (usesThree && nodeReceiver)) && (!entry.callable || /^\s*\(/.test(after));
        if (hit && projectDefined.has(entry.name) && !entry.chain) { ambiguous.set(entry.name, (ambiguous.get(entry.name) ?? 0) + 1); hit = false; }
      } else if (!member && !entry.exported && /^\s*:/.test(after)) {
        hit = usesThree && /^[a-z]\w*Node$/.test(entry.name); // { lineColorNode: ... } options
      }
      if (hit && !uses.some((u) => u.file === rel(file) && u.line === index + 1 && u.name === entry.name)) {
        push(uses, { line: index + 1, name: entry.name });
      }
    }
  });
}
uses.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
missing.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
const label = (d) => `${d.owners.size === 1 && !d.exported && ![...d.owners].includes(d.name) ? `${[...d.owners][0]}.` : ''}${d.name}`;

if (json) {
  console.log(JSON.stringify({
    version, threeDir: three, root, declared, scanned, skipped,
    deprecations: deprecations.map(({ name, owners, messages, sources, since, replacement, exported, removed }) =>
      ({ name, owners: [...owners], since, replacement, kind: exported ? 'export' : 'member', removed, messages, sources })),
    uses: uses.map((u) => ({ ...u, removed: deprecatedByName.get(u.name).removed, replacement: deprecatedByName.get(u.name).replacement, messages: deprecatedByName.get(u.name).messages })),
    missing, ambiguous: Object.fromEntries(ambiguous),
  }, null, 2));
} else {
  const where = path.relative(root, three).startsWith('..') ? three : path.relative(root, three);
  console.log(`three ${version} at ${where}${declared ? ` (package.json asks for "${declared}")` : ''}`);
  console.log(`Scanned ${scanned} source files.${skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? ', ...' : ''}` : ''}`);
  const shown = listAll ? deprecations : deprecations.filter((d) => uses.some((u) => u.name === d.name));
  if (missing.length) {
    console.log(`\n${missing.length} imports or names that do not exist in three ${version} (these throw or are undefined; replacements are in webgpu-cookbook.md):`);
    for (const m of missing) console.log(`  ${m.file}:${m.line}  ${m.name}\n      ${m.code}\n      -> ${m.message}`);
  }
  const printUses = (list, heading) => {
    if (!list.length) return;
    console.log(`\n${list.length} ${heading}`);
    for (const u of list) {
      const d = deprecatedByName.get(u.name);
      console.log(`  ${u.file}:${u.line}  ${label(d)}${d.replacement ? `  ->  ${d.replacement}` : ''}${d.since ? `  [${d.since}]` : ''}\n      ${u.code}`);
      for (const message of d.messages) console.log(`      -> ${message}`);
    }
  };
  printUses(uses.filter((u) => deprecatedByName.get(u.name).removed),
    'uses of removed API (the call now does nothing or throws; replace, see webgpu-cookbook.md):');
  printUses(uses.filter((u) => !deprecatedByName.get(u.name).removed),
    'uses of deprecated API (still works, prints a warning; replace):');
  if (ambiguous.size) console.log(`\nNot reported (the project defines its own method of that name): ${[...ambiguous].map(([n, c]) => `.${n}() x${c}`).join(', ')}`);
  if (!uses.length && !missing.length) console.log('\nNo deprecated or missing three.js names found in the project source.');
  console.log(`\n${deprecations.length} deprecated names in this release${listAll ? ':' : ' (--all lists them).'}`);
  for (const d of shown.filter(() => listAll)) console.log(`  ${label(d).padEnd(34)} ${d.messages[0]}  (${d.sources[0]})`);
  console.log('Not covered: API removed without a trace in the release, argument-order and option-object changes,\n'
    + 'and properties that are silently ignored. See the renamed-and-removed tables in webgpu-cookbook.md in the skill.');
}
