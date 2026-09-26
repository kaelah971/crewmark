# CREW//MARK landing design QA

- Source visual truth: `C:\Users\emman\Downloads\Telegram Desktop\photo_2026-09-22_22-06-01.jpg`
- Implementation: `http://127.0.0.1:4173/`
- Browser-rendered evidence: Codex in-app browser capture (inline capture; the browser surface does not expose a filesystem screenshot path)
- Primary comparison viewport: 1280 × 720 CSS px at devicePixelRatio 1
- Source pixels: 1280 × 720
- Implementation pixels: 1280 × 720
- State: fresh run; saved-run hero and open drawer checked separately

## Full-view comparison evidence

The implementation and source were compared at the same 1280 × 720 crop. Both use a full-bleed wet night alley, dark left copy field, skyline through the center, painter and lime wall mark on the right, live header/copy/CTA, three bottom cards, and a narrow identity rail. The primary region proportions and first-viewport content match without horizontal or vertical overflow.

## Focused comparison evidence

- Typography: live Impact/Arial Narrow system stack gives the required condensed weight and preserves the exact two-line desktop wrap. The source uses a more distressed display face; this remains a P3 material difference.
- Spacing: logo and header align near the source's 50 px gutter; hero copy, 256 px CTA, 72 px cards, and 132 px rail match the source's visual rhythm.
- Color: off-white, deep black, restrained warm/red reflections, and signal lime follow the source. Lime is limited to the mark, accent, labels, and primary action.
- Image quality: the scene is a 1672 × 941 local raster plate with realistic wet surfaces, palms, skyline, painter, paint mist, splatter, and drips. No UI is baked into it.
- Copy: wordmark, entry label, eyebrow, headline, supporting copy, CTA, step cards, and identity statement match the supplied copy.

## Comparison history

1. Initial 1280 × 720 pass: headline was too narrow and the copy stack was high relative to the source. Increased the controlled desktop headline scale and adjusted the copy position.
2. Initial 1440 × 900 pass: `MAKE YOUR MARK.` wrapped to two lines. Increased the copy track and locked desktop headline lines while restoring normal wrapping on mobile.
3. Final pass: 1280, 1440, 1600, and 390 px views have no horizontal overflow; desktop preserves the reference composition and mobile becomes a vertically scrollable fallback.

## Interaction evidence

- Fresh Enter the City reaches the existing studio and Unlayer editor.
- Menu opens as a fixed right drawer; Escape closes it and restores focus to the menu button.
- About and How It Works actions render and close/scroll as intended.
- A test mark persisted through refresh; Continue Run resumed the identity reveal and Edit Mark returned to the studio.
- Saved stats, story status, claim count, and Reset Session are rendered from the existing `progress` and callback props.
- Browser console: no warnings or errors from the landing flow.

## Remaining P3 differences

- The photographic plate recreates the source composition rather than duplicating its exact pedestrians, posters, car, and skyline geometry.
- The system display font has less distressed texture than the reference lettering.

final result: passed
