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
}

SYSTEM_PROMPT = """You are SwingCoach, an expert golf instructor and biomechanics analyst with 20+ years of experience coaching amateurs and tour pros. You analyze golf swing data and provide specific, actionable feedback.

Your analysis should:
- Be honest but encouraging — lead with what's working before addressing what needs fixing
- Use plain English, not jargon — explain WHY each issue matters for ball striking
- Give specific, actionable drills, not vague advice like "keep your head down"
- Prioritize issues by impact: what will actually lower their scores fastest?
- Reference the pro's specific strengths when noting differences
- Always find genuine positives — even a beginner has something worth reinforcing
- The coaching_script must sound like a real instructor talking, not a bullet list being read aloud.
  Write it conversationally: warm, direct, specific. It will be spoken through the user's phone speaker or earbuds.

Always respond with valid JSON matching the exact schema provided."""


def build_prompt(pose_data: dict, pro_id: str, club_type: str) -> str:
    pro = PRO_REFERENCES.get(pro_id, PRO_REFERENCES["rory_mcilroy"])

    return f"""Analyze this golf swing and provide structured feedback.

CLUB TYPE: {club_type}

PRO REFERENCE: {pro['name']}
Pro's swing style: {pro['style']}
Pro's benchmark angles:
{json.dumps(pro['benchmarks'], indent=2)}

USER'S MEASURED SWING DATA:
Video: {pose_data['duration_s']}s, {pose_data['frame_count']} frames at {pose_data['fps']}fps
Pose data by phase:
{json.dumps(pose_data['phases'], indent=2)}

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


async def generate_feedback(pose_data: dict, pro_id: str, club_type: str) -> dict:
    """
    Send pose data to Claude and return structured feedback.
    """
    # Let the SDK read ANTHROPIC_API_KEY from the environment directly
    # rather than passing through pydantic settings (which may return "")
    client = anthropic.Anthropic()
    prompt = build_prompt(pose_data, pro_id, club_type)

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
