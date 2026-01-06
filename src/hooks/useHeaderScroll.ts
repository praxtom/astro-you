import { useState, useEffect } from "react";

/**
 * useHeaderScroll
 * Logic for hiding/showing header based on scroll direction.
 */
export function useHeaderScroll(threshold = 100) {
    const [isVisible, setIsVisible] = useState(true);
    const [scrolled, setScrolled] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Determine if background should change (blur/border)
            setScrolled(currentScrollY > 20);

            // Early exit if scroll is within top buffer
            if (currentScrollY < threshold) {
                setIsVisible(true);
                setLastScrollY(currentScrollY);
                return;
            }

            // Hide if scrolling down, show if scrolling up
            if (currentScrollY > lastScrollY && currentScrollY > threshold) {
                setIsVisible(false);
            } else if (currentScrollY < lastScrollY) {
                setIsVisible(true);
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [lastScrollY, threshold]);

    return { isVisible, scrolled };
}
