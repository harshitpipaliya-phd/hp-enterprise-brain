/**
 * WHY THIS SCRIPT EXISTS.
 *
 * The page title rendered dark-on-dark for a reason that is invisible in the
 * source: `.u-ph__title { color }` in pageHeader.css lost to
 * `.s-content-inner h1 { color }` in refine.css, because a class-plus-element
 * selector outranks a lone class no matter which file is loaded last. Reading
 * either file on its own showed nothing wrong.
 *
 * So the fix is checked the way the browser decides it — by specificity across
 * every stylesheet the app loads — rather than by looking at the header and
 * agreeing that it seems fine. It walks the real import list in main.tsx, finds
 * every rule that could colour a header line, ranks them, and reports which one
 * actually wins.
 *
 * Run: node scripts/audit-header-cascade.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** The stylesheets, in the order main.tsx imports them — order breaks ties. */
function loadSheets() {
  const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');
  const order = [...main.matchAll(/^import\s+'(\.\/[^']+\.css)';/gm)].map((m) => m[1]);
  return order.map((rel) => ({
    file: rel,
    css: readFileSync(join(SRC, rel.replace(/^\.\//, '')), 'utf8'),
  }));
}

/** Strips comments, then yields { selector, body } for every top-level rule,
 *  descending one level into @media / @container / @supports blocks. */
function* rules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    const sel = m[1].trim();
    if (sel.startsWith('@')) continue;      // at-rule preludes carry no selector
    yield { selector: sel, body: m[2] };
  }
}

/** (id, class, element) — :where() contributes zero, which the fix relies on. */
function specificity(sel) {
  let s = sel.replace(/:where\([^)]*\)/g, '');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)(?!where)[\w-]+(\([^)]*\))?/g) || []).length;
  const elements = (s.replace(/\.[\w-]+|#[\w-]+|\[[^\]]+\]|::?[\w-]+(\([^)]*\))?/g, ' ')
    .match(/\b[a-zA-Z][\w-]*\b/g) || []).length;
  return [ids, classes, elements];
}

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * Which rule wins `color` for one header line, among the rules that can match
 * it. A selector is treated as matching when every one of its compound parts is
 * satisfied by the element's own classes/tag or by one of its ancestors — the
 * header's real DOM path, which is fixed by the component.
 */
function winner(sheets, ancestors, selfClasses, selfTag, prop) {
  const pool = [...ancestors, [...selfClasses, selfTag]];
  let best = null;
  let order = 0;

  for (const { file, css } of sheets) {
    for (const { selector, body } of rules(css)) {
      order += 1;
      const decl = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(body);
      if (!decl) continue;

      for (const one of selector.split(',').map((x) => x.trim())) {
        if (!one) continue;
        const parts = one.split(/\s+|>/).filter(Boolean);
        const last = parts[parts.length - 1];
        // The subject of the selector must match the element itself.
        const tokens = (t) => (t.match(/\.[\w-]+|^[a-zA-Z][\w-]*/g) || []);
        const satisfied = (tok, box) =>
          tok.every((k) => box.includes(k.startsWith('.') ? k.slice(1) : k));
        if (!satisfied(tokens(last.replace(/:where\([^)]*\)|::?[\w-]+(\([^)]*\))?/g, '')), pool[pool.length - 1])) continue;
        // Every ancestor part must be satisfied by some ancestor, in order.
        let i = 0;
        let ok = true;
        for (const p of parts.slice(0, -1)) {
          const tok = tokens(p.replace(/:where\([^)]*\)|::?[\w-]+(\([^)]*\))?/g, ''));
          while (i < pool.length - 1 && !satisfied(tok, pool[i])) i += 1;
          if (i >= pool.length - 1) { ok = false; break; }
          i += 1;
        }
        if (!ok) continue;

        const spec = specificity(one);
        const important = /!important/i.test(decl[1]);
        const rank = [important ? 1 : 0, ...spec, order];
        if (!best || cmp(rank, best.rank) > 0) {
          best = { rank, spec, file, selector: one, value: decl[1].trim(), important };
        }
      }
    }
  }
  return best;
}

const sheets = loadSheets();

// The header's real DOM path, as rendered by ui/pageHeader.tsx.
const PAGE = [['s-content', 'main'], ['s-content-inner', 'div'], ['evidence-intel', 'div'], ['u-ph', 'header']];
const TEXT = [...PAGE, ['u-ph__bar', 'div'], ['u-ph__lead', 'div'], ['u-ph__text', 'div']];

const checks = [
  { what: 'page title',   ancestors: [...TEXT, ['u-ph__titlerow', 'div']], classes: ['u-ph__title'], tag: 'h1', expect: 'var(--ph-title-ink)' },
  { what: 'description',  ancestors: TEXT, classes: ['u-ph__desc'], tag: 'p', expect: 'var(--ph-desc-ink)' },
];

let failed = 0;
for (const c of checks) {
  const w = winner(sheets, c.ancestors, c.classes, c.tag, 'color');
  const ok = w && w.value === c.expect;
  if (!ok) failed += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${c.what.padEnd(12)} color: ${w ? w.value : '(none)'}` +
    `${w ? `   <- ${w.file}  "${w.selector}"  specificity ${w.spec.join(',')}` : ''}`
  );
  if (!ok) console.log(`      expected ${c.expect}`);
}

// The title must also out-rank the normalisation layer on size.
const size = winner(sheets, [...TEXT, ['u-ph__titlerow', 'div']], ['u-ph__title'], 'h1', 'font-size');
const sizeOk = size && size.value.includes('--ph-title-size');
if (!sizeOk) failed += 1;
console.log(`${sizeOk ? 'PASS' : 'FAIL'}  title size   font-size: ${size ? size.value : '(none)'}   <- ${size ? size.file : ''}`);

console.log(failed === 0 ? '\nHeader cascade OK.' : `\n${failed} header line(s) lose the cascade.`);
process.exit(failed === 0 ? 0 : 1);
