import { useState, useRef, useEffect, useCallback } from 'react';

export type SoundType = 'brown_noise' | '432hz' | 'om_mantra' | 'silence';

interface UseAudioOptions {
    loop?: boolean;
    volume?: number;
    autoPlay?: boolean;
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

// Sound file URLs - using free ambient audio from public domain sources
const SOUND_URLS: Record<SoundType, string | null> = {
    brown_noise: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_6b7ed29b7f.mp3',  // Brown noise
    '432hz': 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_69810c9f50.mp3',      // Healing tone
    om_mantra: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_7ff4e103f2.mp3',    // Om meditation
    silence: null
};

// Fallback to local files if CDN fails
const LOCAL_SOUND_URLS: Record<SoundType, string | null> = {
    brown_noise: '/audio/brown_noise.mp3',
    '432hz': '/audio/432hz.mp3',
    om_mantra: '/audio/om_mantra.mp3',
    silence: null
};

export function useAudio(initialSound: SoundType = 'silence', options: UseAudioOptions = {}): UseAudioReturn {
    const {
        loop = true,
        volume: initialVolume = 0.5,
        autoPlay = false
    } = options;

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSound, setCurrentSound] = useState<SoundType>(initialSound);
    const [volume, setVolumeState] = useState(initialVolume);
    const [isLoaded, setIsLoaded] = useState(false);
    const [useFallback, setUseFallback] = useState(false);

    // Initialize or change audio element
    useEffect(() => {
        if (currentSound === 'silence') {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setIsPlaying(false);
            setIsLoaded(true);
            return;
        }

        const url = useFallback ? LOCAL_SOUND_URLS[currentSound] : SOUND_URLS[currentSound];
        if (!url) return;

        // Create new audio element
        const audio = new Audio(url);
        audio.loop = loop;
        audio.volume = volume;
        audio.crossOrigin = 'anonymous';

        audio.oncanplaythrough = () => {
            setIsLoaded(true);
            if (autoPlay || isPlaying) {
                audio.play().catch(console.error);
            }
        };

        audio.onerror = () => {
            console.warn(`[useAudio] Failed to load ${url}, trying fallback`);
            if (!useFallback) {
                setUseFallback(true);
            }
        };

        audio.onplay = () => setIsPlaying(true);
        audio.onpause = () => setIsPlaying(false);

        // Cleanup previous audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }

        audioRef.current = audio;
        setIsLoaded(false);

        return () => {
            audio.pause();
            audio.src = '';
        };
    }, [currentSound, loop, useFallback]);

    // Update volume when it changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    const play = useCallback(() => {
        if (audioRef.current && currentSound !== 'silence') {
            audioRef.current.play().catch(console.error);
        }
    }, [currentSound]);

    const pause = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
    }, []);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
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
        setVolumeState(Math.max(0, Math.min(1, newVolume)));
    }, []);

    const setSound = useCallback((sound: SoundType) => {
        setCurrentSound(sound);
        setUseFallback(false); // Reset fallback when changing sound
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
    { id: '432hz', name: '432 Hz Tone', description: 'Healing frequency for harmony' },
    { id: 'om_mantra', name: 'Om Mantra', description: 'Sacred sound of the universe' }
];
