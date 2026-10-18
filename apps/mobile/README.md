# NutriScan mobile

NutriScan is an Expo Router frontend for local-first food scanning, nutrition
tracking, product comparison, and educational nutrition guidance.

## Setup and run

Requirements: Node 22, Android Studio/device, and an Expo development build.
On-device OCR uses `react-native-mlkit-ocr`, a native ML Kit bridge, so **Expo
Go is not supported**.

```bash
cd apps/mobile
pnpm exec expo install
pnpm android
```

For iOS, run `pnpm ios` on macOS. Typecheck and tests:

```bash
pnpm typecheck
pnpm test
```

## Backend (optional)

The app is fully usable offline with no server. To enable **AI answers and cross-device sync**, deploy
`apps/worker` (see its README), then:

```bash
cp .env.example .env
# set EXPO_PUBLIC_API_BASE_URL=https://<your-worker>.workers.dev   (a public URL, never a key)
npx expo start -c --dev-client
```

- AI: requests go to your Worker, which holds the provider keys. If the server is missing, offline, out of quota or
  unconfigured, chat falls back to a local guide and **labels it "not AI-generated"**.
- Sync: Settings → *Set up sync* creates a private account key (no email/password). Changes are tracked by SQLite
  triggers and synced newest-edit-wins; see `DATABASE.md`.
- Never put an API key in an `EXPO_PUBLIC_*` variable.

## Product decisions

- New users see genuine empty states. No seeded products, dashboard totals, or
  history are created. Numeric defaults exist only in the profile goal form.
- Nutrition and comparisons use per-100g/ml values. Missing values remain
  missing and never become zero or “better.”
- Scoring is a deterministic project heuristic documented under
  `src/features/scoring/README.md`; it is not a medical standard.
- Allergy matching is conservative. OCR-derived matches stay uncertain, and
  “may contain” is shown separately as cross-contamination.
- Calendar grouping uses device-local dates.
- Label images are resized before native, on-device OCR. The chosen ML Kit
  bridge requires a custom development build.
- Open Food Facts is credited in Settings and requests use a dedicated
  User-Agent. A production release should replace its placeholder contact with
  a monitored project email.

## Known limitations

- Recipes and alternatives need the backend AI; without it the local guide says so.
- Sync/auth/AI against a *deployed* Worker were verified only through automated tests in a sandbox (real mobile
  migrations + sync engine against the real Worker code on SQLite); they have not been run on a physical phone.
- OCR quality depends on device support, lighting, and package typography.
- Custom charting intentionally shows no bar for days without persisted data.
- Price is not supplied by Open Food Facts and is shown as unavailable.
- This repository also contains the host Figma Make Vite shell; the native app
  is isolated in `apps/mobile`.
