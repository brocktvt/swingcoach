import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import { useAuth } from '../hooks/useAuth';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // navigation handled automatically by useAuth state change
    } catch (err) {
      Alert.alert('Login failed', err?.response?.data?.detail || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <View style={s.inner}>
          <Text style={s.logo}>⛳</Text>
          <Text style={s.title}>Welcome back</Text>
          <Text style={s.sub}>Sign in to SwingCoach</Text>

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
            placeholder="Password"
            placeholderTextColor={colors.grey2}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={s.btnPrimary} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={s.btnPrimaryText}>Sign In</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.link} onPress={() => navigation.replace('Register')}>
            <Text style={s.linkText}>Don't have an account? <Text style={{ color: colors.tealLight }}>Sign up free</Text></Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  kav:          { flex: 1 },
  inner:        { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
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
  link:           { marginTop: spacing.lg, alignItems: 'center' },
  linkText:       { color: colors.grey2, fontSize: 14 },
});
