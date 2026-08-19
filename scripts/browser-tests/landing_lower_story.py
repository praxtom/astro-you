"""Browser acceptance check for the immersive lower landing-page story."""

import os

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("ASTROYOU_BASE_URL", "http://127.0.0.1:5173")


def assert_open_surface(locator) -> None:
    styles = locator.evaluate(
        """(element) => {
          const style = getComputedStyle(element);
          return {
            background: style.backgroundImage,
            backgroundColor: style.backgroundColor,
            borderWidth: style.borderWidth,
            borderRadius: style.borderRadius,
          };
        }"""
    )
    assert styles["background"] == "none", styles
    assert styles["backgroundColor"] in ("rgba(0, 0, 0, 0)", "transparent"), styles
    assert styles["borderWidth"] == "0px", styles
    assert styles["borderRadius"] == "0px", styles


def run(viewport: dict[str, int]) -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport=viewport)
        page.goto(BASE_URL, wait_until="networkidle")

        story = page.locator('[data-lower-story="cosmos-to-self"]')
        assert story.count() == 1

        sections = story.locator("[data-lower-story-section]")
        assert sections.count() == 6
        assert sections.evaluate_all(
            "elements => elements.map(element => element.dataset.lowerStorySection)"
        ) == [
            "kundali",
            "translation",
            "guidance",
            "philosophy-proof",
            "questions",
            "invitation",
        ]

        assert story.locator("[data-celestial-thread]").count() == 1

        surfaces = story.locator('[data-surface-treatment="open"]')
        assert surfaces.count() >= 8
        for index in range(surfaces.count()):
            assert_open_surface(surfaces.nth(index))

        if viewport["width"] >= 1024:
            guidance = story.locator('[data-lower-story-section="guidance"]')
            guidance_center = guidance.bounding_box()["y"] + guidance.bounding_box()["height"] / 2
            signal_positions = {
                article.locator("h3").inner_text(): article.bounding_box()["y"]
                for article in guidance.locator("article").all()
            }
            assert signal_positions["Real-time transits"] < guidance_center
            assert signal_positions["Remedial upaay"] < guidance_center
            assert signal_positions["Dasha intelligence"] > guidance_center
            assert signal_positions["Living chart views"] > guidance_center

        faq = story.get_by_role(
            "button",
            name="How is Vedic astrology different from Western astrology?",
        )
        assert faq.get_attribute("aria-expanded") == "false"
        faq.click()
        assert faq.get_attribute("aria-expanded") == "true"

        story.get_by_role("button", name="Reveal my birth sky").last.click()
        assert page.get_by_role("dialog").count() == 1

        if viewport["width"] <= 400:
            overflow = page.evaluate(
                "document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            overflowing_elements = page.evaluate(
                """() => [...document.querySelectorAll('*')]
                  .map((element) => {
                    const rect = element.getBoundingClientRect();
                    return {
                      tag: element.tagName,
                      className: typeof element.className === 'string' ? element.className : '',
                      left: Math.round(rect.left),
                      right: Math.round(rect.right),
                      width: Math.round(rect.width),
                    };
                  })
                  .filter((element) => element.left < -1 || element.right > innerWidth + 1)
                  .slice(0, 12)"""
            )
            assert overflow <= 1, {
                "overflow": overflow,
                "elements": overflowing_elements,
            }

        browser.close()


if __name__ == "__main__":
    run({"width": 1440, "height": 1000})
    run({"width": 390, "height": 844})
