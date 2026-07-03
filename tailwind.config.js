/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 16px 36px rgba(22, 79, 70, 0.10)"
      },
      fontFamily: {
        sans: [
          "Inter",
          "HarmonyOS Sans SC",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};
