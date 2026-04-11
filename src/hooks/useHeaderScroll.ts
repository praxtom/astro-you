import { useState, useEffect, useRef } from "react";

/**
 * useHeaderScroll
 * Logic for hiding/showing header based on scroll direction.
 * Uses a ref for lastScrollY to avoid recreating the listener on every scroll.
 */
export function useHeaderScroll(threshold = 100) {
    const [isVisible, setIsVisible] = useState(true);
    const [scrolled, setScrolled] = useState(false);
    const lastScrollYRef = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const lastScrollY = lastScrollYRef.current;

            setScrolled(currentScrollY > 20);

            if (currentScrollY < threshold) {
                setIsVisible(true);
            } else if (currentScrollY > lastScrollY && currentScrollY > threshold) {
                setIsVisible(false);
            } else if (currentScrollY < lastScrollY) {
                setIsVisible(true);
            }

            lastScrollYRef.current = currentScrollY;
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [threshold]);

    return { isVisible, scrolled };
}
