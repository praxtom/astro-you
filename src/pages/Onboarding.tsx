import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import {
  birthDataChanged,
  parseSuggestionCoordinates,
  type BirthCoordinates,
} from "../lib/birth-data";
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
import { postJson } from "../lib/apiFetch";
import LocationInput from "../components/LocationInput";
import { STORAGE_KEYS } from "../lib/constants";
import { resolveTimezone } from "../lib/local-date";
import {
  DEFAULT_ZODIAC_MODE,
  ZODIAC_MODES,
  normalizeZodiacMode,
  type ZodiacMode,
} from "../lib/zodiac-mode";
import { useErrorToast } from "../components/ui/toast-context";
import { trackAcquisitionEvent } from "../lib/acquisition";
import {
  deriveProfileSigns,
  resolveAscendant,
  resolveMoon,
} from "../lib/chart-summary";
import { ZODIAC_SIGNS } from "../lib/astrology";
import { SIGNUP_BONUS_CREDITS } from "../lib/signup-offer";
import { hasSavedBirthProfile } from "../lib/saved-profile";
import ChartDataNotice from "../components/ChartDataNotice";
import {
  CHART_UPLOAD_TOO_LARGE,
  MAX_CHART_UPLOAD_BYTES,
  birthDateProblem,
  todayInputValue,
} from "../lib/onboarding-rules";

type Step = "upload" | "identity" | "temporal" | "spatial" | "present";
/** Manual entry is the default path; "upload" is an optional detour from identity. */
const FLOW_STEPS: Step[] = ["identity", "temporal", "spatial", "present"];
import type { ParsedChartData } from "../types";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("identity");
  const [isSaving, setIsSaving] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const showError = useErrorToast();

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
    zodiacMode: DEFAULT_ZODIAC_MODE as ZodiacMode,
  });

  // Geocoded birth-place coordinates, captured when the user picks a
  // LocationInput suggestion. Optional: manual typing leaves this null.
  const [birthCoordinates, setBirthCoordinates] =
    useState<BirthCoordinates | null>(null);
  // Current-location coordinates (suggestion pick or the locate button). The
  // dashboard Panchang needs them; without them it falls back to the birth
  // place. Optional: manual typing leaves this null.
  const [currentCoordinates, setCurrentCoordinates] =
    useState<BirthCoordinates | null>(null);

  // Preview: background-fetch kundali data when entering "present" step
  const [preview, setPreview] = useState<any>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const previewLagna = resolveAscendant(preview);
  const previewMoon = resolveMoon(preview);
  const previewMoonSign = previewMoon
    ? ZODIAC_SIGNS.find((z) => z.code === previewMoon.code)?.western
    : null;
  const { name, gender, dob, tob, pob, birthTimeUnknown } = formData;

  useEffect(() => {
    if (step !== "present" || !dob || !tob || !pob) return;

    const controller = new AbortController();
    // Reset so going back and changing birth data never shows a stale preview.
    setPreview(null);
    setPreviewFailed(false);

    const birthData = {
      name,
      gender,
      dob,
      tob,
      pob,
      birthTimeUnknown,
      ...(birthCoordinates
        ? { lat: birthCoordinates.lat, lng: birthCoordinates.lng }
        : {}),
    };

    postJson(
      "/api/kundali",
      { birthData, chartType: "D1", zodiacMode: formData.zodiacMode },
      { signal: controller.signal },
    )
      .then((r) => {
        // An error body would otherwise read as a chart with no Lagna and
        // leave "Calculating..." on screen forever.
        if (!r.ok) throw new Error(`Preview responded ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!d || typeof d !== "object" || d.error) {
          throw new Error("Preview returned no chart");
        }
        setPreview(d);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.warn("[Onboarding] Preview unavailable:", err);
        setPreviewFailed(true);
      });

    return () => controller.abort();
  }, [
    step,
    name,
    gender,
    dob,
    tob,
    pob,
    birthTimeUnknown,
    birthCoordinates,
    formData.zodiacMode,
  ]);

  // Load existing data from localStorage (persists across sessions)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      // Whitelist known fields — the synced profile JSON can carry extra keys
      // (credits, subscription, ...) that must never round-trip into a save.
      setFormData({
        name: typeof parsed.name === "string" ? parsed.name : "",
        gender: typeof parsed.gender === "string" ? parsed.gender : "",
        dob: typeof parsed.dob === "string" ? parsed.dob : "",
        tob: typeof parsed.tob === "string" ? parsed.tob : "",
        pob: typeof parsed.pob === "string" ? parsed.pob : "",
        currentLocation:
          typeof parsed.currentLocation === "string"
            ? parsed.currentLocation
            : "",
        birthTimeUnknown: Boolean(parsed.birthTimeUnknown),
        zodiacMode: normalizeZodiacMode(parsed.zodiacMode),
      });
      setBirthCoordinates(
        parseSuggestionCoordinates(
          parsed.coordinates?.lat,
          parsed.coordinates?.lng,
        ),
      );
      setCurrentCoordinates(
        parseSuggestionCoordinates(
          parsed.currentCoordinates?.lat,
          parsed.currentCoordinates?.lng,
        ),
      );
    } catch {
      // Corrupt browser cache — start fresh.
    }
  }, []);

  const saveStepData = (
    data: typeof formData,
    coords: BirthCoordinates | null | undefined = undefined,
    currentCoords: BirthCoordinates | null | undefined = undefined,
  ) => {
    const nextCoords = coords === undefined ? birthCoordinates : coords;
    const nextCurrent =
      currentCoords === undefined ? currentCoordinates : currentCoords;
    setFormData(data);
    localStorage.setItem(
      STORAGE_KEYS.PROFILE,
      JSON.stringify({
        ...data,
        ...(nextCoords ? { coordinates: nextCoords } : {}),
        ...(nextCurrent ? { currentCoordinates: nextCurrent } : {}),
      }),
    );
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(
        "This browser can't share your location. Type your current city instead.",
      );
      return;
    }

    setLocationError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const here = parseSuggestionCoordinates(latitude, longitude);
          setCurrentCoordinates(here);

          // Reverse geocoding using Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
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
          saveStepData({ ...formData, currentLocation: locString }, undefined, here);
        } catch (error) {
          console.error("Location error:", error);
          // Fallback to coords if reverse geocoding fails
          const { latitude, longitude } = position.coords;
          const locString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          const here = parseSuggestionCoordinates(latitude, longitude);
          setCurrentCoordinates(here);
          setFormData((prev) => ({ ...prev, currentLocation: locString }));
          saveStepData({ ...formData, currentLocation: locString }, undefined, here);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error(error);
        showError(
          "Location Error",
          "Unable to retrieve your location. Please enter it manually.",
        );
        setIsLocating(false);
      },
    );
  };

  const finalizeJourney = async () => {
    const mode = sessionStorage.getItem(STORAGE_KEYS.MODE);
    // The browser's zone is the user's *current* zone, which is what "today"
    // means for horoscopes, panchang, streaks and the journal. The birth
    // chart's timezone is a separate concern, resolved upstream from the
    // birth coordinates. Recomputed on every save so a user who moves gets
    // their new zone rather than a stale one.
    const timezone = resolveTimezone(
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined,
    );
    // Current location is optional; default it to the birth place.
    const hasCurrentLocation = Boolean(formData.currentLocation.trim());
    const profileData = hasCurrentLocation
      ? formData
      : { ...formData, currentLocation: formData.pob };
    // Coordinates only travel with a typed/picked current location; an empty
    // one falls back to the birth place (and its coordinates) downstream.
    // Same text as the birth place (e.g. "skip") → the birth coordinates
    // apply downstream; never pair it with coordinates of an earlier pick.
    const savedCurrentCoordinates =
      hasCurrentLocation &&
      formData.currentLocation.trim() !== formData.pob.trim()
        ? currentCoordinates
        : null;
    const storedProfile = JSON.stringify({
      ...profileData,
      timezone,
      ...(birthCoordinates ? { coordinates: birthCoordinates } : {}),
      ...(savedCurrentCoordinates
        ? { currentCoordinates: savedCurrentCoordinates }
        : {}),
    });

    if (user || mode === "logged_in") {
      // Logged-in user: Save to Firestore (authoritative), then localStorage (backup)
      setIsSaving(true);
      try {
        if (user) {
          const userRef = doc(db, "users", user.uid);
          // Read the current profile so we can detect a birth-data change and
          // clean up stale coordinates/cached charts in the same write.
          const prevSnap = await getDoc(userRef);
          const prevProfile = (prevSnap.data()?.profile ?? null) as Record<
            string,
            any
          > | null;
          const prevCoords = parseSuggestionCoordinates(
            prevProfile?.coordinates?.lat,
            prevProfile?.coordinates?.lng,
          );

          const profilePayload: Record<string, any> = {
            ...profileData,
            timezone,
            parsedChart: parsedChart,
          };
          // Stale current coordinates would point Panchang at the old place.
          profilePayload.currentCoordinates =
            savedCurrentCoordinates ?? deleteField();
          if (birthCoordinates) {
            profilePayload.coordinates = birthCoordinates;
          } else if (
            prevCoords &&
            (prevProfile?.pob || "").trim() !== profileData.pob.trim()
          ) {
            // pob changed without picking a suggestion — the stored
            // coordinates belong to the old place and must not survive.
            profilePayload.coordinates = deleteField();
          }

          const updates: Record<string, any> = {
            profile: profilePayload,
            updatedAt: new Date(),
          };
          if (
            birthDataChanged(
              prevProfile
                ? {
                    dob: prevProfile.dob,
                    tob: prevProfile.tob,
                    pob: prevProfile.pob,
                    coordinates: prevCoords,
                  }
                : null,
              {
                dob: profileData.dob,
                tob: profileData.tob,
                pob: profileData.pob,
                coordinates: birthCoordinates,
              },
            )
          ) {
            // Birth data changed → every cached chart is for the wrong sky.
            // Clear them so useKundali and server-side AI context refetch.
            updates.kundaliData = deleteField();
            updates.kundaliData_D9 = deleteField();
            updates.kundaliData_D10 = deleteField();
            updates.kundaliData_western = deleteField();
            // The saved signs belong to the old chart too.
            profilePayload.moonSign = deleteField();
            profilePayload.sunSign = deleteField();
            profilePayload.moonNakshatra = deleteField();
          }
          // Sidereal Moon/Sun signs + Moon nakshatra from the preview D1 (cast
          // for exactly this birth data — it resets whenever an input changes).
          // A Western preview is tropical, so it never writes them; useKundali
          // backfills from the Vedic D1 later if they are still missing.
          const previewSigns =
            formData.zodiacMode === "vedic" ? deriveProfileSigns(preview) : null;
          if (previewSigns) {
            profilePayload.moonSign = previewSigns.moonSign;
            if (previewSigns.sunSign)
              profilePayload.sunSign = previewSigns.sunSign;
            if (previewSigns.moonNakshatra)
              profilePayload.moonNakshatra = previewSigns.moonNakshatra;
          }

          await setDoc(userRef, updates, { merge: true });
        }
        // Only mark complete AFTER Firestore write succeeds
        localStorage.setItem(STORAGE_KEYS.PROFILE, storedProfile);
        localStorage.setItem(STORAGE_KEYS.PROFILE_COMPLETE, "true");
        trackAcquisitionEvent("onboarding_complete");
        navigate("/dashboard");
      } catch (err) {
        console.error("Error saving data:", err);
        // Save locally so user doesn't lose their input, but DON'T navigate away
        localStorage.setItem(STORAGE_KEYS.PROFILE, storedProfile);
        showError(
          "Save Error",
          "Could not save to cloud. Please check your connection and try again.",
        );
        setIsSaving(false);
      } finally {
        setIsSaving(false);
      }
    } else {
      // Guest path: sessionStorage + localStorage backup for later sign-up migration
      sessionStorage.setItem(STORAGE_KEYS.GUEST_PROFILE, storedProfile);
      sessionStorage.setItem(STORAGE_KEYS.GUEST_COMPLETE, "true");
      localStorage.setItem(STORAGE_KEYS.PROFILE, storedProfile);
      trackAcquisitionEvent("onboarding_complete");
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

    // Must match the parse-kundali body cap (~6MB base64, about 4.5MB image).
    if (file.size > MAX_CHART_UPLOAD_BYTES) {
      setParseError(CHART_UPLOAD_TOO_LARGE);
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
          const response = await fetch("/api/parse-kundali", {
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
                "Could not parse chart. Please try a clearer image.",
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
      if (dobProblem) return;
      setStep("spatial");
    } else if (step === "spatial") {
      if (!formData.pob) return;
      // Require a geocoded selection — a free-typed place that doesn't resolve
      // would let onboarding finish, then fail every chart call with a generic
      // 500. birthCoordinates is only set when a dropdown suggestion is picked.
      if (!birthCoordinates) {
        showError(
          "Please pick your birth place from the suggestions so we can locate it accurately.",
        );
        return;
      }
      setStep("present");
    } else {
      finalizeJourney();
    }
  };

  const dobProblem = birthDateProblem(formData.dob);

  /** Returning users who already saved a chart go straight to it. */
  const handleSignedIn = async () => {
    setShowAuthModal(false);
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists() && hasSavedBirthProfile(snap.data())) {
        navigate("/dashboard");
      }
    } catch {
      // Stay here: the form saves to the signed-in account.
    }
  };

  const prevStep = () => {
    if (step === "upload") setStep("identity");
    else if (step === "identity") navigate("/");
    else if (step === "temporal") setStep("identity");
    else if (step === "spatial") setStep("temporal");
    else if (step === "present") setStep("spatial");
    else navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#030308] flex items-center justify-center p-3 text-content-primary">
      <OnboardingSEO />

      {/* Background Ambiance */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vw] bg-violet/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[60vw] h-[60vw] bg-gold/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="w-full max-w-xl glass p-4 md:p-5 relative z-10 border border-white/10 rounded-2xl">
        {/* Progress Bar */}
        <div className="flex gap-1.5 mb-4">
          {FLOW_STEPS.map(
            (s, i) => {
              // The optional upload detour sits before the first step.
              const currentIndex = FLOW_STEPS.indexOf(step);
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
            },
          )}
        </div>

        {/* Step 01: Kundali Upload (Optional) */}
        {step === "upload" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-3 opacity-60 uppercase tracking-[0.3em] font-sans text-xs">
              Optional
            </span>
            <h1 className="text-title text-3xl mb-3 font-display tracking-tight">
              Upload Kundali
            </h1>
            <p className="text-body mb-4 opacity-70 font-sans font-light">
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
                className={`relative flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
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
                    <p className="text-sm text-white/60">
                      JPG, PNG, or WebP • Max 4.5 MB
                    </p>
                  </div>
                )}
              </label>
            ) : (
              /* Uploaded Image Preview & Results */
              <div className="space-y-4">
                {/* Image Preview */}
                <div className="relative rounded-2xl overflow-hidden border border-white/10">
                  <img
                    src={uploadedImage}
                    alt="Uploaded Kundali"
                    className="w-full h-40 object-contain bg-black/20"
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
                        <div className="text-xs uppercase tracking-widest text-white/60">
                          Extracted Details
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {parsedChart.birthDetails.dob && (
                            <div>
                              <p className="text-[0.6875rem] text-white/55 uppercase">
                                Date
                              </p>
                              <p className="text-sm">
                                {parsedChart.birthDetails.dob}
                              </p>
                            </div>
                          )}
                          {parsedChart.birthDetails.tob && (
                            <div>
                              <p className="text-[0.6875rem] text-white/55 uppercase">
                                Time
                              </p>
                              <p className="text-sm">
                                {parsedChart.birthDetails.tob}
                              </p>
                            </div>
                          )}
                          {parsedChart.birthDetails.pob && (
                            <div className="col-span-2">
                              <p className="text-[0.6875rem] text-white/55 uppercase">
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
                        <div className="bg-white/5 px-4 py-2 text-xs uppercase tracking-widest text-white/60">
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
            <div className="mt-4 text-center">
              <button
                onClick={() => setStep("identity")}
                className="min-h-11 text-sm text-white/60 hover:text-white/80 transition-colors underline"
              >
                Enter my details manually instead
              </button>
            </div>
          </div>
        )}

        {/* Step 02: Identity */}
        {step === "identity" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-3 opacity-60 uppercase tracking-[0.3em] font-sans text-xs">
              Step 01 / 04
            </span>
            <h1 className="text-title text-3xl mb-3 font-display tracking-tight">
              Personal Basis
            </h1>
            <p className="text-body mb-4 opacity-70 font-sans font-light">
              We'll start with your basic profile details.
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name-input"
                  className="block text-caption mb-3 opacity-60 uppercase tracking-widest text-xs font-bold"
                >
                  Full Name
                </label>
                <input
                  id="name-input"
                  type="text"
                  placeholder="Enter your name"
                  aria-required="true"
                  autoComplete="name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-gold/50 transition-all text-base font-sans font-light focus-ring"
                  value={formData.name}
                  onChange={(e) => {
                    const newData = { ...formData, name: e.target.value };
                    setFormData(newData);
                    saveStepData(newData);
                  }}
                />
              </div>
              <div>
                <label className="block text-caption mb-3 opacity-60 uppercase tracking-widest text-xs font-bold">
                  Gender
                </label>
                <div
                  className="grid grid-cols-3 gap-3"
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
                          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col items-start gap-1 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setStep("upload")}
                className="inline-flex min-h-11 items-center gap-2 text-sm text-gold/80 hover:text-gold transition-colors"
              >
                <Upload size={15} />
                Have a Kundali image? Upload it to fill in details
              </button>
              {!user && (
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="min-h-11 text-sm text-white/60 hover:text-white transition-colors underline"
                >
                  Already saved your chart? Sign in
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 03: Temporal */}
        {step === "temporal" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-3 opacity-60 uppercase tracking-[0.3em] font-sans text-xs">
              Step 02 / 04
            </span>
            <h1 className="text-title text-3xl mb-3 font-display tracking-tight">
              The Moment
            </h1>
            <p className="text-body mb-4 opacity-70 font-sans font-light">
              When did your spirit first draw breath? Precision determines the
              alignment of the stars.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="onboarding-dob"
                  className="block text-caption mb-3 opacity-60 uppercase tracking-widest text-xs font-bold"
                >
                  Birth Date
                </label>
                <input
                  id="onboarding-dob"
                  type="date"
                  max={todayInputValue()}
                  aria-invalid={dobProblem ? true : undefined}
                  aria-describedby={dobProblem ? "onboarding-dob-error" : undefined}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-gold/50 transition-all text-base font-sans font-light appearance-none invert-calendar-icon"
                  value={formData.dob}
                  onChange={(e) => {
                    const newData = { ...formData, dob: e.target.value };
                    setFormData(newData);
                    saveStepData(newData);
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="onboarding-tob"
                  className="block text-caption mb-3 opacity-60 uppercase tracking-widest text-xs font-bold"
                >
                  Birth Time
                </label>
                <input
                  id="onboarding-tob"
                  type="time"
                  className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-gold/50 transition-all text-base font-sans font-light appearance-none invert-calendar-icon ${
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
                <label className="flex items-center gap-3 mt-3 cursor-pointer group">
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
            {dobProblem && (
              <p
                id="onboarding-dob-error"
                role="alert"
                className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
              >
                {dobProblem}
              </p>
            )}
          </div>
        )}

        {/* Step 04: Spatial */}
        {step === "spatial" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-3 opacity-60 uppercase tracking-[0.3em] font-sans text-xs">
              Step 03 / 04
            </span>
            <h1 className="text-title text-3xl mb-3 font-display tracking-tight">
              Birth Location
            </h1>
            <p className="text-body mb-4 opacity-70 font-sans font-light">
              Your location of birth is essential for accurate planetary
              mapping.
            </p>

            <div className="space-y-4">
              <LocationInput
                label="Birth Place"
                placeholder="City, Province, Country"
                value={formData.pob}
                onChange={(val) => {
                  // Typing invalidates any previously selected coordinates —
                  // they belong to a different place string.
                  setBirthCoordinates(null);
                  saveStepData({ ...formData, pob: val }, null);
                }}
                onSelect={(suggestion) => {
                  const coords = parseSuggestionCoordinates(
                    suggestion.lat,
                    suggestion.lon,
                  );
                  setBirthCoordinates(coords);
                  saveStepData(
                    { ...formData, pob: suggestion.display_name },
                    coords,
                  );
                }}
              />
              {/* The next step requests the chart preview. */}
              <ChartDataNotice />
            </div>
          </div>
        )}

        {/* Step 05: Present */}
        {step === "present" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="section-label mb-3 opacity-60 uppercase tracking-[0.3em] font-sans text-xs">
              Step 04 / 04
            </span>
            <h1 className="text-title text-3xl mb-3 font-display tracking-tight">
              The Presence
            </h1>
            <p className="text-body mb-4 opacity-70 font-sans font-light">
              Where does your light shine in this current moment?
            </p>

            {previewFailed && !preview && (
              <p
                role="status"
                className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/65"
              >
                Preview unavailable — you can still continue.
              </p>
            )}
            {preview && (
              <div className="mb-4 p-3 rounded-xl bg-gold/5 border border-gold/20">
                <p className="text-[0.6875rem] text-gold uppercase tracking-widest font-bold mb-2">
                  Quick Preview
                </p>
                <p className="text-sm text-white/70">
                  {/* The preview is the D1 chart: `ascendant` is the Lagna,
                      the Moon sign comes from the Moon's own position. */}
                  Lagna:{" "}
                  <span className="text-white font-medium">
                    {preview.timeUnknown || birthTimeUnknown
                      ? "needs an exact birth time"
                      : previewLagna
                        ? `${previewLagna.western} (${previewLagna.name})`
                        : "unavailable — you can still continue"}
                  </span>
                  {previewMoonSign && (
                    <>
                      {" · "}Moon:{" "}
                      <span className="text-white font-medium">
                        {previewMoonSign}
                      </span>
                    </>
                  )}
                  {preview.planetary_positions?.length > 0 &&
                    ` · ${preview.planetary_positions.length} planets analyzed`}
                  {!preview.planetary_positions?.length &&
                    preview.planets?.length > 0 &&
                    ` · ${preview.planets.length} planets analyzed`}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  Complete your profile for your full personalised reading
                </p>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label
                  htmlFor="onboarding-zodiac-mode"
                  className="block text-caption mb-3 opacity-60 uppercase tracking-widest text-xs font-bold"
                >
                  Which tradition should we read your chart in?
                </label>
                <select
                  id="onboarding-zodiac-mode"
                  value={normalizeZodiacMode(formData.zodiacMode)}
                  onChange={(event) => {
                    const newData = {
                      ...formData,
                      zodiacMode: normalizeZodiacMode(event.target.value),
                    };
                    setFormData(newData);
                    saveStepData(newData);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 outline-none focus:border-gold/50 transition-colors text-lg font-sans font-light"
                >
                  {ZODIAC_MODES.map((mode) => (
                    <option
                      key={mode.mode}
                      value={mode.mode}
                      className="bg-[#111118]"
                    >
                      {mode.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-white/60">
                  {
                    ZODIAC_MODES.find(
                      (mode) =>
                        mode.mode === normalizeZodiacMode(formData.zodiacMode),
                    )?.description
                  }{" "}
                  You can change this later in Settings.
                </p>
              </div>

              <LocationInput
                label="Current Location"
                placeholder="Enter city or coordinates"
                value={formData.currentLocation}
                onChange={(val) => {
                  // Typing invalidates coordinates from an earlier pick.
                  setCurrentCoordinates(null);
                  saveStepData(
                    { ...formData, currentLocation: val },
                    undefined,
                    null,
                  );
                }}
                onSelect={(suggestion) => {
                  const coords = parseSuggestionCoordinates(
                    suggestion.lat,
                    suggestion.lon,
                  );
                  setCurrentCoordinates(coords);
                  saveStepData(
                    { ...formData, currentLocation: suggestion.display_name },
                    undefined,
                    coords,
                  );
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
                    aria-label="Use my current location"
                  >
                    {isLocating ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Navigation size={20} />
                    )}
                  </button>
                }
              />
              {locationError && (
                <p role="alert" className="-mt-2 text-sm text-red-200">
                  {locationError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            disabled={isSaving}
            onClick={prevStep}
            className="btn btn-outline py-3 flex-1 font-bold tracking-widest text-xs uppercase"
          >
            {/* Identity is the first step, so it cancels; upload returns to it. */}
            {step === "identity" ? "Cancel" : "Back"}
          </button>
          <button
            disabled={isSaving}
            onClick={nextStep}
            className={`btn btn-primary py-3 flex-[2] font-bold tracking-widest text-xs uppercase flex items-center justify-center gap-2 transition-all ${
              (step === "identity" && (!formData.name || !formData.gender)) ||
              (step === "temporal" &&
                (!formData.dob || !formData.tob || Boolean(dobProblem))) ||
              (step === "spatial" && !formData.pob)
                ? "opacity-40 cursor-not-allowed grayscale"
                : ""
            }`}
          >
            {isSaving ? (
              <Loader2 className="animate-spin" size={20} />
            ) : step === "present" ? (
              "See my chart"
            ) : (
              "Next Step"
            )}
          </button>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => void handleSignedIn()}
        title="Save your chart"
        message={`Sign in to save your chart and get ${SIGNUP_BONUS_CREDITS} free credits.`}
      />
    </div>
  );
}
