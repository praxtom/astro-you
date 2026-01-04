import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import AuthModal from "../components/AuthModal";
import { Loader2, Navigation } from "lucide-react";

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
  });

  // Load existing data if guest already filled some in this session
  useEffect(() => {
    const saved = sessionStorage.getItem("astroyou_temp_profile");
    if (saved) {
      setFormData(JSON.parse(saved));
    }
  }, []);

  const saveStepData = (data: typeof formData) => {
    setFormData(data);
    sessionStorage.setItem("astroyou_temp_profile", JSON.stringify(data));
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
    // Save to session regardless so chat can use it
    sessionStorage.setItem("astroyou_profile_complete", "true");

    if (user) {
      setIsSaving(true);
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            ...formData,
            credits: 5, // Initial bonus
            updatedAt: new Date(),
          },
          { merge: true }
        );
        navigate("/synthesis");
      } catch (err) {
        console.error("Error saving data:", err);
        alert("Connection interrupted. Your progress is saved locally.");
        navigate("/synthesis");
      } finally {
        setIsSaving(false);
      }
    } else {
      // Guest path: just go to chat
      navigate("/synthesis");
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
            <span className="section-label mb-4 opacity-60 uppercase tracking-[0.3em] font-sans text-[0.6rem]">
              Step 01 / 04
            </span>
            <h2 className="text-title text-4xl mb-4 font-display tracking-tight">
              The Traveler
            </h2>
            <p className="text-body mb-10 opacity-70 font-sans font-light">
              Reveal the name and essence bestowed upon your soul.
            </p>

            <div className="space-y-8">
              <div>
                <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-[0.65rem] font-bold">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 outline-none focus:border-gold/50 transition-all text-xl font-sans font-light"
                  value={formData.name}
                  onChange={(e) => {
                    const newData = { ...formData, name: e.target.value };
                    setFormData(newData);
                    saveStepData(newData);
                  }}
                />
              </div>
              <div>
                <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-[0.65rem] font-bold">
                  Gender Essence
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {["Male", "Female", "Other"].map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        const newData = { ...formData, gender: g };
                        setFormData(newData);
                        saveStepData(newData);
                      }}
                      className={`py-3 rounded-xl border transition-all text-sm font-sans tracking-wide ${
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
            <span className="section-label mb-4 opacity-60 uppercase tracking-[0.3em] font-sans text-[0.6rem]">
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
                <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-[0.65rem] font-bold">
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
                <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-[0.65rem] font-bold">
                  Birth Time
                </label>
                <input
                  type="time"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 outline-none focus:border-gold/50 transition-all text-xl font-sans font-light appearance-none invert-calendar-icon"
                  value={formData.tob}
                  onChange={(e) => {
                    const newData = { ...formData, tob: e.target.value };
                    setFormData(newData);
                    saveStepData(newData);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Spatial */}
        {step === "spatial" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-4 opacity-60 uppercase tracking-[0.3em] font-sans text-[0.6rem]">
              Step 03 / 04
            </span>
            <h2 className="text-title text-4xl mb-4 font-display tracking-tight">
              The Origin
            </h2>
            <p className="text-body mb-10 opacity-70 font-sans font-light">
              The coordinates of your vessel's origin anchor your cosmic
              blueprint.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-[0.65rem] font-bold">
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
            <span className="section-label mb-4 opacity-60 uppercase tracking-[0.3em] font-sans text-[0.6rem]">
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
                <label className="block text-caption mb-3 opacity-40 uppercase tracking-widest text-[0.65rem] font-bold">
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
            className="btn btn-outline py-4 flex-1 font-bold tracking-widest text-[0.7rem] uppercase"
          >
            {step === "identity" ? "Cancel" : "Back"}
          </button>
          <button
            disabled={isSaving}
            onClick={nextStep}
            className={`btn btn-primary py-4 flex-[2] font-bold tracking-widest text-[0.7rem] uppercase flex items-center justify-center gap-2 transition-all ${
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
