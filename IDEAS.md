# Pocket Golf Coach — Feature Ideas & Discussion Items

## 1. Apple Watch Integration
- Use Watch accelerometer + gyroscope data during the swing as a supplement to video pose estimation
- Questions to resolve:
  - Which wrist is the watch on? (lead vs trail wrist matters a lot for swing analysis)
  - Watch face orientation (up/down) affects sensor axis mapping
  - Does this replace or complement the video analysis?
  - Requires a watchOS companion app — significant scope addition
  - Could capture club speed, transition timing, tempo data that video can't easily measure
  - WatchKit / HealthKit permissions needed

## 2. Pro Reference Data — Source & Freshness
- Current state: hardcoded angle estimates in `api/services/feedback.py` for 5 pros (Rory, Tiger, Adam Scott, Jon Rahm, Nelly Korda)
- These are approximations, not measured from actual video
- Questions to resolve:
  - Should this data live in a database (so it can be updated without a code deploy)?
  - How do we source accurate biomechanical data for pros? (PGA ShotLink, licensed data, manual research?)
  - How often should it be updated? (injuries change swings, pros evolve technique)
  - Should we expand the pro roster, and how?
  - Could we let users compare against their own past swings, not just pros?

## 4. Golf News & Standings Feed
- A tab or section in the app with live golf content: current tournament leaderboards, world rankings, news headlines
- Questions to resolve:
  - Data source: PGA Tour API, ESPN API, SportsDataIO, or scraping? (most good sources are paid)
  - Where does it live in the app? Dedicated tab, or a section on the Home screen?
  - How often to refresh? (leaderboards change shot by shot during tournaments)
  - Links to full articles open in-app browser (SafariView) or external browser?
  - Should this be a free feature or Pro-only to drive upgrades?

## 5. Reduce Free Tier to 2 Analyses/Month
- Current limit is 5/month (set in `api/config.py` as `free_analyses_per_month`)
- Lower to 2 to create stronger upgrade incentive
- Simple config change — one line in Railway env variables or config.py
- Worth A/B testing: does 2 vs 3 meaningfully change conversion?
- Should the paywall screen clearly show "you've used X of 2 free analyses"?

## 6. Drill Links for Identified Issues
- Currently the AI returns drill instructions as plain text in the results
- Enhance with links to video demonstrations: YouTube, custom animations, or curated clips
- Questions to resolve:
  - Curated library vs. dynamic YouTube search per drill title?
  - Who maintains the link library? YouTube links rot over time
  - Could use YouTube Data API to search for drill videos automatically
  - Custom animations (like the onboarding stick figure) for each drill type — more branded, never goes stale
  - Should drill videos be a Pro-only feature?
  - Deep link into YouTube app vs. in-app video player?

## 7. Video Trimming Before Upload
- Golfers need to start recording, walk to position, swing, then stop — creating wasted footage at the start and end
- Two approaches to discuss:
  - **Manual in-app trim**: a simple scrubber UI after recording/picking a video, letting the user drag start/end handles before uploading. Clean UX, user has full control.
  - **Automatic server-side trim**: MediaPipe scans frames to detect when a golfer is present and in motion, auto-crops to just the swing. No UI needed, but adds processing time and complexity.
  - Best of both worlds: auto-detect and suggest trim points, but let user adjust before confirming
- Manual trim is lower risk and can ship faster; auto-trim could be a Pro feature
- expo-image-picker and expo-video already in the project — need to evaluate trimming library options (react-native-video-trim or similar)

## 3. Onboarding Background Video
- Replace (or layer behind) the current animated stick figure golfer with a real dimmed video of someone hitting a shot in a golf simulator
- Questions to resolve:
  - Do we shoot our own footage or license stock video?
  - Simulator aesthetic vs. outdoor course — which fits the brand better?
  - Need to handle autoplay, looping, and muting on iOS
  - Performance impact — video background adds to app size and memory
  - Should the video change per onboarding slide, or loop the same clip throughout?
