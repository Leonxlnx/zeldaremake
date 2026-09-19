// A small, safe Markdown renderer for the evidence READMEs and survey reports (headings,
// paragraphs, lists, tables, block quotes, fenced code, inline code / bold / italic / strike /
// links / images). Everything is HTML-escaped first; links open in a new tab and only http(s)
// and relative hrefs survive; images resolve against `base` (the evidence set's directory).
//
// Inline markup is built in passes over the escaped text. Code spans, links and images are
// replaced by a placeholder (a private-use sentinel around an index — written as an escape so the
// source stays plain text, and stripped from the input first so a README can never forge one)
// before the emphasis passes run, so `**` / `*` / `~~` only ever see prose, never attributes.

import { esc } from './util.js';

const SAFE_HREF = /^(https?:\/\/|\.\/|\.\.\/|[A-Za-z0-9_./-]+$|#)/;
const S = ''; // sentinel (private use area); never appears in prose
const SENTINEL_RE = /(\d+)/g;

function resolve(src, base) {
  if (!base || /^(https?:)?\/\//.test(src) || src.startsWith('/')) return src;
  return `${base.replace(/\/?$/, '/')}${src.replace(/^\.\//, '')}`;
}

/** `**bold**`, `*italic*`, `~~strike~~` on prose that carries no tags */
function emphasis(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>');
}

function inline(text, base) {
  // escape first: from here on `s` holds no raw `<`, `>`, `"`, `&` — every captured value is already safe in an attribute
  let s = esc(text).replace(//g, '');
  const stash = [];
  const keep = (html) => `${S}${stash.push(html) - 1}${S}`;
  s = s.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${c}</code>`));
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => (SAFE_HREF.test(src) ? keep(`<img class="md-img" src="${resolve(src, base)}" alt="${alt}" loading="lazy">`) : alt));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => {
    if (!SAFE_HREF.test(href)) return t;
    const url = /^https?:/.test(href) || href.startsWith('#') ? href : resolve(href, base);
    return keep(`<a href="${url}" target="_blank" rel="noopener">${emphasis(t)}</a>`);
  });
  s = emphasis(s);
  return s.replace(SENTINEL_RE, (_, i) => stash[Number(i)] ?? '');
}

function tableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}
const isTableSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/** Markdown → HTML string (safe to assign to innerHTML). `base` prefixes relative image/link paths. */
export function renderMarkdown(text, { base = '' } = {}) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '), base)}</p>`);
    para.length = 0;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { flush(); i++; continue; }
    const fence = /^\s*```/.exec(line);
    if (fence) {
      flush();
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); const lvl = Math.min(6, h[1].length + 1); out.push(`<h${lvl}>${inline(h[2].replace(/\s+#+\s*$/, ''), base)}</h${lvl}>`); i++; continue; }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flush();
      const head = tableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(tableRow(lines[i++]));
      out.push(`<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${inline(c, base)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? '', base)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flush();
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'), { base })}</blockquote>`);
      continue;
    }
    const li = /^\s*(?:[-*+]|\d+[.)])\s+/.exec(line);
    if (li) {
      flush();
      const ordered = /^\s*\d/.test(line);
      const items = [];
      while (i < lines.length && /^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[i])) {
        let item = lines[i++].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');
        // continuation lines (indented) belong to the item
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[i])) item += ` ${lines[i++].trim()}`;
        items.push(`<li>${inline(item, base)}</li>`);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); out.push('<hr>'); i++; continue; }
    para.push(line.trim());
    i++;
  }
  flush();
  return out.join('\n');
}

/** The first `# heading` of a Markdown text, or null. */
export function markdownTitle(text) {
  const m = /^#\s+(.+?)\s*$/m.exec(String(text ?? ''));
  return m ? m[1].replace(/`/g, '').trim() : null;
}
