import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import Header from "../components/layout/Header";
import { trackAcquisitionEvent } from "../lib/acquisition";

const LANGUAGE_OPTIONS = ["Hindi", "English", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada", "Gujarati"];
const SPECIALTY_OPTIONS = ["Vedic", "Marriage", "Career", "Remedies", "Muhurat", "Vastu", "Numerology", "Tarot"];

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  languages: string[];
  specialties: string[];
  experienceYears: string;
  bio: string;
  sampleApproach: string;
}

const initialForm: FormState = {
  fullName: "",
  email: "",
  phone: "",
  city: "",
  languages: ["Hindi"],
  specialties: ["Vedic"],
  experienceYears: "",
  bio: "",
  sampleApproach: "",
};

export default function ExpertApply() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleListValue = (field: "languages" | "specialties", value: string) => {
    setForm((current) => {
      const exists = current[field].includes(value);
      return {
        ...current,
        [field]: exists
          ? current[field].filter((item) => item !== value)
          : [...current[field], value],
      };
    });
  };

  const submitApplication = async () => {
    if (
      form.fullName.trim().length < 2 ||
      !form.email.includes("@") ||
      form.languages.length === 0 ||
      form.specialties.length === 0 ||
      !form.experienceYears
    ) {
      setError("Full name, email, experience, language, and specialty are required.");
      setMessage(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/experts/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          experienceYears: Number(form.experienceYears),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit application");
      setMessage("Application received. Our review team can verify profile, credentials, and sample guidance before listing anyone.");
      trackAcquisitionEvent("expert_application_submitted", {
        languagesCount: form.languages.length,
        specialtiesCount: form.specialties.length,
        experienceYears: Number(form.experienceYears),
      });
      setForm(initialForm);
    } catch (err: any) {
      setError(err.message || "Could not submit application");
    } finally {
      setSubmitting(false);
    }
  };

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

        <section className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <p className="platform-eyebrow mb-2">Expert Network</p>
            <h1 className="type-page-title max-w-3xl">
              Apply to join AstroYou as a verified guide.
            </h1>
            <p className="platform-copy mt-3 max-w-2xl">
              This is the intake path for real astrologers, readers, and remedy
              specialists. Profiles should go live only after review.
            </p>
          </div>

          <aside className="platform-panel p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 text-gold" size={21} />
              <div>
                <p className="type-card-title text-white">Verification first</p>
                <p className="type-body-sm mt-1 text-white/45">
                  Intake, credential review, sample consultation, approval, and
                  quality checks before public listing.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="platform-panel p-4 md:p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Full name" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} />
              <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
              <Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
              <Field label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
              <Field
                label="Years of experience"
                value={form.experienceYears}
                type="number"
                onChange={(value) => setForm({ ...form, experienceYears: value })}
              />
            </div>

            <ChoiceGroup
              title="Languages"
              options={LANGUAGE_OPTIONS}
              selected={form.languages}
              onToggle={(value) => toggleListValue("languages", value)}
            />
            <ChoiceGroup
              title="Specialties"
              options={SPECIALTY_OPTIONS}
              selected={form.specialties}
              onToggle={(value) => toggleListValue("specialties", value)}
            />

            <label className="mt-4 block">
              <span className="type-meta uppercase text-white/40">Short bio</span>
              <textarea
                value={form.bio}
                onChange={(event) => setForm({ ...form, bio: event.target.value })}
                rows={3}
                className="platform-field mt-2 resize-none p-3 text-sm"
                placeholder="Your background, lineage, study, or practice style."
              />
            </label>

            <label className="mt-4 block">
              <span className="type-meta uppercase text-white/40">Sample approach</span>
              <textarea
                value={form.sampleApproach}
                onChange={(event) => setForm({ ...form, sampleApproach: event.target.value })}
                rows={4}
                className="platform-field mt-2 resize-none p-3 text-sm"
                placeholder="How would you guide someone asking about marriage, career, or remedies?"
              />
            </label>

            {error && (
              <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">
                {error}
              </p>
            )}
            {message && (
              <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                {message}
              </p>
            )}

            <button
              onClick={submitApplication}
              disabled={submitting}
              className="platform-button-primary mt-5 w-full disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Submit application
            </button>
          </div>

          <aside className="space-y-4">
            <section className="platform-panel p-4">
              <p className="platform-eyebrow mb-3">Review pipeline</p>
              <div className="space-y-3">
                {["Identity and contact check", "Credential and specialty review", "Sample guidance evaluation", "Pricing, payout, and listing setup"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-white/55">
                    <CheckCircle2 size={15} className="text-gold" />
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="platform-panel p-4">
              <div className="flex items-center gap-2 text-gold">
                <UserCheck size={16} />
                <p className="platform-eyebrow">Listing rule</p>
              </div>
              <p className="type-body-sm mt-3 text-white/45">
                Applying does not create a public profile. A guide should appear
                in the marketplace only after approval and operational setup.
              </p>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="type-meta uppercase text-white/40">{label}</span>
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        className="platform-field mt-2 h-10 px-3 text-sm"
      />
    </label>
  );
}

function ChoiceGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="type-meta mb-2 uppercase text-white/40">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`platform-chip ${
              selected.includes(option)
                ? "border-gold/40 bg-gold/15 text-gold"
                : "hover:border-white/20 hover:text-white/70"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
