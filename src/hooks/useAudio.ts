import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Prana ambient sound.
 *
 * Every tone here is synthesised in the browser with the Web Audio API. There
 * are no audio files to fetch, so nothing can 404, get hotlink-blocked by a
 * CDN, or need a CSP `media-src` allowance.
 *
 * The Om mantra option was removed. It is a recording, not something that can
 * be synthesised honestly, and no licensed asset exists in this repo — so it is
 * gone rather than shipped as a choice that only ever produces silence.
 */
export type SoundType = 'brown_noise' | '432hz' | 'silence';

interface UseAudioOptions {
    loop?: boolean;
    volume?: number;
}

interface UseAudioReturn {
    play: () => void;
    pause: () => void;
    stop: () => void;
    toggle: () => void;
    setVolume: (volume: number) => void;
    setSound: (sound: SoundType) => void;
    isPlaying: boolean;
    currentSound: SoundType;
    volume: number;
    isLoaded: boolean;
}

/** Length of the generated brown-noise loop. Long enough that the loop is not audible. */
const NOISE_BUFFER_SECONDS = 6;

/** Fade applied on every start/stop so the audio never clicks. */
const FADE_SECONDS = 0.4;

const VALID_SOUNDS: readonly SoundType[] = ['brown_noise', '432hz', 'silence'];

/**
 * Coerce an untrusted value — a persisted preference, a sound id from a
 * previous release — into a sound that still exists, so a stale preference
 * cannot leave someone stuck with no audio.
 */
export function normalizeSoundType(sound: unknown, fallback: SoundType = 'brown_noise'): SoundType {
    return VALID_SOUNDS.includes(sound as SoundType) ? (sound as SoundType) : fallback;
}

type AudioContextConstructor = new () => AudioContext;

function getAudioContextCtor(): AudioContextConstructor | null {
    if (typeof window === 'undefined') return null;
    const scope = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
    return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

function isAudioSupported(): boolean {
    return getAudioContextCtor() !== null;
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

/**
 * Brown (red) noise: white noise run through a leaky integrator, so each
 * sample leans on the one before it. That downward 6 dB/octave tilt is what
 * gives it the deep, grounding rumble instead of a hissy top end.
 */
function createBrownNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * NOISE_BUFFER_SECONDS);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let last = 0;
    for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
    }

    // The integrator wanders, so the last sample rarely matches the first.
    // Subtracting that drift makes the loop seam continuous instead of a click
    // every NOISE_BUFFER_SECONDS. (It only removes inaudible sub-0.2 Hz motion.)
    const first = data[0];
    const drift = data[length - 1] - first;
    for (let i = 0; i < length; i++) {
        data[i] -= first + (drift * i) / (length - 1);
    }

    // Keep the peak under unity — the integrator occasionally overshoots.
    let peak = 0;
    for (let i = 0; i < length; i++) {
        const magnitude = Math.abs(data[i]);
        if (magnitude > peak) peak = magnitude;
    }
    if (peak > 0.9) {
        const scale = 0.9 / peak;
        for (let i = 0; i < length; i++) data[i] *= scale;
    }

    return buffer;
}

/**
 * Builds and starts the node graph for one sound, returning a dispose function
 * that fades it out and releases every node it created.
 */
function startSound(
    ctx: AudioContext,
    sound: Exclude<SoundType, 'silence'>,
    destination: AudioNode,
    loop: boolean,
    onEnded: () => void,
): () => void {
    const nodes: AudioNode[] = [];
    const sources: AudioScheduledSourceNode[] = [];

    // Shared envelope so both sounds fade in and out identically.
    const envelope = ctx.createGain();
    nodes.push(envelope);
    envelope.connect(destination);

    if (sound === 'brown_noise') {
        const source = ctx.createBufferSource();
        source.buffer = createBrownNoiseBuffer(ctx);
        source.loop = loop;
        source.connect(envelope);
        sources.push(source);
    } else {
        // A bare 432 Hz oscillator is a hard, dentist-drill tone. A quiet
        // sub-octave gives it body, a gentle lowpass takes the edge off, and a
        // very slow LFO on the level makes it breathe rather than drone.
        const tone = ctx.createOscillator();
        tone.type = 'sine';
        tone.frequency.value = 432;

        const subTone = ctx.createOscillator();
        subTone.type = 'sine';
        subTone.frequency.value = 216;

        const toneGain = ctx.createGain();
        toneGain.gain.value = 0.35;

        const subGain = ctx.createGain();
        subGain.gain.value = 0.12;

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 1200;
        lowpass.Q.value = 0.7;

        // Breath: 0.1 Hz (one swell per 10s) moving the level between ~0.73 and ~0.97.
        const breath = ctx.createGain();
        breath.gain.value = 0.85;

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1;

        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = 0.12;

        lfo.connect(lfoDepth);
        lfoDepth.connect(breath.gain);

        tone.connect(toneGain);
        subTone.connect(subGain);
        toneGain.connect(lowpass);
        subGain.connect(lowpass);
        lowpass.connect(breath);
        breath.connect(envelope);

        nodes.push(toneGain, subGain, lowpass, breath, lfoDepth);
        sources.push(tone, subTone, lfo);
    }

    // Read the clock after buffer generation so the fade is not eaten by it.
    const now = ctx.currentTime;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(1, now + FADE_SECONDS);
    sources.forEach((source) => source.start(now));

    // A non-looping buffer runs out on its own; let the caller know.
    if (!loop && sound === 'brown_noise') {
        sources[0].onended = onEnded;
    }

    let disposed = false;
    return () => {
        if (disposed) return;
        disposed = true;
        if (ctx.state === 'closed') return;

        const from = ctx.currentTime;
        const stopAt = from + FADE_SECONDS;

        // Read the level BEFORE cancelling: cancelScheduledValues() drops the
        // in-flight ramp but keeps the setValueAtTime(0) that started it, so
        // reading afterwards would report 0 and the fade-out would be a click.
        // (cancelAndHoldAtTime would do this for us, but Firefox lacks it.)
        const level = envelope.gain.value;
        envelope.gain.cancelScheduledValues(from);
        envelope.gain.setValueAtTime(level, from);
        envelope.gain.linearRampToValueAtTime(0, stopAt);

        sources.forEach((source) => {
            source.onended = null;
            try {
                source.stop(stopAt);
            } catch {
                // Already stopped — nothing left to schedule.
            }
        });

        // Release the graph once the fade tail has actually finished.
        sources[0].onended = () => {
            sources.forEach((source) => source.disconnect());
            nodes.forEach((node) => node.disconnect());
        };
    };
}

export function useAudio(initialSound: SoundType = 'silence', options: UseAudioOptions = {}): UseAudioReturn {
    const {
        loop = true,
        volume: initialVolume = 0.5
    } = options;

    const [currentSound, setCurrentSound] = useState<SoundType>(() => normalizeSoundType(initialSound, 'silence'));
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolumeState] = useState(() => clamp01(initialVolume));

    // Synthesis needs no network fetch: the graph is ready the moment the
    // browser gives us an AudioContext constructor.
    const [isLoaded] = useState(isAudioSupported);

    const ctxRef = useRef<AudioContext | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);

    const volumeRef = useRef(volume);
    useEffect(() => { volumeRef.current = volume; }, [volume]);

    // Mirrors currentSound so play() called in the same event handler as
    // setSound() sees the new value instead of the stale render closure.
    const soundRef = useRef(currentSound);
    useEffect(() => { soundRef.current = currentSound; }, [currentSound]);

    /**
     * The AudioContext is created here and nowhere else — lazily, on the first
     * play() — because browsers refuse to start one before a user gesture.
     */
    const ensureContext = useCallback((): AudioContext | null => {
        if (ctxRef.current) return ctxRef.current;

        const AudioCtor = getAudioContextCtor();
        if (!AudioCtor) return null;

        const ctx = new AudioCtor();
        const master = ctx.createGain();
        master.gain.setValueAtTime(volumeRef.current, ctx.currentTime);
        master.connect(ctx.destination);

        ctxRef.current = ctx;
        masterGainRef.current = master;
        return ctx;
    }, []);

    const play = useCallback(() => {
        if (soundRef.current === 'silence') return;

        const ctx = ensureContext();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            void ctx.resume().catch(() => {
                // Browser still wants a gesture; the next play() will retry.
            });
        }

        setIsPlaying(true);
    }, [ensureContext]);

    const pause = useCallback(() => {
        setIsPlaying(false);
    }, []);

    // Synthesised sound has no playhead to preserve, so stop() is pause() —
    // the next play() builds a fresh graph either way.
    const stop = useCallback(() => {
        setIsPlaying(false);
    }, []);

    const toggle = useCallback(() => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }, [isPlaying, play, pause]);

    const setVolume = useCallback((newVolume: number) => {
        setVolumeState(clamp01(newVolume));
    }, []);

    const setSound = useCallback((sound: SoundType) => {
        const next = normalizeSoundType(sound);
        soundRef.current = next;
        setCurrentSound(next);
        // Nothing is audible in silence — keep isPlaying honest for the UI.
        if (next === 'silence') setIsPlaying(false);
    }, []);

    // Owns the sound graph: built while playing, torn down on pause, sound
    // change, or unmount.
    useEffect(() => {
        if (!isPlaying || currentSound === 'silence') return;

        const ctx = ctxRef.current;
        const master = masterGainRef.current;
        if (!ctx || !master) return;

        return startSound(ctx, currentSound, master, loop, () => setIsPlaying(false));
    }, [isPlaying, currentSound, loop]);

    // Live volume changes, smoothed so dragging the slider does not zipper.
    useEffect(() => {
        const ctx = ctxRef.current;
        const master = masterGainRef.current;
        if (!ctx || !master || ctx.state === 'closed') return;
        master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    }, [volume]);

    // Declared last so this cleanup runs after the graph teardown above.
    useEffect(() => () => {
        const ctx = ctxRef.current;
        ctxRef.current = null;
        masterGainRef.current = null;
        if (ctx && ctx.state !== 'closed') {
            void ctx.close().catch(() => {
                // Context was already closing.
            });
        }
    }, []);

    return {
        play,
        pause,
        stop,
        toggle,
        setVolume,
        setSound,
        isPlaying,
        currentSound,
        volume,
        isLoaded
    };
}

// Export sound metadata for UI
export const SOUND_OPTIONS: Array<{ id: SoundType; name: string; description: string }> = [
    { id: 'silence', name: 'Silence', description: 'Breath only, no sound' },
    { id: 'brown_noise', name: 'Brown Noise', description: 'Deep, grounding ambient sound' },
    { id: '432hz', name: '432 Hz Tone', description: 'Healing frequency for harmony' }
];
