import { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Navigation,
  ArrowLeft,
  Check,
  Upload,
  AlertCircle,
} from "lucide-react";
import LocationInput from "./LocationInput";

type Step = "upload" | "identity" | "temporal" | "spatial" | "present";

interface ParsedChartData {
  chartStyle?: "North Indian" | "South Indian";
  ascendant?: { sign: string; house: number };
  planets?: Array<{ name: string; sign: string; house: number }>;
  yogas?: string[];
  birthDetails?: {
    dob?: string;
    tob?: string;
    pob?: string;
  };
  confidence?: number;
}

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
  const [step, setStep] = useState<Step>("upload");
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Chart upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [parsedChart, setParsedChart] = useState<ParsedChartData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

          // Reverse geocoding using Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();

          const address = data.address;
          const city =
            address.city ||
            address.town ||
            address.village ||
            address.suburb ||
            address.city_district ||
            "";
          const country = address.country || "";

          let locString = "";
          if (city && country) {
            locString = `${city}, ${country}`;
          } else if (city || country) {
            locString = city || country;
          } else {
            locString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          }

          const newData = { ...formData, currentLocation: locString };
          setFormData(newData);
          saveStepData(newData);
        } catch (error) {
          console.error("Location error:", error);
          // Fallback to coords
          const { latitude, longitude } = position.coords;
          const locString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          const newData = { ...formData, currentLocation: locString };
          setFormData(newData);
          saveStepData(newData);
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

  const handleChartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setParseError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setParseError("Image too large. Maximum size is 10MB.");
      return;
    }

    setIsUploading(true);
    setParseError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        setUploadedImage(reader.result as string);
        setIsUploading(false);
        setIsParsing(true);

        try {
          const response = await fetch("/.netlify/functions/parse-kundali", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType: file.type,
            }),
          });

          const result = await response.json();

          if (result.success && result.data) {
            setParsedChart(result.data);
            setParseError(null);
          } else {
            setParseError(
              result.error ||
              "Could not parse chart. Please try a clearer image."
            );
          }
        } catch (err) {
          console.error("Parse error:", err);
          setParseError("Failed to analyze chart. Please try again.");
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload error:", err);
      setParseError("Failed to upload image. Please try again.");
      setIsUploading(false);
    }
  };

  const clearUpload = () => {
    setUploadedImage(null);
    setParsedChart(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const useParsedData = () => {
    if (!parsedChart) return;

    const newData = { ...formData };
    if (parsedChart.birthDetails?.dob)
      newData.dob = parsedChart.birthDetails.dob;
    if (parsedChart.birthDetails?.tob)
      newData.tob = parsedChart.birthDetails.tob;
    if (parsedChart.birthDetails?.pob)
      newData.pob = parsedChart.birthDetails.pob;

    setFormData(newData);
    saveStepData(newData);
    setStep("identity");
  };

  const finalizeJourney = async () => {
    setIsSaving(true);
    try {
      if (user) {
        // Logged-in user: Save to Firestore
        await setDoc(
          doc(db, "users", user.uid),
          {
            profile: {
              ...formData,
              parsedChart: parsedChart, // Save reference to parsed chart if any
            },
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
    if (step === "upload") {
      setStep("identity");
    } else if (step === "identity") {
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
    if (step === "identity") setStep("upload");
    else if (step === "temporal") setStep("identity");
    else if (step === "spatial") setStep("temporal");
    else if (step === "present") setStep("spatial");
    else onClose();
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={onClose}
          ></motion.div>

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              type: "spring",
              duration: 0.5,
              bounce: 0.2
            }}
            className="w-full max-w-xl bg-[#0a0a0f] border border-white/10 rounded-[2rem] relative z-10 flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">
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
                    {step === "upload" && "Upload Kundali"}
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
              {["upload", "identity", "temporal", "spatial", "present"].map(
                (s, i) => {
                  const steps = [
                    "upload",
                    "identity",
                    "temporal",
                    "spatial",
                    "present",
                  ];
                  const currentIndex = steps.indexOf(step);
                  return (
                    <div
                      key={s}
                      className={`h-0.5 flex-1 rounded-full transition-all duration-700 ${i <= currentIndex ? "bg-gold" : "bg-white/5"
                        }`}
                    ></div>
                  );
                }
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 sm:p-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Step 0: Upload */}
                  {step === "upload" && (
                    <div>
                      <p className="text-sm text-white/50 mb-8">
                        Upload an image of your Kundali to auto-fill your profile.
                      </p>

                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleChartUpload}
                        className="hidden"
                        id="modal-chart-upload"
                      />

                      {!uploadedImage ? (
                        <label
                          htmlFor="modal-chart-upload"
                          className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${isUploading
                            ? "border-gold/50 bg-gold/5"
                            : "border-white/10 hover:border-gold/30 hover:bg-white/5"
                            }`}
                        >
                          {isUploading ? (
                            <div className="flex flex-col items-center">
                              <Loader2 className="w-8 h-8 text-gold animate-spin mb-4" />
                              <p className="text-xs text-white/40">Uploading...</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mb-4">
                                <Upload className="w-6 h-6 text-gold" />
                              </div>
                              <p className="text-sm text-white/80 font-medium mb-1">
                                Click to upload chart
                              </p>
                              <p className="text-[10px] text-white/30">
                                JPG, PNG or WebP
                              </p>
                            </div>
                          )}
                        </label>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/20">
                            <img
                              src={uploadedImage}
                              alt="Uploaded"
                              className="w-full h-32 object-contain"
                            />
                            <button
                              onClick={clearUpload}
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white/60 hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {isParsing && (
                            <div className="flex items-center justify-center gap-3 py-4 rounded-xl bg-white/5 border border-white/5">
                              <Loader2 className="w-4 h-4 text-gold animate-spin" />
                              <span className="text-xs text-white/40">
                                Analyzing celestial patterns...
                              </span>
                            </div>
                          )}

                          {parseError && !isParsing && (
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                              <p className="text-xs text-red-300/80">{parseError}</p>
                            </div>
                          )}

                          {parsedChart && !isParsing && (
                            <div className="space-y-3">
                              {parsedChart.birthDetails && (
                                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 grid grid-cols-2 gap-3">
                                  <div className="col-span-2 flex items-center gap-2 mb-1">
                                    <Check className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest">
                                      Match Found
                                    </span>
                                  </div>
                                  {parsedChart.birthDetails.dob && (
                                    <div>
                                      <p className="text-[10px] text-white/30 uppercase">
                                        Date
                                      </p>
                                      <p className="text-sm">
                                        {parsedChart.birthDetails.dob}
                                      </p>
                                    </div>
                                  )}
                                  {parsedChart.birthDetails.tob && (
                                    <div>
                                      <p className="text-[10px] text-white/30 uppercase">
                                        Time
                                      </p>
                                      <p className="text-sm">
                                        {parsedChart.birthDetails.tob}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              <button
                                onClick={useParsedData}
                                className="w-full py-3 rounded-xl bg-gold text-[#030308] text-xs font-bold uppercase tracking-widest"
                              >
                                Apply & Continue
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => setStep("identity")}
                        className="w-full mt-6 text-xs text-white/20 hover:text-white/40 transition-colors uppercase tracking-widest"
                      >
                        Skip — I'll Enter Details Manually
                      </button>
                    </div>
                  )}
                  {/* Step 1: Identity */}
                  {step === "identity" && (
                    <div>
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
                                className={`py-3 rounded-xl border text-xs font-sans transition-all font-bold tracking-widest uppercase ${formData.gender === g
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
                    <div>
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
                            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 focus:border-gold/50 transition-all outline-none text-white font-sans appearance-none ${formData.birthTimeUnknown
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
                    <div>
                      <p className="text-sm text-white/50 mb-8">
                        Precision is key. Where were you when the stars were aligned
                        this way?
                      </p>
                      <div className="space-y-4">
                        <label className="block text-xs uppercase tracking-[0.2em] font-bold text-white/30">
                          Birth Location
                        </label>
                        <LocationInput
                          value={formData.pob}
                          onChange={(val) => saveStepData({ ...formData, pob: val })}
                          placeholder="Search birth city..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 4: Present */}
                  {step === "present" && (
                    <div>
                      <p className="text-sm text-white/50 mb-8">
                        Finally, where are you seeking guidance from today?
                      </p>
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <label className="block text-xs uppercase tracking-[0.2em] font-bold text-white/30">
                            Current Location
                          </label>
                          <LocationInput
                            value={formData.currentLocation}
                            onChange={(val) =>
                              saveStepData({ ...formData, currentLocation: val })
                            }
                            placeholder="Search current city..."
                          />
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-px bg-white/5"></div>
                          <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold">
                            or
                          </span>
                          <div className="flex-1 h-px bg-white/5"></div>
                        </div>

                        <button
                          onClick={getCurrentLocation}
                          disabled={isLocating}
                          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border border-white/10 hover:border-gold/30 hover:bg-gold/5 transition-all group"
                        >
                          {isLocating ? (
                            <Loader2 className="w-5 h-5 text-gold animate-spin" />
                          ) : (
                            <Navigation className="w-5 h-5 text-gold group-hover:scale-110 transition-transform" />
                          )}
                          <span className="text-xs font-bold uppercase tracking-widest text-white/60 group-hover:text-gold transition-colors">
                            {isLocating ? "Locating..." : "Use My Current Location"}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-8 sm:p-10 border-t border-white/5 bg-black/20">
              <button
                onClick={nextStep}
                disabled={
                  isSaving ||
                  (step === "identity" && (!formData.name || !formData.gender)) ||
                  (step === "temporal" && (!formData.dob || !formData.tob)) ||
                  (step === "spatial" && !formData.pob) ||
                  (step === "present" && !formData.currentLocation)
                }
                className="btn btn-primary w-full py-4 rounded-xl font-bold tracking-widest uppercase flex items-center justify-center gap-2 group disabled:opacity-30 disabled:grayscale transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSaving ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    {step === "present" ? "Begin My Journey" : "Continue"}
                    <span className="group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </>
                )}
              </button>
              {step === "upload" && (
                <p className="text-center mt-4 text-[10px] text-white/20 uppercase tracking-[0.2em]">
                  Secure • Encrypted • Private
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
