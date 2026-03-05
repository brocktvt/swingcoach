import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
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
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
          <Text style={s.logo}>⛳</Text>
          <Text style={s.title}>Create your account</Text>
          <Text style={s.sub}>5 free swing analyses per month. No credit card required.</Text>

          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor={colors.grey2}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={s.input}
            placeholder="Password (min 8 characters)"
            placeholderTextColor={colors.grey2}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={s.input}
            placeholder="Confirm password"
            placeholderTextColor={colors.grey2}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />

          <TouchableOpacity style={s.btnPrimary} onPress={handleRegister} disabled={loading}>
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={s.btnPrimaryText}>Create Account — Free</Text>
            }
          </TouchableOpacity>

          <Text style={s.legal}>
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </Text>

          <TouchableOpacity style={s.link} onPress={() => navigation.replace('Login')}>
            <Text style={s.linkText}>Already have an account? <Text style={{ color: colors.tealLight }}>Sign in</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  kav:          { flex: 1 },
  inner:        { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  logo:         { fontSize: 48, textAlign: 'center', marginBottom: spacing.lg },
  title:        { fontSize: 28, fontWeight: '800', color: colors.white, textAlign: 'center' },
  sub:          { fontSize: 14, color: colors.grey2, textAlign: 'center', marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.grey3,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.white,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  btnPrimary: {
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnPrimaryText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  legal:          { color: colors.grey2, fontSize: 11, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
  link:           { marginTop: spacing.lg, alignItems: 'center' },
  linkText:       { color: colors.grey2, fontSize: 14 },
});
