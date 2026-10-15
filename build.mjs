// Сборка статического сайта: src/template.html × src/i18n/*.json → dist/
// Запуск: node build.mjs   (без зависимостей)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src';
const OUT = 'dist';

const site = JSON.parse(readFileSync(join(SRC, 'site.json'), 'utf8'));
const template = readFileSync(join(SRC, 'template.html'), 'utf8');
const langs = readdirSync(join(SRC, 'i18n'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(SRC, 'i18n', f), 'utf8')))
  .sort((a) => (a.lang === site.defaultLang ? -1 : 1));

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const urlOf = (t) => site.baseUrl + t.path;
const today = new Date().toISOString().slice(0, 10);

function head(t) {
  const alternates = langs
    .map((l) => `<link rel="alternate" hreflang="${l.lang}" href="${urlOf(l)}">`)
    .concat(`<link rel="alternate" hreflang="x-default" href="${site.baseUrl}">`)
    .join('\n');
  const ogImage = `${site.baseUrl}og-${t.lang}.png`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: t.appName,
      url: urlOf(t),
      description: t.description,
      inLanguage: t.lang,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript and HTML5 Canvas',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: t.lang === 'ru' ? 'RUB' : 'USD' },
      image: ogImage,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: t.lang,
      mainEntity: t.faq.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ];
  return [
    `<title>${esc(t.title)}</title>`,
    `<meta name="description" content="${esc(t.description)}">`,
    `<meta name="keywords" content="${esc(t.keywords)}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<link rel="canonical" href="${urlOf(t)}">`,
    alternates,
    `<meta name="theme-color" content="#1a3d9e">`,
    `<link rel="icon" href="${t.path ? '../' : './'}favicon.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="${t.path ? '../' : './'}apple-touch-icon.png">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(t.appName)}">`,
    `<meta property="og:title" content="${esc(t.title)}">`,
    `<meta property="og:description" content="${esc(t.description)}">`,
    `<meta property="og:url" content="${urlOf(t)}">`,
    `<meta property="og:locale" content="${t.locale}">`,
    ...langs.filter((l) => l !== t).map((l) => `<meta property="og:locale:alternate" content="${l.locale}">`),
    `<meta property="og:image" content="${ogImage}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(t.ogImageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    site.yandexVerification && `<meta name="yandex-verification" content="${esc(site.yandexVerification)}">`,
    site.googleVerification && `<meta name="google-site-verification" content="${esc(site.googleVerification)}">`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
  ].filter(Boolean).join('\n');
}

function content(t) {
  const steps = t.howSteps.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('\n');
  const uses = t.useItems.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('\n');
  const faq = t.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n');
  return `<div class="content">
  <section><h2>${esc(t.howTitle)}</h2><ol class="steps">
${steps}
</ol></section>
  <section><h2>${esc(t.useTitle)}</h2><ul class="uses">
${uses}
</ul></section>
  <section class="faq"><h2>${esc(t.faqTitle)}</h2>
${faq}
</section>
</div>`;
}

const analytics = site.goatcounter
  ? `<script data-goatcounter="https://${site.goatcounter}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`
  : '';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(SRC, 'static'), OUT, { recursive: true });

for (const t of langs) {
  const other = langs.find((l) => l !== t);
  const vars = {
    ...Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, esc(v)])),
    head: head(t),
    content: content(t),
    badges: t.badges.map((b) => `<li>${esc(b)}</li>`).join(''),
    jsStrings: JSON.stringify(t.js),
    analytics,
    assetBase: t.path ? '../' : './',
    repoUrl: site.repoUrl,
    otherUrl: urlOf(other),
    otherLang: other.lang,
    otherLangHint: esc(other.langHint),
    otherLangHintGo: esc(other.langHintGo),
    otherLangHintClose: esc(other.langHintClose),
  };
  const html = template.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in vars)) throw new Error(`Нет значения для ${m} (${t.lang})`);
    return vars[k];
  });
  mkdirSync(join(OUT, t.path), { recursive: true });
  writeFileSync(join(OUT, t.path, 'index.html'), html);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${langs.map((t) => `  <url>
    <loc>${urlOf(t)}</loc>
    <lastmod>${today}</lastmod>
${langs.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.lang}" href="${urlOf(l)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${site.baseUrl}"/>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(OUT, 'sitemap.xml'), sitemap);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.baseUrl}sitemap.xml\n`);

console.log(`Готово: ${langs.map((t) => '/' + t.path).join(', ')} → ${OUT}/`);
