"""
services/feedback.py — Claude AI swing feedback generation

Takes the pose data from MediaPipe and the pro reference data,
sends it to Claude, and gets back structured feedback: overall score,
specific issues with severity, and targeted practice drills.
"""
import json
import logging
import anthropic
from config import settings

log = logging.getLogger(__name__)

# Pro reference angle benchmarks
# These are approximate target angles for each pro at key swing phases.
# More pro entries and phases can be added over time.
PRO_REFERENCES = {
    "rory_mcilroy": {
        "name": "Rory McIlroy",
        "style": "Powerful rotation with an upright spine angle, very wide arc, excellent hip clearance through impact.",
        "benchmarks": {
            "address":        { "hip_rotation": 90, "shoulder_tilt": 85, "spine_angle": 75, "lead_knee": 165, "trail_knee": 160 },
            "top":            { "hip_rotation": 45, "shoulder_tilt": 70, "trail_elbow": 90, "lead_elbow": 170 },
            "impact":         { "hip_rotation": 30, "shoulder_tilt": 88, "lead_elbow": 175, "trail_elbow": 115 },
        }
    },
    "tiger_woods": {
        "name": "Tiger Woods",
        "style": "Classic fundamentals — strong grip, wide takeaway, aggressive hip slide through impact, flat lead wrist at the top.",
        "benchmarks": {
            "address":        { "hip_rotation": 90, "shoulder_tilt": 87, "spine_angle": 72, "lead_knee": 162, "trail_knee": 158 },
            "top":            { "hip_rotation": 50, "shoulder_tilt": 68, "trail_elbow": 88, "lead_elbow": 168 },
            "impact":         { "hip_rotation": 28, "shoulder_tilt": 86, "lead_elbow": 178, "trail_elbow": 110 },
        }
    },
    "adam_scott": {
        "name": "Adam Scott",
        "style": "Textbook upright swing, ideal for amateurs to model. Excellent posture, smooth tempo, great extension post-impact.",
        "benchmarks": {
            "address":        { "hip_rotation": 90, "shoulder_tilt": 88, "spine_angle": 78, "lead_knee": 168, "trail_knee": 163 },
            "top":            { "hip_rotation": 48, "shoulder_tilt": 72, "trail_elbow": 92, "lead_elbow": 172 },
            "impact":         { "hip_rotation": 32, "shoulder_tilt": 90, "lead_elbow": 176, "trail_elbow": 112 },
        }
    },
    "jon_rahm": {
        "name": "Jon Rahm",
        "style": "Compact backswing with exceptional power from hip drive and a very aggressive transition. Short backswing, long follow-through.",
        "benchmarks": {
            "address":        { "hip_rotation": 90, "shoulder_tilt": 86, "spine_angle": 73, "lead_knee": 163, "trail_knee": 158 },
            "top":            { "hip_rotation": 55, "shoulder_tilt": 65, "trail_elbow": 85, "lead_elbow": 165 },
            "impact":         { "hip_rotation": 25, "shoulder_tilt": 85, "lead_elbow": 174, "trail_elbow": 108 },
        }
    },
    "nelly_korda": {
        "name": "Nelly Korda",
        "style": "Picture-perfect tempo and balance. Excellent rhythm, efficient rotation, consistent impact position.",
        "benchmarks": {
            "address":        { "hip_rotation": 90, "shoulder_tilt": 87, "spine_angle": 76, "lead_knee": 166, "trail_knee": 162 },
            "top":            { "hip_rotation": 50, "shoulder_tilt": 71, "trail_elbow": 91, "lead_elbow": 170 },
            "impact":         { "hip_rotation": 30, "shoulder_tilt": 88, "lead_elbow": 176, "trail_elbow": 112 },
        }
    },
    "scottie_scheffler": {
        "name": "Scottie Scheffler",
        "style": "Methodical, ultra-consistent ball-striker. Strong grip, deliberate tempo, excellent lag retention, and a very reliable impact position. World #1 known for repeatable fundamentals.",
        "benchmarks": {
            "address":        { "hip_rotation": 90, "shoulder_tilt": 87, "spine_angle": 74, "lead_knee": 164, "trail_knee": 160 },
            "top":            { "hip_rotation": 48, "shoulder_tilt": 69, "trail_elbow": 87, "lead_elbow": 167 },
            "impact":         { "hip_rotation": 27, "shoulder_tilt": 86, "lead_elbow": 177, "trail_elbow": 109 },
        }
    },
    "collin_morikawa": {
        "name": "Collin Morikawa",
        "style": "Elite iron-player with precise face control and a slightly inside-out path. Short, compact backswing with exceptional downswing sequencing and a very flat lead wrist at impact.",
        "benchmarks": {
            "address":        { "hip_rotation": 90, "shoulder_tilt": 88, "spine_angle": 77, "lead_knee": 167, "trail_knee": 163 },
            "top":            { "hip_rotation": 52, "shoulder_tilt": 73, "trail_elbow": 93, "lead_elbow": 168 },
            "impact":         { "hip_rotation": 29, "shoulder_tilt": 89, "lead_elbow": 178, "trail_elbow": 111 },
        }
    },
    "dustin_johnson": {
        "name": "Dustin Johnson",
        "style": "Exceptionally long with an athletic, bowed lead wrist at the top. Wide one-piece takeaway, massive hip clearance, and a very powerful squat-and-push move through impact.",
        "benchmarks": {
            "address":        { "hip_rotation": 90, "shoulder_tilt": 85, "spine_angle": 71, "lead_knee": 162, "trail_knee": 157 },
            "top":            { "hip_rotation": 42, "shoulder_tilt": 67, "trail_elbow": 86, "lead_elbow": 162 },
            "impact":         { "hip_rotation": 22, "shoulder_tilt": 84, "lead_elbow": 176, "trail_elbow": 106 },
        }
    },
    "xander_schauffele": {
        "name": "Xander Schauffele",
        "style": "Smooth, athletic swing with excellent tempo and a reliable fade shape. Great posture, consistent spine angle, and effortless-looking power generation through the kinematic sequence.",
        "benchmarks": {
            "address":        { "hip_rotation": 90, "shoulder_tilt": 87, "spine_angle": 75, "lead_knee": 165, "trail_knee": 161 },
            "top":            { "hip_rotation": 47, "shoulder_tilt": 70, "trail_elbow": 90, "lead_elbow": 170 },
            "impact":         { "hip_rotation": 29, "shoulder_tilt": 87, "lead_elbow": 176, "trail_elbow": 111 },
        }
    },
    "lydia_ko": {
        "name": "Lydia Ko",
        "style": "Technically refined swing with exceptional consistency. Upright posture, full shoulder turn, controlled tempo, and a very dependable ball-striking pattern ideal for accuracy-focused players.",
        "benchmarks": {
            "address":        { "hip_rotation": 90, "shoulder_tilt": 88, "spine_angle": 77, "lead_knee": 167, "trail_knee": 163 },
            "top":            { "hip_rotation": 51, "shoulder_tilt": 72, "trail_elbow": 92, "lead_elbow": 171 },
            "impact":         { "hip_rotation": 31, "shoulder_tilt": 89, "lead_elbow": 175, "trail_elbow": 113 },
        }
    },
}

SYSTEM_PROMPT = """You are SwingCoach, an expert golf instructor and biomechanics analyst with 20+ years of experience coaching amateurs and tour pros. You analyze golf swing data and provide specific, actionable feedback.

Your analysis should:
- Be honest but encouraging — lead with what's working before addressing what needs fixing
- Use plain English, not jargon — explain WHY each issue matters for ball striking
- Give specific, actionable drills, not vague advice like "keep your head down"
- Prioritize issues by impact: what will actually lower their scores fastest?
- Reference the pro's specific strengths when noting differences
- Always find genuine positives — even a beginner has something worth reinforcing
- If the golfer's name is provided, address them by name naturally throughout the coaching_script (not every sentence — 2-3 times feels natural, like a real instructor)
- The coaching_script must sound like a real instructor talking, not a bullet list being read aloud.
  Write it conversationally: warm, direct, specific. It will be spoken through the user's phone speaker or earbuds.

CRITICAL — VARIETY IN EVERY RESPONSE:
Every coaching script must feel distinct. Vary all of the following:
- Your opening line: never start two scripts the same way. Rotate between openers that focus on the score, the best thing you saw, the biggest opportunity, a comparison to the pro, or a quick summary of what the round of analysis showed.
- Your structure: sometimes lead with the positive, sometimes jump straight to the key fix, sometimes set context first.
- Your analogies and cue words: draw from a wide pool (e.g. "feel like you're sitting into a chair", "push the ground away", "keep the triangle intact", "fire the hips before the shoulders", "stack your weight over your lead foot" etc.)
- Your sign-off: vary between motivational, tactical, and reflective closes.
- Sentence rhythm: mix short punchy sentences with longer explanatory ones.
Never re-use the same opening sentence, drill instruction, or sign-off across different analyses.

Always respond with valid JSON matching the exact schema provided."""


def _golfer_profile_block(profile: dict | None) -> str:
    """Format golfer profile data as a readable context block for Claude."""
    if not profile:
        return ""

    lines = ["GOLFER PROFILE:"]

    if profile.get("first_name"):
        lines.append(f"  Name: {profile['first_name']} (address them by name 2-3 times in the coaching_script)")

    if profile.get("handicap") is not None:
        hcp = profile["handicap"]
        if hcp <= 5:
            skill = "low handicapper / near-scratch"
        elif hcp <= 10:
            skill = "mid-handicapper"
        elif hcp <= 20:
            skill = "high-handicapper"
        else:
            skill = "beginner"
        lines.append(f"  Handicap: {hcp} ({skill})")
    else:
        lines.append("  Handicap: not established (treat as beginner/developing golfer)")

    if profile.get("rounds_per_year"):
        r = profile["rounds_per_year"]
        freq = "very casual" if r < 6 else "occasional" if r < 15 else "regular" if r < 30 else "frequent"
        lines.append(f"  Rounds per year: {r} ({freq} golfer)")

    if profile.get("age"):
        lines.append(f"  Age: {profile['age']}")

    if profile.get("height_in"):
        h = profile["height_in"]
        feet, inches = int(h) // 12, int(h) % 12
        lines.append(f"  Height: {feet}'{inches}\"  ({h:.0f} in)")

    if profile.get("weight_lbs"):
        lines.append(f"  Weight: {profile['weight_lbs']:.0f} lbs")

    if profile.get("handedness"):
        lines.append(f"  Handedness: {profile['handedness']}-handed")

    GOAL_LABELS = {
        "hit_further":    "hit the ball further / more distance",
        "iron_accuracy":  "more accurate with irons",
        "chipping":       "better chipping and pitching",
        "fix_shape":      "fix ball flight shape (slice/hook)",
        "consistency":    "more consistent ball-striking",
        "scoring":        "lower scores / smarter course management",
        "putting":        "improve putting",
    }
    GOAL_FOCUS = {
        "hit_further":    "Prioritise hip rotation at impact, lag in the downswing, and width of arc. Emphasise power generation mechanics.",
        "iron_accuracy":  "Focus on spine angle consistency through the swing, face control at impact, and ball-first contact. De-emphasise power.",
        "chipping":       "Emphasise address setup (weight forward, shaft lean), lead wrist angle, and quiet lower body. Follow-through is key.",
        "fix_shape":      "Focus on swing path direction, face-to-path relationship, and hip rotation sequence. Identify what's causing the shape fault.",
        "consistency":    "Focus on spine angle maintenance, tempo through all phases, and repeatable impact position.",
        "scoring":        "Highlight the 1-2 changes with the highest scoring impact. Mention course-management implications of swing tendencies.",
        "putting":        "Note that putting mechanics differ from full swing — flag if full-swing posture habits may be carrying into their putting stroke.",
    }

    if profile.get("primary_goal"):
        g = profile["primary_goal"]
        lines.append(f"  Primary goal: {GOAL_LABELS.get(g, g)}")
        if g in GOAL_FOCUS:
            lines.append(f"  → Coaching focus: {GOAL_FOCUS[g]}")

    if profile.get("secondary_goal") and profile.get("secondary_goal") != profile.get("primary_goal"):
        g2 = profile["secondary_goal"]
        lines.append(f"  Secondary goal: {GOAL_LABELS.get(g2, g2)}")

    return "\n".join(lines)


def _skill_tone_instruction(profile: dict | None) -> str:
    """Return coaching tone/depth instructions appropriate for this golfer's level."""
    if not profile or profile.get("handicap") is None:
        handicap = 99  # treat as beginner
    else:
        handicap = profile["handicap"]

    age = profile.get("age") if profile else None

    if handicap > 20 or handicap == 99:
        tone = (
            "This is a high-handicap or beginner golfer. Use plain, jargon-free language. "
            "Focus exclusively on the 1-2 most impactful fundamentals — do not overwhelm them. "
            "Be very encouraging. Avoid tour-level technical detail."
        )
    elif handicap > 10:
        tone = (
            "This is a mid-handicap golfer. You can introduce some biomechanical concepts but keep "
            "explanations accessible. Focus on the changes most likely to lower their scores."
        )
    elif handicap > 5:
        tone = (
            "This is a low-mid handicap golfer. You can use technical language and detailed biomechanical "
            "explanations. They are ready for nuanced swing corrections."
        )
    else:
        tone = (
            "This is a low handicapper or scratch golfer. Use full technical detail — tour-level comparisons, "
            "precise angle targets, and nuanced sequence corrections are all appropriate."
        )

    if age and age >= 55:
        tone += (
            " Note: this golfer is 55+. Prioritise swing efficiency, tempo, and flexibility-friendly "
            "mechanics over raw power generation. Avoid recommending drills that require extreme ranges of motion."
        )

    return tone


def build_prompt(pose_data: dict, pro_id: str, club_type: str, profile: dict | None = None) -> str:
    pro = PRO_REFERENCES.get(pro_id, PRO_REFERENCES["rory_mcilroy"])

    # Use the new 25-frame data if available; fall back to legacy 6-phase format
    if "frames" in pose_data and pose_data["frames"]:
        swing_data = (
            f"Swing window: {pose_data.get('swing_start_s', 0):.1f}s – {pose_data.get('swing_end_s', pose_data['duration_s']):.1f}s "
            f"({'auto-detected' if pose_data.get('swing_detected') else 'full video'})\n"
            f"Total: {pose_data['frame_count']} frames at {pose_data['fps']}fps ({pose_data['duration_s']}s)\n\n"
            f"25-frame pose sequence (phase, sample#, % through swing, angles):\n"
            f"{json.dumps(pose_data['frames'], indent=2)}\n\n"
            f"Best-visibility snapshot per phase (use for angle_comparisons):\n"
            f"{json.dumps(pose_data.get('phases_summary', {}), indent=2)}"
        )
    else:
        # Legacy format
        swing_data = (
            f"Video: {pose_data['duration_s']}s, {pose_data['frame_count']} frames at {pose_data['fps']}fps\n"
            f"Pose data by phase:\n{json.dumps(pose_data.get('phases', {}), indent=2)}"
        )

    profile_block    = _golfer_profile_block(profile)
    skill_tone       = _skill_tone_instruction(profile)

    return f"""Analyze this golf swing and provide structured feedback.

CLUB TYPE: {club_type}

PRO REFERENCE: {pro['name']}
Pro's swing style: {pro['style']}
Pro's benchmark angles:
{json.dumps(pro['benchmarks'], indent=2)}

{profile_block}

COACHING TONE & DEPTH:
{skill_tone}

USER'S MEASURED SWING DATA:
{swing_data}

Respond with ONLY a JSON object in this exact format:
{{
  "overall_score": <integer 0-100 representing how close to pro quality>,
  "summary": "<2-3 sentence overall assessment — be specific about what's working and what's the biggest opportunity>",
  "positives": [
    {{
      "title": "<short title, e.g. 'Solid Spine Angle at Address'>",
      "description": "<1-2 sentences: what they're doing well and why it matters. Be specific — avoid generic praise.>",
      "phase": "<which swing phase this positive occurs in>"
    }}
  ],
  "issues": [
    {{
      "title": "<short descriptive title, e.g. 'Early Hip Extension'>",
      "description": "<2-3 sentences: what they're doing, what the pro does differently, and why it matters for ball striking>",
      "severity": "<high|medium|low>",
      "phase": "<which swing phase: address|takeaway|top|downswing|impact|follow_through>"
    }}
  ],
  "drills": [
    {{
      "title": "<drill name>",
      "instructions": "<clear step-by-step instructions — specific enough to do without a teacher present>",
      "reps": "<e.g. '3 sets of 10 swings' or '5 minutes of mirror work daily'>",
      "fixes_issue": "<title of the issue this drill addresses>"
    }}
  ],
  "angle_comparisons": [
    {{
      "label": "<angle name, e.g. 'Hip Rotation at Top'>",
      "yours": <user's measured angle as integer>,
      "pro": <pro's benchmark angle as integer>,
      "diff": <difference: user minus pro, as integer>
    }}
  ],
  "coaching_script": "<A spoken coaching session of 60-90 seconds when read aloud. Written in a warm, conversational instructor voice — NOT bullet points. Structure: (1) open with one genuine compliment on something specific, (2) walk through the 1-2 most important things to fix and exactly how to fix them, referencing the pro by name where helpful, (3) give the single most important drill to work on, described conversationally, (4) close with an encouraging send-off. Use natural speech patterns — short sentences, the occasional pause cue like '...'. No jargon.>"
}}

Find 2-3 genuine positives. Focus on the 2-3 most impactful issues. Maximum 3 drills, each tied to a specific issue. Be specific throughout."""


async def generate_feedback(pose_data: dict, pro_id: str, club_type: str, profile: dict | None = None) -> dict:
    """
    Send pose data to Claude and return structured feedback.
    profile: optional golfer profile dict (handicap, age, height_in, etc.)
    """
    # Let the SDK read ANTHROPIC_API_KEY from the environment directly
    # rather than passing through pydantic settings (which may return "")
    client = anthropic.Anthropic()
    prompt = build_prompt(pose_data, pro_id, club_type, profile)

    log.info(f"Requesting feedback from Claude (pro={pro_id}, club={club_type})")

    message = client.messages.create(
        model="claude-opus-4-5-20251101",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
        system=SYSTEM_PROMPT,
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        feedback = json.loads(raw)
    except json.JSONDecodeError as e:
        log.error(f"Claude returned invalid JSON: {e}\nRaw: {raw[:500]}")
        # Return safe fallback
        feedback = {
            "overall_score": 60,
            "summary": "Analysis complete. See your swing data above for details.",
            "positives": [],
            "issues": [],
            "drills": [],
            "angle_comparisons": [],
            "coaching_script": "Your swing analysis is complete. Check the app for your detailed results and drills.",
        }

    # Validate score range
    feedback["overall_score"] = max(0, min(100, int(feedback.get("overall_score", 60))))
    return feedback
