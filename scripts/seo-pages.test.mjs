// Pure, in-memory template tests. Never runs tsc, Vite, network calls or writes dist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.js') && specifier.startsWith('.') && context.parentURL) {
    const source = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
    if (existsSync(source)) return nextResolve(source.href, context);
  }
  return nextResolve(specifier, context);
}});
const [seo, panchangLib, packs, entitlements, routing, publicSeo, legal] = await Promise.all(
  ['seo-content','panchang','credit-packs','entitlements','seo-routing','seo-public','legal-policies']
    .map(name => import(`../src/lib/${name}.ts`)));
const source = readFileSync(new URL('./prerender-seo-pages.mjs', import.meta.url), 'utf8');
const definitions = source.slice(source.indexOf('const {\n  SEO_CONTENT_PAGES'), source.indexOf('// ── Run ─'))
  .replace('const panchangByDate = await loadPanchangData();', 'const panchangByDate = new Map();');
const context = { seo, panchangLib, packs, entitlements, routing, publicSeo, legal, path,
  process: { env: {} }, baseUrl: 'https://astroyou.netlify.app', today: '2026-09-10', Map, Set, Date, console };
const { pages, injectPage, writeSitemap, buildHostingFiles, panchangByDate, panchangDatePage } = vm.runInNewContext(`${definitions}\n({pages, injectPage, writeSitemap, buildHostingFiles, panchangByDate, panchangDatePage});`, context);
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('all public tools have their own HTML and canonical', () => {
  for (const page of pages) {
    const html = injectPage(template, page);
    assert.ok(html.includes(`href="https://astroyou.netlify.app${page.path}"`), page.path);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, page.path);
    assert.equal((html.match(/type="application\/ld\+json"/g) || []).length, 1, page.path);
    assert.ok(html.includes('id="astroyou-structured-data"'), page.path);
  }
  for (const { path: route } of publicSeo.PUBLIC_TOOL_PAGES) assert.ok(pages.some(page => page.path === route));
});
test('empty Panchang dates are excluded from indexing and sitemap', async () => {
  const dates = pages.filter(page => page.path.startsWith('/panchang/'));
  assert.equal(dates.length, 180);
  assert.ok(dates.every(page => page.noindex));
  assert.ok(dates.every(page => injectPage(template, page).includes('content="noindex, follow"')));
  let sitemap;
  context.distDir = '/unused';
  context.writeFile = async (_path, text) => { sitemap = text; };
  await writeSitemap();
  assert.ok(!sitemap.includes('/panchang/20'));
  assert.ok(sitemap.includes('/free-kundali</loc>'));
});
test('every indexable page is discoverable through HTML navigation', () => {
  const directory = pages.find(page => page.path === '/explore');
  for (const page of pages.filter(page => !page.noindex && page.path !== '/explore')) {
    assert.ok(directory.links.some(link => link.href === page.path), page.path);
    assert.ok(page.links.some(link => link.href === '/explore'), page.path);
  }
});
test('descriptions are concise and page titles remain unique', () => {
  const titles = new Set();
  for (const page of pages) {
    assert.ok(page.description.length <= 160, page.path);
    const title = routing.searchTitle(page.title);
    assert.ok(title.length <= 60, `Long title: ${title}`);
    assert.ok(!titles.has(title), `Duplicate title: ${title}`);
    titles.add(title);
  }
});

test('hosting preserves app routes without rewriting unknown URLs to the homepage', () => {
  const { shell, notFound, redirects } = buildHostingFiles(template);
  assert.ok(shell.includes('<div id="root"></div>'));
  assert.ok(shell.includes('content="noindex, follow"'));
  assert.ok(!shell.includes('rel="canonical"'));
  assert.ok(!shell.includes('application/ld+json'));
  assert.ok(notFound.includes('<h1>Page not found</h1>'));
  assert.ok(redirects.includes('/consult/* /app-shell.html 200'));
  assert.ok(!redirects.split('\n').some(line => line.startsWith('/* ')));
  const config = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.match(config, /from = "\/\*"\s+to = "\/404.html"\s+status = 404/);
});

test('only dates with actual almanac values become indexable', () => {
  const date = '2026-09-12';
  panchangByDate.set(date, { tithi: 'Test tithi' });
  assert.equal(panchangDatePage(date).noindex, true);
  panchangByDate.set(date, { tithi: 'Test tithi', nakshatra: 'Test nakshatra', rahu_kaal: '09:00–10:30', sunrise: '06:00', sunset: '18:00' });
  const page = panchangDatePage(date);
  assert.notEqual(page.noindex, true);
  assert.ok(page.facts.some(fact => fact.value === 'Test tithi'));
  panchangByDate.delete(date);
});
test('all explicit React routes have a public page or a private shell', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const paths = [...app.matchAll(/path="([^":*?]+)"/g)].map(match => match[1]);
  for (const route of paths) assert.ok(pages.some(page => page.path === route) || routing.isPrivateRoute(route), route);
});
