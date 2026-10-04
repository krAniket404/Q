module.exports = {
  preset: '@react-native/jest-preset',
  // Reanimated / Worklets / Gesture Handler / SVG ship untranspiled TypeScript sources.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-reanimated|react-native-worklets|react-native-gesture-handler|react-native-svg)/)',
  ],
};
