import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { X, Loader2, Navigation, ArrowLeft, Check } from "lucide-react";

type Step = "identity" | "temporal" | "spatial" | "present";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
}: OnboardingModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("identity");
  const [isSaving, setIsSaving] = useState(false);
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

  // Load existing data from localStorage
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem("astroyou_profile");
      if (saved) {
        setFormData(JSON.parse(saved));
      }
    }
  }, [isOpen]);

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
          const locString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          const newData = { ...formData, currentLocation: locString };
          setFormData(newData);
          saveStepData(newData);
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
    setIsSaving(true);
    try {
      if (user) {
        // Logged-in user: Save to Firestore
        await setDoc(
          doc(db, "users", user.uid),
          {
            profile: { ...formData },
            updatedAt: new Date(),
          },
          { merge: true }
        );
        localStorage.setItem("astroyou_profile", JSON.stringify(formData));
        localStorage.setItem("astroyou_profile_complete", "true");
      } else {
        // Guest path
        sessionStorage.setItem(
          "astroyou_guest_profile",
          JSON.stringify(formData)
        );
        sessionStorage.setItem("astroyou_guest_complete", "true");
        // Also keep in localStorage for continuity if they sign up later
        localStorage.setItem("astroyou_profile", JSON.stringify(formData));
      }

      if (onComplete) onComplete();
      onClose();
    } catch (err) {
      console.error("Error saving data:", err);
      alert("Something went wrong. Your progress is saved locally.");
      onClose();
    } finally {
      setIsSaving(false);
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
    else onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-500"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="w-full max-w-xl bg-[#0a0a0f] border border-white/10 rounded-[2rem] relative z-10 flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {step !== "identity" && (
              <button
                onClick={prevStep}
                className="p-2 -ml-2 text-white/40 hover:text-white transition-colors"
                title="Back"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h3 className="text-xl font-display text-white">
                {step === "identity" && "Personal Basis"}
                {step === "temporal" && "Birth Time"}
                {step === "spatial" && "Birth Location"}
                {step === "present" && "Current Location"}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/20 hover:text-white/60 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex px-8 py-2 gap-1.5">
          {["identity", "temporal", "spatial", "present"].map((s, i) => {
            const steps = ["identity", "temporal", "spatial", "present"];
            const currentIndex = steps.indexOf(step);
            return (
              <div
                key={s}
                className={`h-0.5 flex-1 rounded-full transition-all duration-700 ${
                  i <= currentIndex ? "bg-gold" : "bg-white/5"
                }`}
              ></div>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-10">
          {/* Step 1: Identity */}
          {step === "identity" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-sm text-white/50 mb-8">
                Let's start with your basic profile details for accurate
                analysis.
              </p>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] font-bold text-white/30 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 focus:border-gold/50 transition-all outline-none text-white font-sans"
                    value={formData.name}
                    onChange={(e) =>
                      saveStepData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] font-bold text-white/30 mb-2">
                    Gender
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {["Male", "Female", "Other"].map((g) => (
                      <button
                        key={g}
                        onClick={() => saveStepData({ ...formData, gender: g })}
                        className={`py-3 rounded-xl border text-xs font-sans transition-all font-bold tracking-widest uppercase ${
                          formData.gender === g
                            ? "bg-gold border-gold text-[#030308] shadow-[0_0_15px_rgba(229,185,106,0.2)]"
                            : "bg-white/5 border-white/10 text-white/40 hover:border-white/30 hover:bg-white/10"
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-sm text-white/50 mb-8">
                Precision is key. When exactly did your journey begin?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] font-bold text-white/30 mb-2">
                    Birth Date
                  </label>
                  <input
                    type="date"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 focus:border-gold/50 transition-all outline-none text-white font-sans appearance-none"
                    value={formData.dob}
                    onChange={(e) =>
                      saveStepData({ ...formData, dob: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] font-bold text-white/30 mb-2">
                    Birth Time
                  </label>
                  <input
                    type="time"
                    className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 focus:border-gold/50 transition-all outline-none text-white font-sans appearance-none ${
                      formData.birthTimeUnknown
                        ? "opacity-30 pointer-events-none"
                        : ""
                    }`}
                    value={formData.birthTimeUnknown ? "12:00" : formData.tob}
                    onChange={(e) =>
                      saveStepData({ ...formData, tob: e.target.value })
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 mt-6 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.birthTimeUnknown}
                  onChange={(e) =>
                    saveStepData({
                      ...formData,
                      birthTimeUnknown: e.target.checked,
                      tob: e.target.checked ? "12:00" : formData.tob,
                    })
                  }
                  className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-gold checked:border-gold appearance-none cursor-pointer transition-all"
                />
                <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">
                  I don't know my exact birth time
                </span>
              </label>
              {formData.birthTimeUnknown && (
                <div className="mt-4 p-3 rounded-lg bg-gold/5 border border-gold/10">
                  <p className="text-xs text-gold/60 leading-relaxed">
                    Note: Using 12:00 noon as a reference. Some chart aspects
                    may be less precise.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Spatial */}
          {step === "spatial" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-sm text-white/50 mb-8">
                Your place of birth helps us calculate accurate planetary
                positions.
              </p>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] font-bold text-white/30 mb-2">
                    City/Town of Birth
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai, Maharashtra"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 focus:border-gold/50 transition-all outline-none text-white font-sans"
                    value={formData.pob}
                    onChange={(e) =>
                      saveStepData({ ...formData, pob: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Present */}
          {step === "present" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-sm text-white/50 mb-8">
                Where are you currently? This helps us analyze how present
                transits affect your location.
              </p>
              <div className="relative">
                <label className="block text-caption mb-2 opacity-50 uppercase tracking-widest text-xs font-bold">
                  Current Location
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Enter city or use GPS"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 focus:border-gold/50 transition-all outline-none text-white font-sans pr-12"
                    value={formData.currentLocation}
                    onChange={(e) =>
                      saveStepData({
                        ...formData,
                        currentLocation: e.target.value,
                      })
                    }
                  />
                  <button
                    onClick={getCurrentLocation}
                    disabled={isLocating}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gold/40 hover:text-gold transition-colors"
                  >
                    {isLocating ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Navigation size={18} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl border border-white/5 text-xs uppercase tracking-widest font-bold text-white/30 hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={nextStep}
            disabled={
              isSaving ||
              (step === "identity" && (!formData.name || !formData.gender)) ||
              (step === "temporal" && (!formData.dob || !formData.tob)) ||
              (step === "spatial" && !formData.pob) ||
              (step === "present" && !formData.currentLocation)
            }
            className="flex-[2] py-4 rounded-xl bg-gold text-[#030308] text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 disabled:grayscale disabled:scale-100 shadow-[0_4px_25px_rgba(229,185,106,0.25)] hover:shadow-[0_4px_30px_rgba(229,185,106,0.4)]"
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : step === "present" ? (
              <>
                <Check size={18} />
                Calculate Chart
              </>
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
