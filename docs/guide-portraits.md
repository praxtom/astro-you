# Guide Portraits

The Circle's guide portraits are wired to load from `public/assets/guides/{persona-id}.png`.
To activate a portrait:

1. Save the image as `public/assets/guides/<persona-id>.png` (square, ≥512×512).
2. Add the persona id to `GUIDES_WITH_ARTWORK` in
   `src/components/consult/PersonaPortrait.tsx`.

Until then, each guide shows their generative celestial sigil (unique seeded
constellation in their signature color).

## Generation prompts

Shared style suffix for every prompt — keeps the set cohesive:

> …, warm portrait photograph, soft golden side-light against a deep
> near-black background, gentle expression looking just past the camera,
> shallow depth of field, cinematic, photorealistic, square crop, chest-up

| File                   | Guide                                  | Prompt core                                                                                                         |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `guru-vidyanath.png`   | Guru Vidyanath — Spiritual Guide       | Serene Indian spiritual teacher in his 60s, silver beard, saffron shawl, rudraksha beads, calm half-smile           |
| `arjun-sharma.png`     | Arjun Sharma — Career Strategist       | Confident Indian man in his late 30s, neat short hair, charcoal kurta with rolled sleeves, focused and approachable |
| `meera-devi.png`       | Meera Devi — Relationship Guide        | Warm Indian woman in her 40s, soft maroon saree, small gold earrings, kind knowing smile                            |
| `pandit-raghunath.png` | Pandit Raghunath — Traditional Scholar | Dignified elderly Indian pandit in his 70s, white kurta and angavastram, tilak on forehead, scholarly bearing       |
| `dr-shanti.png`        | Dr. Shanti — Wellbeing Guide           | Composed Indian woman in her 50s, short grey-streaked hair, sage-green shawl, gentle clinical warmth                |
| `nanda-ji.png`         | Nanda Ji — Family Advisor              | Kindly Indian elder in his 60s, cream shawl, reading glasses on a cord, grandfatherly warmth                        |
| `ishaan-rao.png`       | Ishaan Rao — Business Timing           | Sharp young Indian man around 30, modern navy bandhgala, subtle confidence, city bokeh behind                       |
| `tara-kapoor.png`      | Tara Kapoor — Life Pattern Reader      | Thoughtful young Indian woman in her early 30s, loose dark hair, deep violet dupatta, quiet intensity               |

Notes:

- Use the same model/style for all eight in one session so lighting and grain match.
- Avoid real-person lookalikes; generated faces avoid likeness/endorsement
  rights issues that come with stock photos of real models.
- Keep backgrounds near-black — the portraits sit on `#06060c` cards.
