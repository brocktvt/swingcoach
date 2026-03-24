/**
 * navigation/index.js — SwingCoach app navigation
 *
 * Structure:
 *   Root Stack
 *   ├── AuthStack  (Login / Register / Onboarding)  — shown when logged out
 *   └── MainTabs   (Home / Analyze / History / Profile)  — shown when logged in
 *       └── AnalyzeStack (Camera → Processing → Results)
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

import { colors } from '../theme';
import { useAuth } from '../hooks/useAuth';

// Screens
import OnboardingScreen  from '../screens/OnboardingScreen';
import LoginScreen       from '../screens/LoginScreen';
import RegisterScreen    from '../screens/RegisterScreen';
import HomeScreen        from '../screens/HomeScreen';
import CameraScreen      from '../screens/CameraScreen';
import ProcessingScreen  from '../screens/ProcessingScreen';
// ResultsScreen temporarily stubbed out to isolate crash source
function ResultsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#080e18', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#4ecdc4', fontSize: 16 }}>Results coming soon</Text>
    </View>
  );
}
// import ResultsScreen from '../screens/ResultsScreen';
import HistoryScreen     from '../screens/HistoryScreen';
import ProfileScreen     from '../screens/ProfileScreen';
import PaywallScreen     from '../screens/PaywallScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Tab icon component (text-based until we add icon lib) ────────────────────
function TabIcon({ label, focused }) {
  const icons = { Home: '⛳', Analyze: '🎥', History: '📋', Profile: '👤' };
  return (
    <View style={{ alignItems: 'center', width: 60 }}>
      <Text style={{ fontSize: 18 }}>{icons[label] || '●'}</Text>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 10,
          color: focused ? colors.tealLight : colors.grey2,
          marginTop: 2,
        }}
      >{label}</Text>
    </View>
  );
}

// ── Analyze stack (camera → processing → results) ───────────────────────────
function AnalyzeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Camera"     component={CameraScreen} />
      <Stack.Screen name="Processing" component={ProcessingScreen} />
      <Stack.Screen name="Results"    component={ResultsScreen} />
    </Stack.Navigator>
  );
}

// ── Main tab navigator ───────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgAlt,
          borderTopColor: colors.grey3,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} /> }}
      />
      <Tab.Screen
        name="Analyze"
        component={AnalyzeStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Analyze" focused={focused} /> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="History" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

// ── Auth stack ───────────────────────────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login"      component={LoginScreen} />
      <Stack.Screen name="Register"   component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// ── Root navigator ───────────────────────────────────────────────────────────
export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null; // splash screen handles this

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main"    component={MainTabs} />
            <Stack.Screen name="Paywall" component={PaywallScreen}
              options={{ presentation: 'modal' }} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
