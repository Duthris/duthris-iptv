// Paket "type": "module" olduğu için config .cjs uzantısıyla duruyor.
module.exports = {
  ...require("@iptv/config/eslint/library.js"),
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
};
