import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, VolumeX, Music2, Wind, Waves, Circle, Plus } from 'lucide-react';
import { useAudio, SoundType, SOUND_OPTIONS } from '../../hooks/useAudio';

interface PranaOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'calm' | 'energize' | 'balance';
    duration?: number; // in seconds
}

export const PranaOverlay: React.FC<PranaOverlayProps> = ({
    isOpen,
    onClose,
    initialMode = 'calm',
    duration = 60 // 1 minute default
}) => {
    const [mode, setMode] = useState<'calm' | 'energize' | 'balance'>(initialMode);
    const [timeLeft, setTimeLeft] = useState(duration);
    const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
    const [showSoundMenu, setShowSoundMenu] = useState(false);
    
    // Preparation State
    const [isPreparing, setIsPreparing] = useState(true);
    const [prepCountdown, setPrepCountdown] = useState(3);

    // Map mode to default sound
    const getDefaultSound = (): SoundType => {
        switch (mode) {
            case 'calm': return 'brown_noise';
            case 'energize': return '432hz';
            case 'balance': return 'om_mantra';
            default: return 'brown_noise';
        }
    };

    // Audio hook integration
    const {
        play,
        stop,
        toggle,
        setSound,
        setVolume,
        isPlaying,
        currentSound,
        volume
    } = useAudio(getDefaultSound(), { loop: true, autoPlay: true });

    // Breath timings based on mode
    const getTimings = () => {
        switch (mode) {
            case 'energize': return { inhale: 4, hold: 4, exhale: 4 };
            case 'balance': return { inhale: 5, hold: 0, exhale: 5 };
            case 'calm': default: return { inhale: 4, hold: 7, exhale: 8 };
        }
    };

    const timings = getTimings();

    // Prep Countdown Logic
    useEffect(() => {
        if (!isOpen || !isPreparing) return;
        
        const prepTimer = setInterval(() => {
            setPrepCountdown((prev) => {
                if (prev <= 1) {
                    setIsPreparing(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(prepTimer);
    }, [isOpen, isPreparing]);

    // Timer countdown (Main session)
    useEffect(() => {
        if (!isOpen || isPreparing) return;
        setTimeLeft(duration);

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    onClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, onClose, duration, isPreparing]);

    // Start/stop audio on open/close
    useEffect(() => {
        if (isOpen && !isPreparing) {
            play();
        } else if (!isOpen) {
            stop();
        }
    }, [isOpen, isPreparing]);

    // Breath Cycle Logic
    useEffect(() => {
        if (!isOpen || isPreparing) return;

        let timeoutId: NodeJS.Timeout;

        const runCycle = () => {
            setPhase('inhale');
            timeoutId = setTimeout(() => {
                if (timings.hold > 0) {
                    setPhase('hold');
                    timeoutId = setTimeout(() => {
                        setPhase('exhale');
                        timeoutId = setTimeout(runCycle, timings.exhale * 1000);
                    }, timings.hold * 1000);
                } else {
                    setPhase('exhale');
                    timeoutId = setTimeout(runCycle, timings.exhale * 1000);
                }
            }, timings.inhale * 1000);
        };

        runCycle();

        return () => clearTimeout(timeoutId);
    }, [isOpen, mode, isPreparing]);

    // Get sound icon based on type
    const getSoundIcon = (sound: SoundType) => {
        switch (sound) {
            case 'brown_noise': return <Waves size={16} />;
            case '432hz': return <Wind size={16} />;
            case 'om_mantra': return <Music2 size={16} />;
            default: return <Circle size={16} />;
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
            >
                {/* Close Button */}
                <button
                    onClick={() => { stop(); onClose(); }}
                    className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors"
                >
                    <X size={32} />
                </button>

                {/* Sound Controls - Top Left */}
                <div className="absolute top-6 left-6 flex items-center gap-2">
                    <button
                        onClick={toggle}
                        className="p-2 text-white/50 hover:text-white transition-colors"
                    >
                        {isPlaying ? <Volume2 size={24} /> : <VolumeX size={24} />}
                    </button>

                    {/* Volume Slider */}
                    {isPlaying && (
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={volume * 100}
                            onChange={(e) => setVolume(parseInt(e.target.value) / 100)}
                            className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:rounded-full"
                        />
                    )}

                    {/* Sound Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSoundMenu(!showSoundMenu)}
                            className="p-2 text-white/50 hover:text-white transition-colors flex items-center gap-1"
                        >
                            <Music2 size={18} />
                            <span className="text-xs uppercase tracking-wider">{currentSound.replace('_', ' ')}</span>
                        </button>

                        {/* Sound Menu */}
                        <AnimatePresence>
                            {showSoundMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-full left-0 mt-2 bg-black/90 border border-white/10 rounded-xl overflow-hidden min-w-[200px]"
                                >
                                    {SOUND_OPTIONS.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => {
                                                setSound(option.id);
                                                setShowSoundMenu(false);
                                                if (option.id !== 'silence') play();
                                            }}
                                            className={`w-full p-3 flex items-center gap-3 text-left transition-colors ${
                                                currentSound === option.id
                                                    ? 'bg-gold/20 text-gold'
                                                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                                            }`}
                                        >
                                            {getSoundIcon(option.id)}
                                            <div>
                                                <div className="text-sm font-medium">{option.name}</div>
                                                <div className="text-xs text-white/40">{option.description}</div>
                                            </div>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex flex-col items-center justify-center space-y-12 w-full max-w-md px-6">
                    <AnimatePresence mode="wait">
                        {isPreparing ? (
                            <motion.div
                                key="prep"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                transition={{ duration: 0.5 }}
                                className="flex flex-col items-center justify-center space-y-8"
                            >
                                <motion.h2 
                                    className="text-2xl md:text-3xl font-display text-white/40 tracking-[0.3em] uppercase text-center"
                                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    Prepare to breathe...
                                </motion.h2>
                                <motion.div 
                                    key={prepCountdown}
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-8xl md:text-9xl font-display text-gold"
                                >
                                    {prepCountdown}
                                </motion.div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="session"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="flex flex-col items-center justify-center space-y-12 w-full"
                            >
                                {/* Mode Selector */}
                                <div className="flex items-center gap-3 bg-white/5 p-1 rounded-full border border-white/10">
                                    {(['calm', 'energize', 'balance'] as const).map((m) => (
                                        <button
                                            key={m}
                                            onClick={() => setMode(m)}
                                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${
                                                mode === m 
                                                    ? m === 'calm' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                                      m === 'energize' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                                      'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                                    : 'text-white/30 hover:text-white/60'
                                            }`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>

                                {/* Guidance Text */}
                                <motion.h2
                                    key={phase}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="text-3xl md:text-4xl font-display text-gold tracking-wide text-center"
                                >
                                    {phase === 'inhale' && "Breathe In..."}
                                    {phase === 'hold' && "Hold..."}
                                    {phase === 'exhale' && "Release..."}
                                </motion.h2>

                                {/* The Cosmic Circle */}
                                <div className="relative w-64 h-64 flex items-center justify-center">
                                    {/* Outer Glow Ring */}
                                    <motion.div
                                        animate={{
                                            scale: phase === 'inhale' ? 1.5 : phase === 'hold' ? 1.5 : 1,
                                            opacity: phase === 'inhale' ? 0.5 : phase === 'hold' ? 0.6 : 0.3,
                                        }}
                                        transition={{ duration: phase === 'inhale' ? timings.inhale : phase === 'exhale' ? timings.exhale : 0 }}
                                        className="absolute inset-0 rounded-full bg-gold blur-2xl"
                                    />

                                    {/* Main Breathing Circle */}
                                    <motion.div
                                        animate={{
                                            scale: phase === 'inhale' ? 1.2 : phase === 'hold' ? 1.2 : 0.8,
                                        }}
                                        transition={{
                                            duration: phase === 'inhale' ? timings.inhale : phase === 'exhale' ? timings.exhale : 0,
                                            ease: "easeInOut"
                                        }}
                                        className="w-48 h-48 rounded-full border-2 border-gold/50 flex items-center justify-center relative bg-gradient-to-b from-space-light to-space-dark"
                                    >
                                        <div className="w-full h-full rounded-full bg-gold/10 backdrop-blur-md flex items-center justify-center">
                                            {/* Phase Counter */}
                                            <span className="text-gold/60 text-lg font-mono">
                                                {phase === 'inhale' && timings.inhale}
                                                {phase === 'hold' && timings.hold}
                                                {phase === 'exhale' && timings.exhale}
                                            </span>
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Timer & Add Minute */}
                                <div className="flex items-center gap-6 text-white/60">
                                    <span className="font-mono text-2xl">
                                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                    </span>
                                    
                                    <button 
                                        onClick={() => setTimeLeft(prev => prev + 60)}
                                        className="p-2 rounded-full border border-white/10 hover:bg-gold/10 hover:text-gold hover:border-gold/30 transition-all flex items-center justify-center gap-1 group"
                                        title="Add 1 minute"
                                    >
                                        <Plus size={16} className="group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest pr-1">1m</span>
                                    </button>
                                </div>

                                {/* Instructions */}
                                <p className="text-white/40 text-sm text-center max-w-xs">
                                    {mode === 'calm' && "Focus on extending your exhale to calm the nervous system."}
                                    {mode === 'energize' && "Quick, rhythmic breaths to build inner fire (Agni)."}
                                    {mode === 'balance' && "Equal breath to center the mind."}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
