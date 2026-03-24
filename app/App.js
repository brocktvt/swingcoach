import React from 'react';
import { View, Text } from 'react-native';

// DIAGNOSTIC BUILD — stripping all imports to isolate crash source
export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#080e18', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>
        ⛳ Pocket Golf Coach
      </Text>
      <Text style={{ color: '#4ecdc4', fontSize: 14, marginTop: 8 }}>
        Diagnostic build — JS is alive!
      </Text>
    </View>
  );
}
