/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./app/*.tsx",
    "./app/**/*.tsx",
    "./components/**/*.tsx",
    "./components/**/**/*.tsx",
  ],
  theme: {
    extend: {
      colors: {
        white: "#FFFFFF",
        "gray-50": "#FAFAFA",
        "gray-100": "#F5F5F5",
        "gray-150": "#EDEDED",
        "gray-200": "#CCCCCC",
        "gray-300": "#EBEBEB",
        "gray-400": "#E7E7E7",
        "gray-500": "#CFCFCF",
        "gray-600": "#C2C2C2",
        "gray-700": "#808080",
        "gray-800": "#333",
        "gray-900": "#292929",
        black: "#0F0F0F",
      },
    },
  },

  safelist: [
    { pattern: /^!?bg-.*-(100|400)$/ },
    { pattern: /^!?text-.*-(100|400)$/ },
    { pattern: /^max-w-.*$/ },
    "border-black",
  ],
  plugins: [],
};
