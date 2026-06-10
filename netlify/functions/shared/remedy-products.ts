export type RemedyProductCategory =
  | "practice"
  | "gemstone"
  | "rudraksha"
  | "yantra"
  | "puja"
  | "kit";

export type RemedyFulfillment = "digital" | "review" | "partner";

export interface RemedyProduct {
  id: string;
  title: string;
  category: RemedyProductCategory;
  fulfillment: RemedyFulfillment;
  priceInRupees: number;
  description: string;
  bestFor: string[];
  requiresBirthProfile: boolean;
  caution: string;
}

export interface BuildRemedyRequestRecordInput {
  uid: string;
  productId: string;
  notes?: string;
  createdAt: unknown;
}

export const remedyProducts: RemedyProduct[] = [
  {
    id: "mantra-sadhana-plan",
    title: "Mantra Sadhana Plan",
    category: "practice",
    fulfillment: "digital",
    priceInRupees: 0,
    description: "A simple daily mantra and discipline plan based on your chart context.",
    bestFor: ["Daily steadiness", "Low-risk remedies", "Habit building"],
    requiresBirthProfile: true,
    caution: "This is guidance, not a promise of a specific outcome.",
  },
  {
    id: "gemstone-suitability-review",
    title: "Gemstone Suitability Review",
    category: "gemstone",
    fulfillment: "review",
    priceInRupees: 199,
    description: "A suitability check before considering any gemstone recommendation.",
    bestFor: ["Gemstone decisions", "Planet strength review", "Avoiding fear purchases"],
    requiresBirthProfile: true,
    caution: "Do not wear a gemstone before chart, dasha, and current condition are reviewed.",
  },
  {
    id: "rudraksha-guidance",
    title: "Rudraksha Guidance",
    category: "rudraksha",
    fulfillment: "review",
    priceInRupees: 299,
    description: "Guidance on whether a rudraksha practice is suitable for your current phase.",
    bestFor: ["Devotional practice", "Saturn discipline", "Spiritual routine"],
    requiresBirthProfile: true,
    caution: "Use as a spiritual support practice, not as a substitute for practical decisions.",
  },
  {
    id: "personal-yantra-guidance",
    title: "Personal Yantra Guidance",
    category: "yantra",
    fulfillment: "review",
    priceInRupees: 399,
    description: "A chart-led review of which yantra practice, if any, fits your intention.",
    bestFor: ["Home altar", "Focused intention", "Devotional rhythm"],
    requiresBirthProfile: true,
    caution: "Yantras should support intention and discipline, not create fear or dependency.",
  },
  {
    id: "puja-planning-request",
    title: "Puja Planning Request",
    category: "puja",
    fulfillment: "partner",
    priceInRupees: 499,
    description: "Request guidance for a suitable puja type and timing before booking.",
    bestFor: ["Family events", "Major transitions", "Auspicious timing"],
    requiresBirthProfile: true,
    caution: "Final puja booking depends on partner availability and user confirmation.",
  },
  {
    id: "navagraha-remedy-kit",
    title: "Navagraha Remedy Kit",
    category: "kit",
    fulfillment: "partner",
    priceInRupees: 799,
    description: "A personalized request for a practical remedy kit based on chart priorities.",
    bestFor: ["Planetary balance", "Monthly practice", "Structured remedy routine"],
    requiresBirthProfile: true,
    caution: "Kit contents should be confirmed after review; this request does not auto-ship products.",
  },
];

export function getRemedyProduct(productId: string): RemedyProduct {
  const product = remedyProducts.find((item) => item.id === productId);
  if (!product) {
    throw new Error(`Unsupported remedy product: ${productId}`);
  }
  return product;
}

export function buildRemedyRequestRecord(input: BuildRemedyRequestRecordInput) {
  const product = getRemedyProduct(input.productId);
  const notes = typeof input.notes === "string" ? input.notes.trim().slice(0, 800) : "";

  return {
    uid: input.uid,
    productId: product.id,
    product: {
      id: product.id,
      title: product.title,
      category: product.category,
      fulfillment: product.fulfillment,
      priceInRupees: product.priceInRupees,
    },
    notes,
    status: "requested" as const,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}
