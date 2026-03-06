import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';
import { useAuth } from '../hooks/useAuth';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert('Registration failed', err?.response?.data?.detail || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <ScrollView
          contentContainerStyle={s.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ── */}
          <View style={s.header}>
            <Text style={s.wordmark}>⛳ SWINGCOACH</Text>
            <Text style={s.title}>Create your account</Text>
            <View style={s.pillRow}>
              <View style={s.pill}><Text style={s.pillText}>✓ 5 free analyses/mo</Text></View>
              <View style={s.pill}><Text style={s.pillText}>✓ No credit card</Text></View>
            </View>
          </View>

          {/* ── Form ── */}
          <View style={s.form}>
            <View style={s.inputWrap}>
              <Text style={s.label}>EMAIL</Text>
              <TextInput
                style={s.input}
                placeholder="you@email.com"
                placeholderTextColor={colors.grey2}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={s.inputWrap}>
              <Text style={s.label}>PASSWORD</Text>
              <TextInput
                style={s.input}
                placeholder="Min 8 characters"
                placeholderTextColor={colors.grey2}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View style={s.inputWrap}>
              <Text style={s.label}>CONFIRM PASSWORD</Text>
              <TextInput
                style={s.input}
                placeholder="••••••••"
                placeholderTextColor={colors.grey2}
                secureTextEntry
                value={confirm}
                onChangeText={setConfirm}
              />
            </View>

            <TouchableOpacity
              style={[s.btnPrimary, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={s.btnPrimaryText}>Create Account — Free</Text>
              }
            </TouchableOpacity>

            <Text style={s.legal}>
              By signing up you agree to our Terms of Service and Privacy Policy.
            </Text>
          </View>

          {/* ── Footer link ── */}
          <TouchableOpacity style={s.footerLink} onPress={() => navigation.replace('Login')}>
            <Text style={s.footerText}>
              Already have an account?{' '}
              <Text style={s.footerAccent}>Sign in</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
  kav:   { flex: 1 },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.xl,
  },

  // ── Header ──
  header: { alignItems: 'center', gap: spacing.sm },
  wordmark: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: colors.tealLight,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    backgroundColor: colors.tealDim,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  pillText: {
    color: colors.tealLight,
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Form ──
  form: { gap: spacing.md },
  inputWrap: { gap: 6 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.grey2,
    paddingLeft: 2,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.grey3,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    color: colors.white,
    fontSize: 15,
  },
  btnPrimary: {
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  btnPrimaryText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  legal: {
    color: colors.grey2,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: spacing.md,
  },

  // ── Footer ──
  footerLink: { alignItems: 'center' },
  footerText: { color: colors.grey2, fontSize: 14 },
  footerAccent: { color: colors.tealLight, fontWeight: '700' },
});
