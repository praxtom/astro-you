import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Gem,
  HandHeart,
  Loader2,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Header from "../components/layout/Header";
import { useToast } from "../components/ui/toast-context";
import { useAuth } from "../lib/useAuth";
import { trackAcquisitionEvent } from "../lib/acquisition";
import { useRemedies } from "../hooks/useRemedies";
import { useUserProfile } from "../hooks";
import {
  REMEDY_CATEGORIES,
  REMEDY_PRODUCTS,
  type RemedyProduct,
  type RemedyProductCategory,
} from "../lib/remedy-products";

const categoryIcon: Record<RemedyProductCategory, typeof Sparkles> = {
  practice: Sparkles,
  gemstone: Gem,
  rudraksha: HandHeart,
  yantra: ShieldCheck,
  puja: HandHeart,
  kit: PackageCheck,
};

interface RemedyRequestRecord {
  id: string;
  product?: {
    title?: string;
    category?: string;
    priceInRupees?: number;
  };
  status?: string;
  createdAt?: string | null;
}

function formatPrice(price: number) {
  return price === 0 ? "Free" : `₹${price}`;
}

function fulfillmentLabel(product: RemedyProduct) {
  if (product.fulfillment === "digital") return "Instant plan";
  if (product.fulfillment === "review") return "Review first";
  return "Request first";
}

export default function Remedies() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { birthData, loading: profileLoading } = useUserProfile();
  const { remedies, loading: remediesLoading } = useRemedies(birthData);
  const { addToast } = useToast();
  const [activeCategory, setActiveCategory] = useState<"all" | RemedyProductCategory>("all");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<RemedyProduct | null>(null);
  const [notes, setNotes] = useState("");
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RemedyRequestRecord[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const suggestedRemedies = Array.isArray(remedies?.remedies)
    ? remedies.remedies.slice(0, 4)
    : [];

  const loadRequests = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setRequestsError(null);
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/remedies/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load requests");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setRequestsError(null);
    } catch (error: any) {
      setRequests([]);
      setRequestsError(error.message || "Could not load requests");
    }
  }, [user]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return REMEDY_PRODUCTS.filter((product) => {
      const matchesCategory =
        activeCategory === "all" || product.category === activeCategory;
      const matchesSearch =
        !term ||
        product.title.toLowerCase().includes(term) ||
        product.description.toLowerCase().includes(term) ||
        product.bestFor.some((item) => item.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, query]);

  async function requestGuidance(product: RemedyProduct) {
    if (!user) {
      addToast({
        type: "warning",
        title: "Sign in required",
        message: "Create an account before requesting remedy guidance.",
      });
      navigate("/onboarding");
      return;
    }

    if (product.requiresBirthProfile && !birthData) {
      addToast({
        type: "warning",
        title: "Birth profile needed",
        message: "Complete your birth details so the review has chart context.",
      });
      navigate("/onboarding");
      return;
    }

    setRequestingId(product.id);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/remedies/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          productId: product.id,
          notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not create remedy request");
      }

      addToast({
        type: "success",
        title: "Request saved",
        message: `${product.title} has been added for guidance review.`,
      });
      trackAcquisitionEvent("remedy_request_submitted", {
        productId: product.id,
        category: product.category,
        fulfillment: product.fulfillment,
        priceInRupees: product.priceInRupees,
      });
      await loadRequests();
      setSelectedProduct(null);
      setNotes("");
    } catch (error: any) {
      addToast({
        type: "error",
        title: "Request unavailable",
        message: error.message || "Could not create remedy request.",
      });
    } finally {
      setRequestingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="platform-main">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-white/40 hover:text-white"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <section className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div>
            <p className="platform-eyebrow mb-2">Remedy Studio</p>
            <h1 className="type-page-title max-w-3xl">
              Practical remedies, reviewed before you buy.
            </h1>
            <p className="platform-copy mt-3 max-w-2xl">
              Start with low-risk practices. Request paid reviews only when a
              gemstone, puja, yantra, or kit needs chart context.
            </p>
          </div>

          <aside className="platform-panel p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 text-gold" size={21} />
              <div>
                <p className="type-card-title text-white">No fear selling</p>
                <p className="type-body-sm mt-1 text-white/45">
                  Remedies are framed as support practices. Paid items require
                  review before purchase or booking.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <section className="platform-panel p-4">
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="type-section-title">Remedy catalog</h2>
                  <p className="type-body-sm text-white/40">
                    Request guidance now; payment and fulfillment can be added
                    once partners are ready.
                  </p>
                </div>
                <div className="relative w-full md:w-72">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                    size={16}
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search remedies"
                    className="platform-field h-10 pl-9 pr-3 text-sm"
                  />
                </div>
              </div>

              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {REMEDY_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`platform-chip shrink-0 ${
                      activeCategory === category.id
                        ? "border-gold/40 bg-gold/15 text-gold"
                        : "hover:border-white/20 hover:text-white/70"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {filteredProducts.map((product) => (
                  <RemedyProductCard
                    key={product.id}
                    product={product}
                    onSelect={() => setSelectedProduct(product)}
                  />
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="platform-panel p-4">
              <p className="platform-eyebrow mb-3">From your chart</p>
              {profileLoading || remediesLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-white/40">
                  <Loader2 size={16} className="animate-spin" />
                  Reading remedy context
                </div>
              ) : suggestedRemedies.length > 0 ? (
                <div className="space-y-3">
                  {suggestedRemedies.map((remedy) => (
                    <div key={`${remedy.category}-${remedy.name}`} className="border-b border-white/10 pb-3 last:border-0 last:pb-0">
                      <p className="type-body-sm font-semibold text-white/80">
                        {remedy.name}
                      </p>
                      <p className="type-meta mt-1 text-gold">{remedy.category}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <AlertCircle className="mb-3 text-white/25" size={26} />
                  <p className="type-body-sm text-white/55">
                    Complete your birth profile to generate personalized remedy
                    suggestions.
                  </p>
                </div>
              )}
            </section>

            <section className="platform-panel p-4">
              <p className="platform-eyebrow mb-3">Recent requests</p>
              {requestsError ? (
                <p className="type-body-sm text-white/40">
                  Request history is unavailable right now.
                </p>
              ) : requests.length === 0 ? (
                <p className="type-body-sm text-white/40">
                  Guidance requests will appear here.
                </p>
              ) : (
                <div className="space-y-3">
                  {requests.slice(0, 4).map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="type-body-sm truncate font-semibold text-white/80">
                          {request.product?.title || "Remedy request"}
                        </p>
                        <p className="type-meta mt-1 text-white/35 capitalize">
                          {request.status || "requested"}
                        </p>
                      </div>
                      <p className="type-meta shrink-0 text-gold">
                        {formatPrice(request.product?.priceInRupees ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="platform-panel p-4">
              <p className="platform-eyebrow mb-3">Safety rules</p>
              <div className="space-y-3 type-body-sm text-white/48">
                <p>Gemstones are reviewed before recommendation.</p>
                <p>Mantra, service, routine, and discipline come first.</p>
                <p>Health, legal, and financial decisions stay with qualified professionals.</p>
              </div>
            </section>
          </aside>
        </section>

        {selectedProduct && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 px-4">
            <div className="platform-panel-strong w-full max-w-lg p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="platform-eyebrow mb-2">
                    {fulfillmentLabel(selectedProduct)}
                  </p>
                  <h2 className="type-section-title">{selectedProduct.title}</h2>
                  <p className="platform-copy mt-2">{selectedProduct.description}</p>
                </div>
                <p className="type-price text-gold">
                  {formatPrice(selectedProduct.priceInRupees)}
                </p>
              </div>

              <div className="mb-4 grid gap-2">
                {selectedProduct.bestFor.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-white/60">
                    <CheckCircle2 size={15} className="text-gold" />
                    {item}
                  </div>
                ))}
              </div>

              <label className="type-meta uppercase text-white/40" htmlFor="remedy-notes">
                Notes for the review
              </label>
              <textarea
                id="remedy-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className="platform-field mt-2 resize-none p-3 text-sm"
                placeholder="Mention your concern, timing, or current situation."
              />

              <p className="mt-3 rounded-xl border border-amber-400/15 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100/75">
                {selectedProduct.caution}
              </p>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="platform-button-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => requestGuidance(selectedProduct)}
                  disabled={requestingId === selectedProduct.id}
                  className="platform-button-primary disabled:opacity-60"
                >
                  {requestingId === selectedProduct.id && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Request guidance
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function RemedyProductCard({
  product,
  onSelect,
}: {
  product: RemedyProduct;
  onSelect: () => void;
}) {
  const Icon = categoryIcon[product.category];

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
            <Icon size={19} />
          </div>
          <div>
            <p className="type-card-title text-white">{product.title}</p>
            <p className="type-meta mt-1 text-white/35">
              {fulfillmentLabel(product)}
            </p>
          </div>
        </div>
        <p className="type-price shrink-0 text-gold">
          {formatPrice(product.priceInRupees)}
        </p>
      </div>

      <p className="type-body-sm mt-3 text-white/50">{product.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {product.bestFor.slice(0, 3).map((item) => (
          <span key={item} className="platform-chip">
            {item}
          </span>
        ))}
      </div>

      <button onClick={onSelect} className="platform-button-secondary mt-4 w-full">
        Request guidance
      </button>
    </article>
  );
}
