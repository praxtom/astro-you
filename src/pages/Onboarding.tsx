import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import AuthModal from "../components/AuthModal";
import { Loader2, Navigation } from "lucide-react";
import { OnboardingSEO } from "../components/SEO";

type Step = "identity" | "temporal" | "spatial" | "present";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("identity");
  const [isSaving, setIsSaving] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    gender: "",
    dob: "",
    tob: "",
    pob: "",
    currentLocation: "",
    birthTimeUnknown: false,
  });

  // Load existing data from localStorage (persists across sessions)
  useEffect(() => {
    const saved = localStorage.getItem("astroyou_profile");
    if (saved) {
      setFormData(JSON.parse(saved));
    }
  }, []);

  const saveStepData = (data: typeof formData) => {
    setFormData(data);
    localStorage.setItem("astroyou_profile", JSON.stringify(data));
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Simple reverse geocoding using a public API or just storing coords
          // For now, let's just store the coords as a string, but in a real app, we'd use a service
          const locString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setFormData((prev) => ({ ...prev, currentLocation: locString }));
          saveStepData({ ...formData, currentLocation: locString });
        } catch (error) {
          console.error("Location error:", error);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error(error);
        alert("Unable to retrieve your location");
        setIsLocating(false);
      }
    );
  };

  const finalizeJourney = async () => {
    const mode = sessionStorage.getItem("astroyou_mode");

    if (user || mode === "logged_in") {
      // Logged-in user: Save to Firestore for permanent storage
      setIsSaving(true);
      try {
        if (user) {
          await setDoc(
            doc(db, "users", user.uid),
            {
              profile: {
                ...formData,
              },
              credits: 5, // Initial bonus
              updatedAt: new Date(),
            },
            { merge: true }
          );
        }
        // Also store in localStorage as backup
        localStorage.setItem("astroyou_profile", JSON.stringify(formData));
        localStorage.setItem("astroyou_profile_complete", "true");
        navigate("/dashboard");
      } catch (err) {
        console.error("Error saving data:", err);
        alert("Connection interrupted. Your progress is saved locally.");
        navigate("/dashboard");
      } finally {
        setIsSaving(false);
      }
    } else {
      // Guest path: Only store in sessionStorage (clears on browser close)
      sessionStorage.setItem(
        "astroyou_guest_profile",
        JSON.stringify(formData)
      );
      sessionStorage.setItem("astroyou_guest_complete", "true");
      navigate("/dashboard");
    }
  };

  const nextStep = () => {
    if (step === "identity") {
      if (!formData.name || !formData.gender) return;
      setStep("temporal");
    } else if (step === "temporal") {
      if (!formData.dob || !formData.tob) return;
      setStep("spatial");
    } else if (step === "spatial") {
      if (!formData.pob) return;
      setStep("present");
    } else {
      finalizeJourney();
    }
  };

  const prevStep = () => {
    if (step === "temporal") setStep("identity");
    else if (step === "spatial") setStep("temporal");
    else if (step === "present") setStep("spatial");
    else navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#030308] flex items-center justify-center p-6 text-content-primary">
      <OnboardingSEO />

      {/* Background Ambiance */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vw] bg-violet/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[60vw] h-[60vw] bg-gold/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="w-full max-w-xl glass p-10 md:p-14 relative z-10 border border-white/10 rounded-3xl">
        {/* Progress Bar */}
        <div className="flex gap-2 mb-12">
          {["identity", "temporal", "spatial", "present"].map((s, i) => {
            const steps = ["identity", "temporal", "spatial", "present"];
            const currentIndex = steps.indexOf(step);
            return (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  i <= currentIndex
                    ? "bg-gold shadow-[0_0_10px_rgba(255,215,0,0.4)]"
                    : "bg-white/10"
                }`}
              ></div>
            );
          })}
        </div>

        {/* Step 1: Identity */}
        {step === "identity" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-4 opacity-60 uppercase tracking-[0.3em] font-sans text-xs">
              Step 01 / 04
            </span>
            <h2 className="text-title text-4xl mb-4 font-display tracking-tight">
              Personal Basis
            </h2>
            <p className="text-body mb-10 opacity-70 font-sans font-light">
              We'll start with your basic profile details.
            </p>

            <div className="space-y-8">
              <div>
                <label
                  htmlFor="name-input"
                  className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-xs font-bold"
                >
                  Full Name
                </label>
                <input
                  id="name-input"
                  type="text"
                  placeholder="Enter your name"
                  aria-required="true"
                  autoComplete="name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 outline-none focus:border-gold/50 transition-all text-xl font-sans font-light focus-ring"
                  value={formData.name}
                  onChange={(e) => {
                    const newData = { ...formData, name: e.target.value };
                    setFormData(newData);
                    saveStepData(newData);
                  }}
                />
              </div>
              <div>
                <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-xs font-bold">
                  Gender
                </label>
                <div
                  className="grid grid-cols-3 gap-4"
                  role="radiogroup"
                  aria-label="Gender selection"
                >
                  {["Male", "Female", "Other"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      role="radio"
                      aria-checked={formData.gender === g}
                      onClick={() => {
                        const newData = { ...formData, gender: g };
                        setFormData(newData);
                        saveStepData(newData);
                      }}
                      className={`py-3 rounded-xl border transition-all text-sm font-sans tracking-wide focus-ring ${
                        formData.gender === g
                          ? "bg-gold/10 border-gold/50 text-gold shadow-[0_0_15px_rgba(255,215,0,0.1)]"
                          : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Temporal */}
        {step === "temporal" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-4 opacity-60 uppercase tracking-[0.3em] font-sans text-xs">
              Step 02 / 04
            </span>
            <h2 className="text-title text-4xl mb-4 font-display tracking-tight">
              The Moment
            </h2>
            <p className="text-body mb-10 opacity-70 font-sans font-light">
              When did your spirit first draw breath? Precision determines the
              alignment of the stars.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-xs font-bold">
                  Birth Date
                </label>
                <input
                  type="date"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 outline-none focus:border-gold/50 transition-all text-xl font-sans font-light appearance-none invert-calendar-icon"
                  value={formData.dob}
                  onChange={(e) => {
                    const newData = { ...formData, dob: e.target.value };
                    setFormData(newData);
                    saveStepData(newData);
                  }}
                />
              </div>
              <div>
                <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-xs font-bold">
                  Birth Time
                </label>
                <input
                  type="time"
                  className={`w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 outline-none focus:border-gold/50 transition-all text-xl font-sans font-light appearance-none invert-calendar-icon ${
                    formData.birthTimeUnknown
                      ? "opacity-40 cursor-not-allowed"
                      : ""
                  }`}
                  value={formData.birthTimeUnknown ? "12:00" : formData.tob}
                  disabled={formData.birthTimeUnknown}
                  onChange={(e) => {
                    const newData = { ...formData, tob: e.target.value };
                    setFormData(newData);
                    saveStepData(newData);
                  }}
                />

                {/* Unknown birth time checkbox */}
                <label className="flex items-center gap-3 mt-4 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.birthTimeUnknown}
                    onChange={(e) => {
                      const newData = {
                        ...formData,
                        birthTimeUnknown: e.target.checked,
                        tob: e.target.checked ? "12:00" : formData.tob,
                      };
                      setFormData(newData);
                      saveStepData(newData);
                    }}
                    className="w-5 h-5 rounded border-2 border-white/20 bg-white/5 checked:bg-gold checked:border-gold appearance-none cursor-pointer transition-all"
                  />
                  <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors font-sans">
                    I don't know my exact birth time
                  </span>
                </label>

                {formData.birthTimeUnknown && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-400 font-sans">
                      ⚠️ Using 12:00 noon. Ascendant and house positions may be
                      less accurate.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Spatial */}
        {step === "spatial" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-4 opacity-60 uppercase tracking-[0.3em] font-sans text-xs">
              Step 03 / 04
            </span>
            <h2 className="text-title text-4xl mb-4 font-display tracking-tight">
              Birth Location
            </h2>
            <p className="text-body mb-10 opacity-70 font-sans font-light">
              Your location of birth is essential for accurate planetary
              mapping.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-xs font-bold">
                  Birth Place
                </label>
                <input
                  type="text"
                  placeholder="City, Province, Country"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 outline-none focus:border-gold/50 transition-all text-xl font-sans font-light"
                  value={formData.pob}
                  onChange={(e) => {
                    const newData = { ...formData, pob: e.target.value };
                    setFormData(newData);
                    saveStepData(newData);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Present */}
        {step === "present" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-4 opacity-60 uppercase tracking-[0.3em] font-sans text-xs">
              Step 04 / 04
            </span>
            <h2 className="text-title text-4xl mb-4 font-display tracking-tight">
              The Presence
            </h2>
            <p className="text-body mb-10 opacity-70 font-sans font-light">
              Where does your light shine in this current moment?
            </p>

            <div className="space-y-6">
              <div className="relative">
                <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-xs font-bold">
                  Current Location
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Enter city or coordinates"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 outline-none focus:border-gold/50 transition-all text-xl font-sans font-light pr-14"
                    value={formData.currentLocation}
                    onChange={(e) => {
                      const newData = {
                        ...formData,
                        currentLocation: e.target.value,
                      };
                      setFormData(newData);
                      saveStepData(newData);
                    }}
                  />
                  <button
                    onClick={getCurrentLocation}
                    disabled={isLocating}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gold/60 hover:text-gold transition-colors"
                    title="Get current location"
                  >
                    {isLocating ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Navigation size={20} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 mt-16">
          <button
            disabled={isSaving}
            onClick={prevStep}
            className="btn btn-outline py-4 flex-1 font-bold tracking-widest text-xs uppercase"
          >
            {step === "identity" ? "Cancel" : "Back"}
          </button>
          <button
            disabled={isSaving}
            onClick={nextStep}
            className={`btn btn-primary py-4 flex-[2] font-bold tracking-widest text-xs uppercase flex items-center justify-center gap-2 transition-all ${
              (step === "identity" && (!formData.name || !formData.gender)) ||
              (step === "temporal" && (!formData.dob || !formData.tob)) ||
              (step === "spatial" && !formData.pob) ||
              (step === "present" && !formData.currentLocation)
                ? "opacity-40 cursor-not-allowed grayscale"
                : ""
            }`}
          >
            {isSaving ? (
              <Loader2 className="animate-spin" size={20} />
            ) : step === "present" ? (
              "Calculate Destiny"
            ) : (
              "Next Step"
            )}
          </button>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Secure Your Destiny"
        message="Create your celestial profile to save your coordinates and receive deeply personalized astrological synthesis."
      />
    </div>
  );
}
