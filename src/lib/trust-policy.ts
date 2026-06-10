import {
  CheckCircle2,
  FileText,
  MessageSquareQuote,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";

export interface TrustSignal {
  title: string;
  body: string;
  icon: LucideIcon;
}

export interface TrustProcessRow {
  signal: string;
  source: string;
  publicRule: string;
}

export const TRUST_PRINCIPLES = [
  "AI astrologers are labelled as AI.",
  "Reviews must come from submitted consultation sessions.",
  "Testimonials are opt-in and never invented.",
  "Prediction feedback is shown only in aggregate.",
  "Human expert claims require identity and profile review.",
];

export const TRUST_SIGNALS: TrustSignal[] = [
  {
    title: "Real reviews",
    body: "Consultation ratings are submitted through a server-owned endpoint and can be public only after moderation.",
    icon: Star,
  },
  {
    title: "Real testimonials",
    body: "Users can submit a story with permission for public use. Nothing appears publicly until reviewed.",
    icon: MessageSquareQuote,
  },
  {
    title: "Prediction feedback",
    body: "Forecast feedback is captured as accurate, partly accurate, or missed, then shown only as aggregate reporting.",
    icon: CheckCircle2,
  },
  {
    title: "Transparency reports",
    body: "The platform states what is AI-led, what is moderated, what is measured, and what is not claimed yet.",
    icon: FileText,
  },
];

export const TRUST_PROCESS_ROWS: TrustProcessRow[] = [
  {
    signal: "Review",
    source: "Post-consultation rating prompt",
    publicRule: "Shown only if user allows public use and admin approves it.",
  },
  {
    signal: "Testimonial",
    source: "User-submitted story",
    publicRule: "Shown only after opt-in, moderation, and approval.",
  },
  {
    signal: "Prediction feedback",
    source: "User marks a forecast accurate, partly accurate, or missed",
    publicRule: "Never shown as private feedback; only aggregate metrics are public.",
  },
  {
    signal: "Expert profile",
    source: "Expert application and operations review",
    publicRule: "No verified, degree, experience, or availability claims until backed by records.",
  },
];

export const TRUST_NOT_CLAIMED_YET = [
  "No fake review counts.",
  "No fake consultation counts.",
  "No fake verified badges.",
  "No fake human availability.",
  "No fake degrees or experience claims.",
  "No guaranteed prediction accuracy claims.",
];

export const TRUST_PAGE_HERO = {
  icon: ShieldCheck,
  eyebrow: "Trust layer",
  title: "Real signals, clearly marked.",
  body: "AstroYou is AI-led today and built to support real experts over time. Trust claims must come from user action, moderation, and transparent measurement.",
};
