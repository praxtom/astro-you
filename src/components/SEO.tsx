import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PUBLIC_PAGE_META } from "../lib/seo-public";
import { searchTitle, searchDescription, isPrivateRoute } from "../lib/seo-routing";
import { getSiteOrigin, siteUrl } from "../lib/site-url";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  canonical?: string;
  type?: "website" | "article";
  noindex?: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const defaultMeta = {
  title: "AstroYou — AI Vedic astrology guide",
  description:
    "Discover your birth chart with Vedic astrology for the modern world. Get personalized Kundali readings, daily guidance, and clarity from the celestial movements.",
  // PNG, not the SVG source: most social and preview scrapers do not render
  // SVG, so an SVG og:image silently produces no preview card at all.
  image: siteUrl("/og-image.png"),
  url: getSiteOrigin(),
  type: "website" as const,
};

export function SEO({
  title,
  description,
  image,
  url,
  canonical,
  type = "website",
  structuredData,
  noindex = false,
}: SEOProps) {
  const { pathname } = useLocation();
  const publicMeta = PUBLIC_PAGE_META.find(page => page.path === pathname);
  const excludeFromSearch = noindex || isPrivateRoute(pathname);
  const meta = {
    title: searchTitle(publicMeta?.title || title || defaultMeta.title),
    description: searchDescription(publicMeta?.description || description || defaultMeta.description),
    image: image || defaultMeta.image,
    url: url || siteUrl(pathname),
    type,
  };

  useEffect(() => {
    // Update document title
    document.title = meta.title;

    // Helper to update or create meta tags
    const updateMeta = (name: string, content: string, property = false) => {
      const attr = property ? "property" : "name";
      let element = document.querySelector(`meta[${attr}="${name}"]`);

      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }

      element.setAttribute("content", content);
    };

    // Standard meta tags
    updateMeta("title", meta.title);
    updateMeta("description", meta.description);
    updateMeta("robots", excludeFromSearch ? "noindex, follow" : "index, follow");

    // Open Graph tags
    updateMeta("og:title", meta.title, true);
    updateMeta("og:description", meta.description, true);
    updateMeta("og:image", meta.image, true);
    updateMeta("og:url", meta.url, true);
    updateMeta("og:type", meta.type, true);
    updateMeta("og:site_name", "AstroYou", true);

    // Twitter Card tags
    updateMeta("twitter:card", "summary_large_image");
    updateMeta("twitter:title", meta.title);
    updateMeta("twitter:description", meta.description);
    updateMeta("twitter:image", meta.image);
    updateMeta("twitter:url", meta.url);

    // Additional SEO tags
    updateMeta("theme-color", "#030308");
    updateMeta("author", "AstroYou");

    let canonicalLink = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical || meta.url;

    const scriptId = "astroyou-structured-data";
    const previousSchema = document.getElementById(scriptId);
    if (structuredData || excludeFromSearch || (previousSchema && previousSchema.dataset.pageUrl !== meta.url)) {
      previousSchema?.remove();
    }
    if (structuredData && !excludeFromSearch) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      script.dataset.pageUrl = meta.url;
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [
    canonical,
    excludeFromSearch,
    meta.title,
    meta.description,
    meta.image,
    meta.url,
    meta.type,
    structuredData,
  ]);

  return null;
}

// Pre-configured SEO for specific pages
export function LandingSEO() {
  return (
    <SEO
      title="Free Kundali, Panchang & Jyotish Guidance"
      description="Create your free Vedic Kundali, check compatibility and daily Panchang, and get Jyotish guidance that remembers your chart and questions."
    />
  );
}

export function OnboardingSEO() {
  return (
    <SEO
      title="Map Your Destiny"
      description="Enter your cosmic coordinates to generate your personalized Kundali birth chart. Let the stars reveal your path."
    />
  );
}

export function SynthesisSEO() {
  return (
    <SEO
      title="Jyotish"
      description="Consult Jyotish. Get personalized astrological insights, predictions, and guidance based on your unique birth chart."
    />
  );
}

export default SEO;
