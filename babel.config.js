module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Reanimated 4 worklets are transformed by `react-native-worklets/plugin`,
    // which the `nativewind/babel` preset (css-interop) already injects exactly
    // once — adding it here too would duplicate the plugin. Keep this empty.
    plugins: [],
  };
};
