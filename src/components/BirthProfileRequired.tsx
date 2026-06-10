import { Link } from "react-router-dom";
import { ArrowRight, UserRound } from "lucide-react";

interface BirthProfileRequiredProps {
  title: string;
  description: string;
}

export default function BirthProfileRequired({
  title,
  description,
}: BirthProfileRequiredProps) {
  return (
    <section className="mt-8 max-w-2xl rounded-xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-gold/20 bg-gold/10 text-gold">
        <UserRound size={18} />
      </div>
      <h2 className="font-display text-2xl text-white">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">{description}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          to="/onboarding"
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-black transition hover:bg-gold/90"
        >
          Create Profile <ArrowRight size={15} />
        </Link>
        <Link
          to="/free-kundali"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/75 transition hover:border-white/20 hover:text-white"
        >
          Try Free Kundali
        </Link>
      </div>
    </section>
  );
}
