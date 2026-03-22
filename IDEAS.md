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

## 8. Side-by-Side Frame Comparison
- Show key-phase frames from the user's swing next to a reference image (pro or stock), with pose skeleton overlays color-coded green (good) / red (needs work)
- Two tiers of ambition:
  - **Key-frame stills** (buildable now): Extract the 6 phase frames from user video, draw MediaPipe skeleton on top, pair with a reference skeleton or image. Carousel in the results screen. No licensing issues.
  - **Synchronized video side-by-side** (longer term): Actual video playback aligned at impact frame, with live overlays. Requires licensed pro footage, temporal alignment, and video compositing pipeline — significant scope.
- Recommendation: ship key-frame stills first; add video as a Pro premium feature later
- The skeleton color-coding (green/red per joint based on angle delta vs. benchmark) is the key value-add

## 9. Swing Auto-Detection (Trim to Just the Swing)
- Currently pose.py samples at fixed percentages of the full video — it has no idea when the swing actually starts or ends
- If a golfer walks to the ball, sets up, then swings, the early frames (walking) corrupt the percentage-based sampling
- Approach: scan frames for the address position (stable pose, specific hip/shoulder/knee angle signature) to find swing start, then detect follow-through completion for swing end; crop analysis to that window
- Could also power auto-trim in the upload UI (see #7) — detect and suggest trim handles automatically
- Two modes: server-side auto-detect (no UI friction) and client-side suggested trim (user can override)
- Questions to resolve: what's the minimum confidence threshold for "is this a swing"? False positives on practice waggle or partial swings?

## 10. Increase Pose Sampling Rate
- Currently samples 6 frames (address through follow-through) at fixed percentages
- Increasing to 20+ frames would give Claude much richer data for the transition, downswing, and impact zone — the most consequential part of the swing
- Tradeoff: more frames = more MediaPipe processing time on the server (linear scaling)
- Could sample densely around impact (e.g., 10 frames between 55%–80%) and sparsely elsewhere
- Once swing auto-detection (#9) is in, we know the actual swing window and can sample evenly within it

## 11. Feedback History & Trend Analysis
- Save every analysis result (angles, score, issues, drills) per user, linked to the submission timestamp and club type
- Over time, compare scores and angle deltas across sessions to show whether the golfer is improving
- Features this unlocks:
  - "Your hip rotation at impact has improved 12° over your last 5 sessions"
  - Highlight which drill recommendations actually correlated with improvement
  - Identify persistent issues (flagged 3+ times = priority focus area)
  - "Improvement streaks" as a gamification/retention hook
- Backend: store `analysis_results` JSON in PostgreSQL alongside the upload record; add a `/history` endpoint
- Frontend: a "Progress" tab or section on Home showing trend lines per key angle

## 12. Golfer Profile / Skill Onboarding
- Before first analysis (or in a profile screen), ask:
  - Handicap index (or "I don't have one" → beginner)
  - Rounds per year (casual: 1-5, regular: 6-20, serious: 20+)
  - Age
  - Primary goal: distance, consistency, course management, short game?
  - Right- or left-handed
- Use this data to tailor Claude's feedback tone and priority:
  - Beginner (high handicap): focus on fundamentals, avoid technical jargon, encouraging tone
  - Mid-handicap: introduce more biomechanical detail, compare to pro styles
  - Low handicap / scratch: detailed technical breakdowns, tour-level comparisons
- Store in user profile table in PostgreSQL
- Pass as context to Claude in the feedback prompt

## 13. Pro Footage Acquisition for Reference
- Goal: replace hardcoded angle benchmarks with data actually measured from real pro video
- Possible sources:
  - License stock footage from Getty/Shutterstock (clean side-on DTL views exist)
  - PGA Tour / DP World Tour media licensing (expensive but high quality)
  - Publicly available YouTube footage (fair use gray area — risky for a commercial product)
  - Commission a golf photographer/videographer to film a teaching pro in the correct angles
- Once we have video, run it through the same MediaPipe pipeline to extract real angle benchmarks — much more accurate than hand-authored numbers
- Side-by-side stills (#8) become far more compelling once we have actual pro frames to show

## 14. Technology Partners to Evaluate
- **Sportsbox AI** (sportsbox.ai): Does markerless 3D motion analysis from a single 2D video — extract turn, bend, side-bend, sway, lift as full 3D kinematics. Potentially a much richer data source than MediaPipe. May have a B2B/enterprise API — contact support@sportsbox.ai to ask. If available, swapping our MediaPipe pipeline for their engine would be a major quality upgrade.
- **V1 Golf / V1 Sports** (v1sports.com): Has a large licensed library of PGA/LIV/LPGA professional swing videos with skeletal tracking. Closed ecosystem — no public API. Worth a cold email to explore a content licensing or data partnership.
- **Swing Profile** (swingprofile.com): Similar consumer app with auto swing detection and auto trim already solved. Useful as competitive reference. No public API.
- **Commission a teaching pro**: Hire a PGA teaching pro for a half-day, film them in proper side-on and DTL angles with all club types, run through our MediaPipe pipeline → real measured angle benchmarks to replace hand-authored numbers. Estimated cost $500–1,000. Highest ROI path to accurate pro reference data.

## 15. Expanded Goal Profiles in Golfer Onboarding
- Current primary_goal options: distance, consistency, short_game, course_management
- Expand to more granular, relatable goals a golfer would actually say:
  - "Hit the ball further" (distance / driver)
  - "More accurate with my irons"
  - "Better chipping and pitching"
  - "Fix my slice / hook"
  - "More consistent ball-striking"
  - "Lower my score / better course management"
  - "Improve my putting"
- Use the goal in Claude's prompt to focus analysis on the most relevant swing phases
  (e.g., a chipping goal = emphasise address setup and follow-through; distance = hip rotation and lag at impact)
- Could allow multiple goals selected in order of priority
- Questions to resolve: how many goals before the onboarding feels like a survey? Probably max 2 selected at once.

## 3. Onboarding Background Video
- Replace (or layer behind) the current animated stick figure golfer with a real dimmed video of someone hitting a shot in a golf simulator
- Questions to resolve:
  - Do we shoot our own footage or license stock video?
  - Simulator aesthetic vs. outdoor course — which fits the brand better?
  - Need to handle autoplay, looping, and muting on iOS
  - Performance impact — video background adds to app size and memory
  - Should the video change per onboarding slide, or loop the same clip throughout?
