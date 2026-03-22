/**
 * useAuth.js — convenience hook that reads from AuthContext
 *
 * All screens continue to call useAuth() as before — they now
 * share the single AuthContext state instead of isolated local state.
 */
import { useAuthContext } from '../context/AuthContext';

export function useAuth() {
  return useAuthContext();
}
