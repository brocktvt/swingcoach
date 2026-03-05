/**
 * api.js — SwingCoach backend communication
 *
 * All video analysis requests go through this module.
 * Set API_BASE_URL to your backend once deployed.
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Config ──────────────────────────────────────────────────────────────────
export const API_BASE_URL = __DEV__
  ? 'http://localhost:8000'          // local dev
  : 'https://api.swingcoach.app';    // production (update when deployed)

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,   // 2 min — video uploads can be slow
});

// Attach auth token to every request
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ────────────────────────────────────────────────────────────────────
export const auth = {
  async register(email, password) {
    const { data } = await client.post('/auth/register', { email, password });
    await AsyncStorage.setItem('auth_token', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  async login(email, password) {
    const { data } = await client.post('/auth/login', { email, password });
    await AsyncStorage.setItem('auth_token', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  async logout() {
    await AsyncStorage.multiRemove(['auth_token', 'user']);
  },

  async getUser() {
    const raw = await AsyncStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },
};

// ── Swing Analysis ───────────────────────────────────────────────────────────
export const analysis = {
  /**
   * Upload a swing video and receive AI analysis.
   * @param {string} videoUri       - local file:// URI from camera/picker
   * @param {string} clubType       - 'driver'|'iron'|'wedge'|'putter'
   * @param {string} proReference   - pro swing ID to compare against
   * @param {function} onProgress   - (0-100) upload progress callback
   * @returns {object} analysis result
   */
  async analyzeSwing(videoUri, clubType, proReference, onProgress) {
    const formData = new FormData();
    formData.append('video', {
      uri: videoUri,
      name: 'swing.mp4',
      type: 'video/mp4',
    });
    formData.append('club_type', clubType);
    formData.append('pro_reference', proReference);

    const { data } = await client.post('/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });
    return data;
  },

  /**
   * Fetch a user's past analyses.
   */
  async getHistory(limit = 20) {
    const { data } = await client.get('/analyses', { params: { limit } });
    return data;
  },

  /**
   * Fetch a single analysis result by ID.
   */
  async getById(id) {
    const { data } = await client.get(`/analyses/${id}`);
    return data;
  },
};

// ── Subscription ─────────────────────────────────────────────────────────────
export const subscription = {
  /**
   * Verify a purchase receipt with the backend after RevenueCat confirms.
   */
  async verify(purchaseToken, platform) {
    const { data } = await client.post('/subscription/verify', {
      purchase_token: purchaseToken,
      platform,
    });
    return data;
  },

  /**
   * Get current subscription status for the logged-in user.
   */
  async getStatus() {
    const { data } = await client.get('/subscription/status');
    return data;
  },
};

// ── Pro Reference Library ────────────────────────────────────────────────────
export const pros = {
  /**
   * Get list of available pro swings to compare against.
   */
  async list(clubType) {
    const { data } = await client.get('/pros', { params: { club_type: clubType } });
    return data;
  },
};
