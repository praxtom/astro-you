"""Capture the lower landing-page narrative at desktop and mobile sizes."""

import os
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("ASTROYOU_BASE_URL", "http://127.0.0.1:5173")
OUTPUT_DIR = Path(os.environ.get("ASTROYOU_SCREENSHOT_DIR", "/tmp/astroyou-lower-story"))
SECTION_IDS = (
    "kundali",
    "translation",
    "guidance",
    "philosophy-proof",
    "questions",
    "invitation",
)


def capture(label: str, viewport: dict[str, int]) -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport=viewport, device_scale_factor=1)
        page.goto(BASE_URL, wait_until="networkidle")
        page.evaluate("document.documentElement.style.scrollBehavior = 'auto'")

        for section_id in SECTION_IDS:
            section = page.locator(
                f'[data-lower-story-section="{section_id}"]'
            )
            section.evaluate(
                "element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY)"
            )
            page.wait_for_timeout(150)
            page.screenshot(
                path=OUTPUT_DIR / f"{label}-{section_id}.png",
                full_page=False,
            )

        browser.close()


if __name__ == "__main__":
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    capture("desktop", {"width": 1440, "height": 1000})
    capture("mobile", {"width": 390, "height": 844})
