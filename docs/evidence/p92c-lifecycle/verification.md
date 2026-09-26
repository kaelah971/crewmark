# P9.2C lifecycle acceptance

- Opened the Vite app at `http://127.0.0.1:5173` in Chromium.
- Entered the yard through the onboarding gate.
- Opened the Forgery Garage and Print Bay; confirmed the live UI exposed `EDIT VEHICLE`, `LOCK COVER//01`, `RUN VISUAL CHECK`, and `BACK TO YARD` controls.
- Captured the Print Bay surface during the browser smoke run; the screenshot was rendered by the browser harness during verification.
- Final automated regression: `npm test -- --run` — 20 files, 226 tests passed.
- Production build: `npm run build` passed.
- Lint: `npm run lint` passed with the repository's existing four warnings in `src/App.tsx` and `src/components/WallScene.tsx`.
