import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import AuthModal from "../components/AuthModal";
import {
  Loader2,
  Navigation,
  Upload,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { OnboardingSEO } from "../components/SEO";
import LocationInput from "../components/LocationInput";

type Step = "upload" | "identity" | "temporal" | "spatial" | "present";
import type { ParsedChartData } from "../types";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [isSaving, setIsSaving] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
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

          setFormData((prev) => ({ ...prev, currentLocation: locString }));
          saveStepData({ ...formData, currentLocation: locString });
        } catch (error) {
          console.error("Location error:", error);
          // Fallback to coords if reverse geocoding fails
          const { latitude, longitude } = position.coords;
          const locString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setFormData((prev) => ({ ...prev, currentLocation: locString }));
          saveStepData({ ...formData, currentLocation: locString });
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
                parsedChart: parsedChart, // Save reference to parsed chart if any
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

  // Handle chart image upload and parsing
  const handleChartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setParseError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setParseError("Image too large. Maximum size is 10MB.");
      return;
    }

    setIsUploading(true);
    setParseError(null);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        setUploadedImage(reader.result as string);
        setIsUploading(false);
        setIsParsing(true);

        try {
          // Call the parse-kundali API
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
            setParsedChart(null);
          }
        } catch (err) {
          console.error("Parse error:", err);
          setParseError("Failed to analyze chart. Please try again.");
          setParsedChart(null);
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

  // Clear the uploaded chart and reset
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
    setStep("identity"); // Move to next step after applying
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
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                    i <= currentIndex
                      ? "bg-gold shadow-[0_0_10px_rgba(255,215,0,0.4)]"
                      : "bg-white/10"
                  }`}
                ></div>
              );
            }
          )}
        </div>

        {/* Step 0: Kundali Upload (Optional) */}
        {step === "upload" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-4 opacity-60 uppercase tracking-[0.3em] font-sans text-xs">
              Optional
            </span>
            <h2 className="text-title text-4xl mb-4 font-display tracking-tight">
              Upload Kundali
            </h2>
            <p className="text-body mb-8 opacity-70 font-sans font-light">
              Have an existing birth chart? Upload it and we'll extract your
              planetary positions automatically.
            </p>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleChartUpload}
              className="hidden"
              id="chart-upload"
            />

            {!uploadedImage ? (
              /* Upload Zone */
              <label
                htmlFor="chart-upload"
                className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  isUploading
                    ? "border-gold/50 bg-gold/5"
                    : "border-white/20 hover:border-gold/40 hover:bg-white/5"
                }`}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-gold animate-spin mb-4" />
                    <p className="text-sm text-white/60">Uploading...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-4">
                      <Upload className="w-8 h-8 text-gold" />
                    </div>
                    <p className="text-lg text-white/80 font-medium mb-2">
                      Drop your Kundali chart here
                    </p>
                    <p className="text-sm text-white/40">
                      JPG, PNG, or WebP • Max 10MB
                    </p>
                  </div>
                )}
              </label>
            ) : (
              /* Uploaded Image Preview & Results */
              <div className="space-y-6">
                {/* Image Preview */}
                <div className="relative rounded-2xl overflow-hidden border border-white/10">
                  <img
                    src={uploadedImage}
                    alt="Uploaded Kundali"
                    className="w-full h-48 object-contain bg-black/20"
                  />
                  <button
                    onClick={clearUpload}
                    className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-red-500/80 text-white/80 hover:text-white transition-all"
                    title="Remove image"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Parsing State */}
                {isParsing && (
                  <div className="flex items-center justify-center gap-3 py-6 rounded-xl bg-white/5 border border-white/10">
                    <Loader2 className="w-5 h-5 text-gold animate-spin" />
                    <span className="text-sm text-white/60">
                      Analyzing celestial patterns...
                    </span>
                  </div>
                )}

                {/* Parse Error */}
                {parseError && !isParsing && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-300">{parseError}</p>
                      <button
                        onClick={clearUpload}
                        className="text-xs text-red-400 hover:text-red-300 underline mt-2"
                      >
                        Try a different image
                      </button>
                    </div>
                  </div>
                )}

                {/* Parsed Results */}
                {parsedChart && !isParsing && (
                  <div className="space-y-4">
                    {/* Confidence Score */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <div className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm text-emerald-300">
                          Chart analyzed successfully
                        </span>
                      </div>
                      {parsedChart.confidence && (
                        <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full">
                          {parsedChart.confidence}% confidence
                        </span>
                      )}
                    </div>

                    {/* Chart Style */}
                    {parsedChart.chartStyle && (
                      <div className="text-sm text-white/60">
                        Detected:{" "}
                        <span className="text-white/80">
                          {parsedChart.chartStyle} style
                        </span>
                      </div>
                    )}

                    {/* Birth Details Detected */}
                    {parsedChart.birthDetails && (
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                        <div className="text-xs uppercase tracking-widest text-white/40">
                          Extracted Details
                        </div>
                        <div className="grid grid-cols-2 gap-4">
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
                          {parsedChart.birthDetails.pob && (
                            <div className="col-span-2">
                              <p className="text-[10px] text-white/30 uppercase">
                                Place
                              </p>
                              <p className="text-sm">
                                {parsedChart.birthDetails.pob}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Planets Table */}
                    {parsedChart.planets && parsedChart.planets.length > 0 && (
                      <div className="rounded-xl border border-white/10 overflow-hidden">
                        <div className="bg-white/5 px-4 py-2 text-xs uppercase tracking-widest text-white/40">
                          Extracted Planets
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {parsedChart.planets.map((planet, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between px-4 py-2 border-t border-white/5 text-sm"
                            >
                              <span className="text-white/80">
                                {planet.name}
                              </span>
                              <span className="text-white/50">
                                {planet.sign} • House {planet.house}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={useParsedData}
                      className="w-full btn btn-primary py-3 text-sm font-bold uppercase tracking-widest mt-4"
                    >
                      Confirm & Auto-fill Profile
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Skip Option */}
            <div className="mt-8 text-center">
              <button
                onClick={() => setStep("identity")}
                className="text-sm text-white/40 hover:text-white/60 transition-colors underline"
              >
                I don't have a chart — enter details manually
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Identity */}
        {step === "identity" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-4 opacity-60 uppercase tracking-[0.3em] font-sans text-xs">
              Step 02 / 05
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
              <LocationInput
                label="Birth Place"
                placeholder="City, Province, Country"
                value={formData.pob}
                onChange={(val) => {
                  const newData = { ...formData, pob: val };
                  setFormData(newData);
                  saveStepData(newData);
                }}
              />
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
              <LocationInput
                label="Current Location"
                placeholder="Enter city or coordinates"
                value={formData.currentLocation}
                onChange={(val) => {
                  const newData = { ...formData, currentLocation: val };
                  setFormData(newData);
                  saveStepData(newData);
                }}
                icon={
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      getCurrentLocation();
                    }}
                    disabled={isLocating}
                    className="p-2 text-gold/60 hover:text-gold transition-colors"
                    title="Get current location"
                  >
                    {isLocating ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Navigation size={20} />
                    )}
                  </button>
                }
              />
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
