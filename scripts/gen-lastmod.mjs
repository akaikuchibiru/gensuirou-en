// sitemap の <lastmod> を git から作る。
//
//   node scripts/gen-lastmod.mjs        # src/lastmod.js を書き出す
//
// なぜ git か:
//   lastmod は「正確なときだけ使う」と Google が明言している。deploy 日時を
//   入れると、中身が変わっていない日も更新したことになり、そのうち丸ごと
//   無視される。**その URL の中身を作っているファイルが最後に変わった日**が
//   唯一正しい値なので、git から採る。
//
// どのファイルがその URL を作っているか:
//   /            public/index.html
//   /rooms/<室>  src/rooms.js, src/room-photos.js, src/room-page.js
//   /journal/…   src/journal.js
//   その他       public/<名前>.html
//   すべての URL は src/i18n.js にも依存する (title と description をここで
//   持っているので、書き換えたらその URL の中身は変わっている)。
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { PAGES } from '../src/i18n.js';

const gitDate = (file) => {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { encoding: 'utf8' }).trim();
    return out || null;
  } catch { return null; }
};

const cache = new Map();
const dateOf = (file) => {
  if (!cache.has(file)) cache.set(file, gitDate(file));
  return cache.get(file);
};

const COMMON = ['src/i18n.js'];

function sourcesFor(path, meta) {
  if (meta.room) return ['src/rooms.js', 'src/room-photos.js', 'src/room-page.js'];
  if (meta.journal) return ['src/journal.js'];
  if (path === '/') return ['public/index.html'];
  return [`public${path}.html`];
}

const out = {};
for (const [path, meta] of Object.entries(PAGES)) {
  const dates = [...sourcesFor(path, meta), ...COMMON].map(dateOf).filter(Boolean).sort();
  if (dates.length) out[path] = dates[dates.length - 1];
}

const body = `// 自動生成 — scripts/gen-lastmod.mjs
//
// sitemap の <lastmod>。**その URL の中身を作っているファイルが最後に
// 変わった日** (git の commit 日) で、deploy した日ではない。
// 中身を変えたら生成し直す。古いまま残っても嘘にはならない
// (「その日から変わっていない」は正しい) が、新しい記事を足したのに
// 古い日付のままだと、拾われるのが遅れる。
export const LASTMOD = ${JSON.stringify(out, null, 1)};
`;
writeFileSync(new URL('../src/lastmod.js', import.meta.url), body);
console.log(`lastmod を ${Object.keys(out).length} URL ぶん書き出した`);
const uniq = [...new Set(Object.values(out))].sort();
console.log(`  日付の種類: ${uniq.join(' , ')}`);
