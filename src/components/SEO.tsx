import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
}

const defaultMeta = {
  title: "AstroYou | Celestial Intelligence",
  description:
    "Discover your cosmic blueprint with AI-powered Vedic astrology. Get personalized Kundali readings, daily horoscopes, and celestial guidance from the Voice of the Stars.",
  image: "/og-image.png",
  url: "https://astroyou.app",
  type: "website" as const,
};

export function SEO({
  title,
  description,
  image,
  url,
  type = "website",
}: SEOProps) {
  const meta = {
    title: title ? `${title} | AstroYou` : defaultMeta.title,
    description: description || defaultMeta.description,
    image: image || defaultMeta.image,
    url: url || defaultMeta.url,
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
    updateMeta("description", meta.description);
    updateMeta("robots", "index, follow");

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

    // Additional SEO tags
    updateMeta("theme-color", "#030308");
    updateMeta("author", "AstroYou");
  }, [meta.title, meta.description, meta.image, meta.url, meta.type]);

  return null;
}

// Pre-configured SEO for specific pages
export function LandingSEO() {
  return (
    <SEO
      title="Celestial Intelligence"
      description="AstroYou combines ancient Vedic wisdom with modern AI to deliver profoundly accurate personal insights. Your cosmic blueprint, instantly calculated."
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
      title="Celestial Synthesis"
      description="Consult the Voice of the Stars. Get personalized astrological insights, predictions, and guidance based on your unique birth chart."
    />
  );
}

export default SEO;
