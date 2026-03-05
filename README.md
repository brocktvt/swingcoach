# SwingCoach

AI-powered golf swing analyzer. Record your swing, compare it to a tour pro, get specific feedback and drills.

## Project Structure

```
swingcoach/
├── app/          React Native (Expo) — iOS + Android app
└── api/          Python FastAPI — backend, pose analysis, AI feedback
```

## App (React Native / Expo)

### Screens
- **Onboarding** — 3-slide intro, sign up / sign in
- **Home** — stats, analyze CTA, recent history
- **Camera** — club selector, pro selector, record/upload video
- **Processing** — animated loading while backend runs
- **Results** — score ring, issues, drills, angle comparison table
- **History** — full list of past analyses
- **Profile** — account info, subscription status, sign out
- **Paywall** — monthly ($7.99) / annual ($47.99) plan selector

### Setup
```bash
cd app
npm install
npx expo start
```
Scan the QR code with the Expo Go app on your phone to preview.

### Key dependencies
| Package | Purpose |
|---|---|
| `@react-navigation` | Screen navigation |
| `expo-image-picker` | Camera + video library access |
| `axios` | API calls to backend |
| `react-native-purchases` | RevenueCat subscriptions (add when accounts ready) |

---

## API (Python / FastAPI)

### Endpoints
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| POST | `/analyze` | Upload video → get analysis |
| GET | `/analyses` | List user's past analyses |
| GET | `/analyses/{id}` | Get single analysis |
| GET | `/pros` | List available pro references |
| GET | `/health` | Health check |

### Setup
```bash
cd api
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### How analysis works
1. User uploads swing video via the app
2. FastAPI saves video to disk
3. MediaPipe extracts body landmarks at 6 swing phases (address, takeaway, top, downswing, impact, follow-through)
4. Key angles are calculated: hip rotation, shoulder tilt, elbow angles, spine angle, knee flex
5. Claude receives the angle data + pro benchmarks and returns structured JSON: score, issues, drills, angle comparisons
6. Results saved to SQLite DB and returned to app

### Pro references
Currently includes: Rory McIlroy, Tiger Woods, Adam Scott, Jon Rahm, Nelly Korda.
Add more in `services/feedback.py` → `PRO_REFERENCES` dict.

---

## Next steps (in order)

1. **Test locally** — `npx expo start` + `uvicorn main:app --reload`
2. **Add RevenueCat** — sign up at revenuecat.com, add `react-native-purchases` to app, fill in `PaywallScreen.js` purchase logic
3. **Deploy API** — Railway.app is the fastest option (~$5/mo). Push to GitHub, connect Railway, set env vars
4. **Apple Developer account** — $99/yr, needed for App Store submission
5. **Google Play account** — $25 one-time
6. **EAS Build** — `npx expo install expo-dev-client` → `eas build` to generate .ipa and .apk
7. **App store assets** — icon (1024×1024), screenshots (6.7" iPhone + Android), preview video
8. **App name** — "SwingCoach" is a working title, confirm before submission
