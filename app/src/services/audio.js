/**
 * services/audio.js — SwingCoach audio coaching
 *
 * Delivers the AI coaching script as spoken audio using the device's
 * built-in text-to-speech. Works through the phone speaker, earbuds,
 * AirPods, or any connected Bluetooth audio automatically.
 *
 * No extra hardware required — but sounds noticeably better through
 * AirPods or earbuds since the coaching feels like it's coming from
 * a real instructor right next to you.
 *
 * iOS audio fix:
 *   AVSpeechSynthesizer does NOT inherit the expo-av audio session by
 *   default. Playing a tiny silent WAV through Audio.Sound first forces
 *   the iOS .playback session to activate, after which Speech.speak()
 *   respects the session (plays through speaker even in silent mode).
 */
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

// ── Voice settings ────────────────────────────────────────────────────────────
// Rate 0.88 = slightly slower than normal speech — easier to follow on the range.
const VOICE_OPTIONS = {
  rate:   0.88,
  pitch:  1.0,
  volume: 1.0,
};

// ── Silent WAV primer ─────────────────────────────────────────────────────────
// A minimal valid WAV file: 44-byte header + 0.1 s of silence at 8 kHz mono.
// Playing this through Audio.Sound activates the iOS .playback audio session
// so that Speech.speak() inherits it and plays out loud even on silent mode.
const SILENT_WAV_URI =
  'data:audio/wav;base64,' +
  'UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAA==';

// ── iOS audio session setup ───────────────────────────────────────────────────
// Configure the session once. playsInSilentModeIOS overrides the hardware
// mute switch so coaching plays even when the phone is silenced on the course.
let _sessionReady = false;

async function _ensureAudioSession() {
  if (_sessionReady) return;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    _sessionReady = true;
  } catch (err) {
    console.warn('[SwingCoach] Audio session config failed:', err?.message ?? err);
  }
}

/**
 * Play a zero-duration silent sound to force iOS to activate the .playback
 * audio session before Speech.speak() is called.
 * This is the key fix for "no sound on iOS silent mode".
 */
async function _primeiOSAudio() {
  try {
    await _ensureAudioSession();
    const { sound } = await Audio.Sound.createAsync(
      { uri: SILENT_WAV_URI },
      { shouldPlay: false, volume: 0 },
    );
    await sound.playAsync();
    // Give it a tick to register with the OS, then release
    await new Promise((r) => setTimeout(r, 120));
    await sound.stopAsync();
    await sound.unloadAsync();
  } catch (err) {
    // Non-fatal — speech may still work
    console.warn('[SwingCoach] Silent primer failed:', err?.message ?? err);
  }
}

// Pre-warm the audio session on module load
_ensureAudioSession();

// State
let _speaking = false;

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Speak the full coaching script from an analysis result.
 * @param {string}   script      - The coaching_script from the API
 * @param {function} onProgress  - Called with (current, total) word count (not used by expo-speech, reserved)
 * @param {function} onDone      - Called when speech finishes
 */
export async function speakCoachingScript(script, onProgress, onDone) {
  if (!script) {
    onDone?.();
    return;
  }

  await stopSpeaking();
  await _primeiOSAudio();

  _speaking = true;

  Speech.speak(script, {
    ...VOICE_OPTIONS,
    onDone: () => {
      _speaking = false;
      onDone?.();
    },
    onStopped: () => {
      _speaking = false;
    },
    onError: (err) => {
      _speaking = false;
      console.warn('[SwingCoach] Speech error:', err);
      onDone?.();
    },
  });
}

/**
 * Speak a short summary line (used on the Results screen header).
 * @param {number} score
 * @param {string} proName
 */
export async function speakQuickSummary(score, proName) {
  await stopSpeaking();
  await _primeiOSAudio();
  const line = scoreToLine(score, proName);
  Speech.speak(line, { ...VOICE_OPTIONS, rate: 0.92 });
}

/**
 * Speak a single drill out loud — useful when the user taps a drill card.
 * @param {object} drill  - { title, instructions, reps }
 */
export async function speakDrill(drill) {
  await stopSpeaking();
  await _primeiOSAudio();
  const text = `${drill.title}. ${drill.instructions} ${drill.reps ? `Do ${drill.reps}.` : ''}`;
  Speech.speak(text, VOICE_OPTIONS);
}

/**
 * Stop any current speech immediately.
 */
export async function stopSpeaking() {
  _speaking = false;
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) await Speech.stop();
  } catch (_) {}
}

/**
 * Returns true if audio is currently playing.
 */
export async function isSpeaking() {
  return Speech.isSpeakingAsync();
}

/**
 * Check if the device supports speech synthesis.
 * Returns true on all modern iOS and Android devices.
 */
export async function isSupported() {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.length > 0;
  } catch {
    return true; // Assume supported if we can't check
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreToLine(score, proName) {
  if (score >= 85) return `Great swing. You scored ${score} out of 100 compared to ${proName}. You're building some serious consistency.`;
  if (score >= 70) return `Solid work. You scored ${score} out of 100 against ${proName}. There are a few things we can sharpen up — let's go through them.`;
  if (score >= 55) return `You scored ${score} out of 100 compared to ${proName}. Good fundamentals to build on. Here's what we're working on today.`;
  return `You scored ${score} out of 100 against ${proName}. Everyone starts somewhere — let's get to work on a couple of things that'll make a big difference right away.`;
}

/**
 * Build a coaching script client-side as a fallback if the API
 * didn't return one (e.g. older cached results).
 * @param {object} data - Full analysis result object
 */
export function buildFallbackScript(data) {
  const parts = [];

  // Opener
  parts.push(scoreToLine(data.overall_score, data.pro_name));

  // Positives first
  if (data.positives?.length > 0) {
    const p = data.positives[0];
    parts.push(`Here's what you're doing well. ${p.title}. ${p.description}`);
  }

  // Top issue
  const highIssues = (data.issues || []).filter(i => i.severity === 'high');
  const topIssue   = highIssues[0] || data.issues?.[0];
  if (topIssue) {
    parts.push(`The main thing to work on is this. ${topIssue.title}. ${topIssue.description}`);
  }

  // Second issue if present
  if (data.issues?.length > 1) {
    const second = data.issues[1];
    parts.push(`Also worth noting — ${second.title}. ${second.description}`);
  }

  // Top drill
  const topDrill = data.drills?.[0];
  if (topDrill) {
    parts.push(`Here's the drill I want you to focus on. ${topDrill.title}. ${topDrill.instructions} Try ${topDrill.reps || 'a few sets'} of this before your next round.`);
  }

  // Close
  parts.push(`Keep at it. Every swing you analyze gets you closer to where you want to be.`);

  return parts.join(' ... ');
}
