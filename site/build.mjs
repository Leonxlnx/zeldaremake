#!/usr/bin/env node
/**
 * Build the static Director's Monitor for GitHub Pages. No dependencies.
 *
 *   node site/build.mjs [--data <monitorDir>] [--out <dir>]
 *
 * - copies the static site files (index.html, styles.css, app.js, js/, assets/) into <out>/
 *   (dev/, *.mjs and *.md are not deployed)
 * - copies the monitor data directory into <out>/data/
 * - writes <out>/.nojekyll
 * - succeeds without a data dir: writes an empty takes.json so the site shows its waiting state;
 *   rubric.json and reference frames fall back to the repo copies when the data dir lacks them
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SITE_DIR, '..');

const args = parseArgs(process.argv.slice(2));
const DATA_DIR = path.resolve(args.data || path.join(ROOT, '.monitor'));
const OUT_DIR = path.resolve(args.out || path.join(ROOT, 'dist-site'));

const EMPTY_TAKES = { project: 'zeldaremake', updatedAt: null, takes: [] };
const SKIP_TOP = new Set(['dev', 'node_modules', '.DS_Store']);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    }
  }
  return out;
}

function copyTree(src, dest, filter = () => true) {
  let n = 0;
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      const s = path.join(src, name);
      if (!filter(s, name)) continue;
      n += copyTree(s, path.join(dest, name), filter);
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    n = 1;
  }
  return n;
}

if (path.relative(OUT_DIR, SITE_DIR) === '' || OUT_DIR === ROOT) {
  console.error(`refusing to build into ${OUT_DIR}`);
  process.exit(2);
}
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// 1. static site files
const siteFiles = copyTree(SITE_DIR, OUT_DIR, (abs, name) => {
  const rel = path.relative(SITE_DIR, abs);
  const top = rel.split(path.sep)[0];
  if (SKIP_TOP.has(top)) return false;
  if (/\.(mjs|md)$/i.test(name)) return false;
  if (path.resolve(abs) === OUT_DIR) return false;
  return true;
});
console.log(`site   ${siteFiles} files → ${OUT_DIR}`);

// 2. data
const outData = path.join(OUT_DIR, 'data');
fs.mkdirSync(outData, { recursive: true });
if (fs.existsSync(DATA_DIR) && fs.statSync(DATA_DIR).isDirectory()) {
  const n = copyTree(DATA_DIR, outData, (abs, name) => name !== '.git');
  console.log(`data   ${n} files ← ${DATA_DIR}`);
} else {
  console.log(`data   ${DATA_DIR} not found → empty takes.json (waiting state)`);
}
const takesPath = path.join(outData, 'takes.json');
if (!fs.existsSync(takesPath)) {
  fs.writeFileSync(takesPath, `${JSON.stringify(EMPTY_TAKES, null, 2)}\n`);
  console.log('data   wrote empty takes.json');
} else {
  try { JSON.parse(fs.readFileSync(takesPath, 'utf8')); } catch (e) {
    console.warn(`data   takes.json is not valid JSON (${e.message}) → replaced with empty takes.json`);
    fs.writeFileSync(takesPath, `${JSON.stringify(EMPTY_TAKES, null, 2)}\n`);
  }
}

// 3. fallbacks so the waiting state still shows the rubric and the reference reel
const rubricOut = path.join(outData, 'rubric.json');
const rubricSrc = path.join(ROOT, 'gauntlet', 'rubric.json');
if (!fs.existsSync(rubricOut) && fs.existsSync(rubricSrc)) {
  fs.copyFileSync(rubricSrc, rubricOut);
  console.log('data   rubric.json ← gauntlet/rubric.json (fallback)');
}
const refOut = path.join(outData, 'reference', 'frames');
const refSrc = path.join(ROOT, 'reference', 'frames');
if (!fs.existsSync(refOut) && fs.existsSync(refSrc)) {
  const n = copyTree(refSrc, refOut, (abs, name) => /\.(jpe?g|png|webp|json)$/i.test(name) || fs.statSync(abs).isDirectory());
  console.log(`data   reference/frames ← reference/frames (${n} files, fallback)`);
}
const agentsOut = path.join(outData, 'agents.json');
if (!fs.existsSync(agentsOut)) {
  const agents = readAgentsFrontMatter(path.join(ROOT, '.agents'));
  fs.writeFileSync(agentsOut, `${JSON.stringify({ agents }, null, 2)}\n`);
  console.log(`data   agents.json ← .agents/*.md front-matter (${agents.length} agents, fallback)`);
}

// 4. Pages housekeeping
fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');
console.log(`done   ${OUT_DIR}`);

/** Minimal YAML front-matter reader for .agents/<id>.md (key: value lines only). */
function readAgentsFrontMatter(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md') || /^(TEMPLATE|INBOX)\.md$/i.test(name)) continue;
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) continue;
    const fm = {};
    for (const line of m[1].split(/\r?\n/)) {
      const mm = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (mm) fm[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, '');
    }
    if (!fm.agent) continue;
    const task = text.match(/^## Current task\s*\r?\n([\s\S]*?)(?:\r?\n\r?\n|\r?\n## |$)/m);
    out.push({
      agent: fm.agent,
      runtime: fm.runtime || '',
      github: fm.github || '',
      status: fm.status || 'unknown',
      branch: fm.branch || '',
      updated: fm.updated || null,
      currentTask: task ? task[1].replace(/\s+/g, ' ').trim() : '',
    });
  }
  return out;
}
