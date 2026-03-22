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
 */
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

// ── Voice settings ────────────────────────────────────────────────────────────
// These settings are tuned to sound like a calm, clear instructor.
// Rate 0.88 = slightly slower than normal speech — easier to follow on the range.
const VOICE_OPTIONS = {
  rate:   0.88,
  pitch:  1.0,
  volume: 1.0,
  // iOS: prefer a natural-sounding voice
  // Android: uses the system TTS engine (Google TTS recommended)
};

// ── iOS audio session setup ───────────────────────────────────────────────────
// Called before every speak() call.
// playsInSilentModeIOS: true lets the app play audio even when the hardware
// silent/mute switch is on — critical for coaching audio on the range.
async function _configureAudioSession() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS:      true,
      allowsRecordingIOS:        false,
      staysActiveInBackground:   false,
      shouldDuckAndroid:         true,
    });
  } catch (err) {
    // Non-fatal — speech will still work on Android or if expo-av not available
    console.warn('Audio session config failed:', err);
  }
}

// State
let _speaking    = false;
let _onDone      = null;
let _onProgress  = null;

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Speak the full coaching script from an analysis result.
 * @param {string}   script      - The coaching_script from the API
 * @param {function} onProgress  - Called with (current, total) word count
 * @param {function} onDone      - Called when speech finishes
 */
export async function speakCoachingScript(script, onProgress, onDone) {
  if (!script) {
    onDone?.();
    return;
  }

  // Stop anything currently playing
  await stopSpeaking();

  // Configure iOS audio session so audio plays even with the silent switch on
  await _configureAudioSession();

  _speaking   = true;
  _onDone     = onDone;
  _onProgress = onProgress;

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
      console.warn('Speech error:', err);
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
  await _configureAudioSession();
  const line = scoreToLine(score, proName);
  Speech.speak(line, { ...VOICE_OPTIONS, rate: 0.92 });
}

/**
 * Speak a single drill out loud — useful when the user taps a drill card.
 * @param {object} drill  - { title, instructions, reps }
 */
export async function speakDrill(drill) {
  await stopSpeaking();
  await _configureAudioSession();
  const text = `${drill.title}. ${drill.instructions} ${drill.reps ? `Do ${drill.reps}.` : ''}`;
  Speech.speak(text, VOICE_OPTIONS);
}

/**
 * Stop any current speech immediately.
 */
export async function stopSpeaking() {
  _speaking = false;
  const isSpeaking = await Speech.isSpeakingAsync();
  if (isSpeaking) {
    await Speech.stop();
  }
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
