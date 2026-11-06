# AstroYou SEO review — 10 September 2026

Implementation update: the issues below have now been addressed locally. Public tools and policy pages have prerender definitions; route dates/categories and canonicals are preserved; private screens use a separate noindex shell; unknown URLs use a 404 response. The Explore directory and cluster links connect public pages. Search snippets use shared formatting, and schema is replaced by route. Dates without complete Panchang values are excluded from the sitemap and marked noindex. Twelve focused route/template tests, targeted lint, and syntax checks passed. A production build, typecheck, deployment, and post-deploy crawl have not been run. The findings below describe the original live deployment.

Checked the live HTML of all 441 sitemap URLs, seven additional linked pages, and explicit app routes: 469 unique URLs including one deliberately missing URL. Reviewed React routing and SEO code for differences after JavaScript loads. This is a technical and metadata audit, not a full browser, accessibility, content-accuracy, or performance audit of every page. No build or typecheck was run.

## Fix first

1. **Important tools serve homepage HTML.** `/free-kundali`, `/free-kundali-matching`, `/panchang`, `/muhurat`, `/numerology`, `/trust`, and `/refund-policy` return HTTP 200 with the homepage title, description, H1, and canonical. These seven pages are linked but absent from the sitemap. Add route-specific prerendered content and sitemap entries. Also review `/eclipses`, `/tarot`, and `/disclaimer`, which have the same fallback behavior. React may replace some metadata, but the initial page still gives conflicting signals.
2. **180 dated Panchang pages lose their date and canonical after React loads.** `src/pages/PanchangSeo.tsx` initializes today rather than reading `:date`, and always sets `/panchang` as canonical. Read and validate the route date; keep the initial HTML and React content, metadata, and canonical consistent.
3. **Four Muhurat categories become the generic business tool.** `src/pages/MuhuratSeo.tsx` ignores `:category`, defaults to business, and canonicalizes all categories to `/muhurat`. Preserve category-specific content and canonical URLs. Map the `property` route to the tool's `home` purpose explicitly.
4. **12 horoscope sign landing pages change canonical to their daily page.** `SignHoroscope.tsx` defaults a missing period to daily and uses the resulting content path as canonical. Decide whether sign landing pages are genuine hubs or redirects; the sitemap, initial HTML, and React must agree.
5. **Missing URLs look like successful homepages.** The deliberate `/seo-audit-missing-page-20260910` probe returned HTTP 200 with homepage content. `NotFound.tsx` does not set noindex. Provide meaningful not-found handling, ideally HTTP 404, and prevent indexing of the error view while preserving valid app routes.

## Improve next

- **Search snippets:** 376 of 441 sitemap titles exceed 60 characters; 391 descriptions exceed 160. These are review thresholds, not Google limits or automatic ranking penalties. Shorten verbose templates and retain each page's topic and distinguishing detail. Review actual search preview width before changing borderline cases.
- **Internal discovery:** 280 of the 448 sitemap/linked pages have no incoming link in the crawled HTML (including the homepage, because schema breadcrumb URLs are not anchor links). JavaScript navigation was not included in this count. Render cluster navigation, home links, and date navigation into HTML. React's `getSeoClusterPages` navigation is absent from the prerenderer.
- **Private routes:** app routes such as dashboard and wallet receive indexable homepage fallback HTML. Robots exclusions prevent crawling but do not guarantee removal from search. Define explicit indexing behavior for private routes; this is separate from authentication and data security.
- **Structured data consistency:** prerendered JSON-LD has no ID; the React SEO component only replaces its own `astroyou-structured-data` script. This can leave both versions present after rendering. Use a shared replacement strategy and ensure the schema describes the visible page. Validate representative page types with Google's Rich Results Test.
- **Panchang content completeness:** the generator permits descriptive fallback pages when date-specific values are unavailable. Check data coverage before indexing dates at scale; a dated title alone is not useful almanac content.

## Working correctly in the crawl

All 441 sitemap pages returned HTTP 200, had one H1, a self-referencing canonical, and no duplicate named/property meta tags. JSON-LD is present in the delivered HTML. The sitemap and robots file are accessible. HTTP redirects to HTTPS. These checks do not prove Google has indexed the pages or that every schema property is eligible for rich results.

The homepage improvements made earlier are local and not deployed, so this live crawl still shows the old homepage copy.

## Evidence and limits

`seo-pages-2026-09-10.csv` contains every checked URL, title, length, canonical, H1, and HTML incoming-link count. Length warnings and missing HTML links require judgment rather than mechanical fixes. No backlink inventory, Search Console indexing data, Core Web Vitals field data, or full JavaScript rendering crawl was available. Protected user content was not inspected.

Google guidance: [JavaScript SEO and canonical consistency](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [noindex and robots limitations](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [snippet length](https://developers.google.com/search/docs/appearance/snippet).
