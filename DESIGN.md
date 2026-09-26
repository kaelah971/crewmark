---
version: alpha
name: CREW//MARK
description: Permanent visual direction for GTA VI-inspired, modern AAA-game cinematic realism with live editorial web UI and real player-created mark propagation.
colors:
  asphalt: "#10100F"
  bleached: "#F2EBDD"
  signal-lime: "#D8FF3E"
  heat-red: "#FF4338"
  surveillance-blue: "#88B8FF"
  tar-grey: "#70706B"
typography:
  display:
    fontFamily: "Arial Black, Helvetica Neue, Arial, sans-serif"
  body:
    fontFamily: "Arial, Helvetica Neue, Helvetica, sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
---

## Overview

CREW//MARK is a GTA VI-inspired interactive experience built around player-made visual identity. Its permanent visual system combines modern AAA-game cinematic realism; sharp, controlled editorial UI; and propagation of the real mark saved from React Image Editor. Environments, people, vehicles, materials, lighting, paint, reflections, weather, and atmosphere must feel believable and game-like. Slight stylization through grading and editorial treatment is intentional; literal documentary photography, flat SVG illustration, cartoons, and SaaS or dashboard visuals are not. The world must feel grounded, humid, dangerous, territorial, and premium rather than like a coded illustration or dashboard.

## Colors

Use asphalt as the environmental base and bleached for primary type. Signal lime identifies crew marks, decisive actions, and selected system labels; keep it restrained so it retains authority. Heat red communicates danger and escalation. Surveillance blue belongs to evidence, scanning, and institutional observation. Tar grey supports secondary copy, inactive states, and subdued borders.

Color grading may be stylized, but practical light, material response, and reflections must remain believable. Avoid bright cheerful balance and generalized neon or cyberpunk treatment.

## Typography

Headlines are bold, condensed, dominant, poster-like, and editorial. Use the display stack for major titles and game-splash statements, the body stack for controlled supporting copy, and the mono stack for metadata, evidence labels, HUD values, entry codes, and system states.

Headline scale should establish the scene's primary hierarchy without turning the layout into a generic marketing hero. Supporting text stays concise and legible over environmental plates.

## Layout

Build scenes with explicit foreground, midground, and background depth. Prioritize practical light sources, wet reflections, surface texture, grime, street clutter, skyline silhouettes, palms, utility wires, atmosphere, and believable wall zones where the player's mark can live.

The landing is a full-viewport game entry screen with live editorial UI over a realistic alley plate. Future district, wall, city-reaction, surveillance, evidence, warehouse, counterfeit, reclamation, and finale scenes follow the same environment-plus-overlay composition.

Do not simplify architecture or game logic to accommodate easier artwork. Adapt scene layout around the existing stage flow, persistence, and real saved mark.

## Elevation & Depth

Create depth primarily through photographic composition, occlusion, atmosphere, lighting, reflections, and environmental layering. UI overlays may use dark translucent fields and restrained shadows for legibility, but must not become glassmorphism-heavy surfaces or a floating dashboard.

## Shapes

Prefer sharp editorial geometry, narrow rules, controlled rectangular controls, and compact technical marks. Avoid over-rounded startup styling. Small icons, symbols, emblems, and technical overlays may use simple SVG geometry when they are not standing in for an environment.

## Components

Environmental art must use realistic raster or generated scene plates for alleys, safehouses, walls, warehouses, surveillance, districts, city shots, and cinematic reveals. Do not ship a flat SVG, generic gradient, or coded vector scene as a primary environment.

Keep wordmarks, headings, copy, buttons, menus, drawers, cards, HUD, REP/HEAT/TERRITORY values, evidence metadata, system labels, and session controls as live React and HTML/CSS.

The saved player mark is the canonical identity asset. Reuse the real mark on vehicles, jackets, safehouses, walls, contraband, surveillance evidence, counterfeit scenes, and future MARK//002 propagation whenever it exists. Never replace an available saved mark with a substitute placeholder.

Motion supports cinematic realism through slow environmental drift, slight camera pushes, restrained practical-light flicker, spray mist pulses, HUD ticks, evidence scanning, hard editorial transitions, and cinematic cuts. Avoid buoyant easing, cute motion, and decorative animation that competes with the scene.

## Do's and Don'ts

- Do test every scene for realism, cinematic depth, believable worldbuilding, gritty identity, and freedom from flat SVG-looking environment art.
- Do choose a realistic raster or generated environment whenever the alternative is an easier flat scene.
- Do say explicitly when available assets cannot meet the realism bar and recommend a replacement scene plate.
- Do preserve existing architecture, gameplay logic, persistence, and real mark propagation while upgrading visuals.
- Don't use flat placeholder alleys, simplistic vector cities, cartoon characters, or generic gradients as final environments.
- Don't drift into generic SaaS composition, abstract hackathon UI, a clean corporate system, or a cyberpunk dashboard.
- Don't use bright cheerful styling, excessive glassmorphism, over-rounded cards, or uncontrolled lime accents.
- Don't treat SVG as the primary medium for environmental art; reserve it for icons, small symbols, utility graphics, technical overlays, and simple emblems.

## Visual Fidelity Gate

This design system is a hard project constraint, not a loose inspiration guide.

Before implementing or approving any major visual scene, classify it as one of:

1. ENVIRONMENTAL SCENE
2. LIVE UI
3. UTILITY GRAPHIC

### Environmental Scene

Examples:

- landing alley
- vehicle reveal
- jacket reveal
- safehouse
- contraband environment
- district/location scene
- claim wall
- warehouse
- evidence/crime scene
- city reaction photography
- finale

Environmental scenes MUST use realistic raster/generated imagery or another medium capable of achieving believable GTA VI-inspired modern AAA-game cinematic realism.

A flat SVG environment is NOT an acceptable final asset.

If the required realistic scene plate does not exist:

- stop visual implementation for that scene
- report the missing asset clearly
- specify exactly what realistic asset is needed
- continue only with surrounding UI or logic that does not require inventing a lower-quality substitute

Never silently replace a missing realistic asset with:

- SVG city art
- CSS-gradient scenery
- simplistic silhouettes
- geometric placeholder environments
- cartoon artwork

### Live UI

Keep these as real React/HTML/CSS whenever practical:

- typography
- buttons
- HUD
- menus
- cards
- metadata
- evidence interfaces
- progress values
- labels
- navigation
- interaction controls

UI should sit OVER the world rather than becoming part of a flattened scene image.

### Utility Graphics

SVG is appropriate for:

- icons
- marks
- map geometry
- evidence brackets
- targeting frames
- registration marks
- small decals
- rival crew symbols
- technical overlays

Utility graphics must not replace realistic environmental imagery.

## Realism Standard

“Realistic” in CREW//MARK means modern AAA-game cinematic realism rather than literal documentary photography.

Target:

- believable people and clothing
- believable vehicles
- believable architecture
- believable materials
- physical paint behavior
- realistic lighting
- atmospheric depth
- grounded proportions
- cinematic composition

Slight stylization through grading, contrast, grain, typography, framing, and signal-lime accents is encouraged.

The target reaction is:

> “This looks like a scene from a modern GTA VI-inspired game.”

Not:

> “This looks like a photo website.”

And not:

> “This looks like an SVG game mockup.”

## Approved Reference Hierarchy

When visual references are supplied by the user:

1. The explicitly approved visual reference controls scene composition and realism.
2. This design system controls overall brand consistency.
3. Existing implementation should adapt to those references.
4. Existing low-fidelity assets must NOT be preserved simply because they already exist.

If an old asset conflicts with a newly approved reference, replace the old asset.

## Final Scene Checklist

Before considering any visual scene complete, verify:

- [ ] Environment looks realistically rendered rather than diagrammed
- [ ] Foreground / midground / background depth exists
- [ ] Materials respond believably to light
- [ ] Character/vehicle proportions are credible
- [ ] Paint, grime, rain, reflections, and atmosphere feel physical
- [ ] CREW//MARK UI remains live and readable
- [ ] Signal lime is controlled rather than everywhere
- [ ] Real saved player mark is used when applicable
- [ ] Scene does not resemble SaaS
- [ ] Scene does not resemble flat vector illustration
- [ ] Scene feels consistent with a modern GTA VI-inspired game world
