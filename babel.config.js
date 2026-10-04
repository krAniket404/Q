module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Must stay last: Reanimated 4 runs its worklet transform through this plugin.
  plugins: ['react-native-worklets/plugin'],
};
