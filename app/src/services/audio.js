/**
 * services/audio.js -- SwingCoach audio coaching
 *
 * Delivers the AI coaching script as spoken audio using the device's
 * built-in text-to-speech. Works through the phone speaker, earbuds,
 * AirPods, or any connected Bluetooth audio automatically.
 *
 * iOS audio fix:
 *   AVSpeechSynthesizer does NOT inherit the expo-av audio session by default.
 *   Playing a tiny silent WAV through Audio.Sound first forces the iOS
 *   .playback session to activate, after which Speech.speak() respects the
 *   session and plays through the speaker even when silent mode is on.
 */
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

// Voice settings -- rate 0.88 feels natural and easy to follow on the range.
const VOICE_OPTIONS = {
  rate:   0.88,
  pitch:  1.0,
  volume: 1.0,
};

// Preferred male voices in priority order.
// iOS ships many voices; we pick the first one that's installed on the device.
// Aaron / Evan / Rishi / Nathan are all natural-sounding US/UK male voices.
// Alex is the classic fallback that ships on every iOS device.
const PREFERRED_MALE_VOICES = [
  'com.apple.voice.compact.en-US.Aaron',        // natural US male (iOS 16+)
  'com.apple.voice.compact.en-US.Evan',         // slightly deeper US male
  'com.apple.voice.compact.en-US.Rishi',        // warmer US male
  'com.apple.voice.enhanced.en-US.Evan',        // enhanced quality version
  'com.apple.voice.enhanced.en-US.Aaron',
  'com.apple.ttsbundle.Alex-compact',           // classic iOS US male (always present)
  'com.apple.voice.compact.en-GB.Daniel',       // UK male
  'com.apple.ttsbundle.Daniel-compact',
];

let _selectedVoice = undefined;   // undefined = not yet resolved; null = no match found

async function _getVoice() {
  if (_selectedVoice !== undefined) return _selectedVoice;
  try {
    const available = await Speech.getAvailableVoicesAsync();
    const ids = new Set(available.map(v => v.identifier));
    for (const id of PREFERRED_MALE_VOICES) {
      if (ids.has(id)) {
        _selectedVoice = id;
        console.log('[SwingCoach] Selected voice:', id);
        return id;
      }
    }
    // Fallback: any enhanced English voice
    const fallback = available.find(v => v.language?.startsWith('en') && v.quality === 'Enhanced');
    _selectedVoice = fallback?.identifier ?? null;
    return _selectedVoice;
  } catch {
    _selectedVoice = null;
    return null;
  }
}

// Warm up voice selection on module load
_getVoice();

// Silent WAV primer
// 2444-byte WAV: 44-byte RIFF/PCM header + 2400 bytes of 16-bit silence.
// Generated with Python struct.pack -- verified correct RIFF chunk sizes.
// Playing this through Audio.Sound forces iOS to activate the .playback
// audio session so Speech.speak() inherits it and plays out loud.
const SILENT_WAV_URI = 'data:audio/wav;base64,' +
  'UklGRoQJAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YWAJAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';


// iOS audio session setup
// playsInSilentModeIOS overrides the hardware mute switch.
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
 * Play the silent WAV to force iOS to activate the .playback audio session
 * before Speech.speak() is called. This is the key fix for iOS silent mode.
 */
async function _primeiOSAudio() {
  try {
    await _ensureAudioSession();
    const { sound } = await Audio.Sound.createAsync(
      { uri: SILENT_WAV_URI },
      { shouldPlay: true, volume: 0 },
    );
    // Give iOS ~150ms to register the playback session, then release
    await new Promise((r) => setTimeout(r, 150));
    await sound.stopAsync();
    await sound.unloadAsync();
  } catch (err) {
    // Non-fatal -- speech may still work without the primer
    console.warn('[SwingCoach] Silent primer failed:', err?.message ?? err);
  }
}

// Pre-warm on module load
_ensureAudioSession();

// State
let _speaking = false;


// Core functions

/**
 * Speak the full coaching script from an analysis result.
 */
export async function speakCoachingScript(script, onProgress, onDone) {
  if (!script) {
    onDone?.();
    return;
  }

  await stopSpeaking();
  await _primeiOSAudio();

  _speaking = true;
  const voice = await _getVoice();

  Speech.speak(script, {
    ...VOICE_OPTIONS,
    ...(voice ? { voice } : {}),
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
 * Speak a short summary line.
 */
export async function speakQuickSummary(score, proName) {
  await stopSpeaking();
  await _primeiOSAudio();
  const voice = await _getVoice();
  const line = scoreToLine(score, proName);
  Speech.speak(line, { ...VOICE_OPTIONS, rate: 0.92, ...(voice ? { voice } : {}) });
}

/**
 * Speak a single drill out loud.
 */
export async function speakDrill(drill) {
  await stopSpeaking();
  await _primeiOSAudio();
  const voice = await _getVoice();
  const text = `${drill.title}. ${drill.instructions} ${drill.reps ? `Do ${drill.reps}.` : ''}`;
  Speech.speak(text, { ...VOICE_OPTIONS, ...(voice ? { voice } : {}) });
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
 */
export async function isSupported() {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.length > 0;
  } catch {
    return true;
  }
}


// Helpers

function scoreToLine(score, proName) {
  if (score >= 85) return `Great swing. You scored ${score} out of 100 compared to ${proName}. You're building some serious consistency.`;
  if (score >= 70) return `Solid work. You scored ${score} out of 100 against ${proName}. There are a few things we can sharpen up -- let's go through them.`;
  if (score >= 55) return `You scored ${score} out of 100 compared to ${proName}. Good fundamentals to build on. Here's what we're working on today.`;
  return `You scored ${score} out of 100 against ${proName}. Everyone starts somewhere -- let's get to work on a couple of things that'll make a big difference right away.`;
}

/**
 * Build a coaching script client-side as a fallback if the API
 * didn't return one (e.g. older cached results).
 */
export function buildFallbackScript(data) {
  const parts = [];

  parts.push(scoreToLine(data.overall_score, data.pro_name));

  if (data.positives?.length > 0) {
    const p = data.positives[0];
    parts.push(`Here's what you're doing well. ${p.title}. ${p.description}`);
  }

  const highIssues = (data.issues || []).filter(i => i.severity === 'high');
  const topIssue   = highIssues[0] || data.issues?.[0];
  if (topIssue) {
    parts.push(`The main thing to work on is this. ${topIssue.title}. ${topIssue.description}`);
  }

  if (data.issues?.length > 1) {
    const second = data.issues[1];
    parts.push(`Also worth noting -- ${second.title}. ${second.description}`);
  }

  const topDrill = data.drills?.[0];
  if (topDrill) {
    parts.push(`Here's the drill I want you to focus on. ${topDrill.title}. ${topDrill.instructions} Try ${topDrill.reps || 'a few sets'} of this before your next round.`);
  }

  parts.push(`Keep at it. Every swing you analyze gets you closer to where you want to be.`);

  return parts.join(' ... ');
}
