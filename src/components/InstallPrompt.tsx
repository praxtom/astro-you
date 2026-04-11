import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [show, setShow] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Show after 2nd visit
            const visits = parseInt(localStorage.getItem('astroyou_visits') || '0') + 1;
            localStorage.setItem('astroyou_visits', String(visits));
            if (visits >= 2 && !localStorage.getItem('astroyou_install_dismissed')) {
                setShow(true);
            }
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    if (!show || !deferredPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-[#0a0a0f] border border-gold/20 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gold/10">
                <Download size={20} className="text-gold" />
            </div>
            <div className="flex-1">
                <p className="text-sm text-white font-medium">Install AstroYou</p>
                <p className="text-xs text-white/40">Add to home screen for quick access</p>
            </div>
            <button onClick={() => { deferredPrompt.prompt(); setShow(false); }}
                className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-bold">
                Install
            </button>
            <button onClick={() => { setShow(false); localStorage.setItem('astroyou_install_dismissed', 'true'); }}
                className="p-1 text-white/30 hover:text-white/60">
                <X size={16} />
            </button>
        </div>
    );
}
