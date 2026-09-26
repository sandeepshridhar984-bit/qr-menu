/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FBF6EA",
        ink: "#20261F",
        chili: "#B3402A",
        "chili-dark": "#8C2F1E",
        turmeric: "#D9A441",
        herb: "#3F6B4A",
        clay: "#8C7B63",
        "clay-light": "#E7DFCF",
        // Exact greens sampled from the client's reference video, used only
        // on the customer-facing menu/details pages so the rest of the
        // dashboard's muted "herb" green is untouched.
        sprout: "#00A05C",
        "sprout-dark": "#048F52",
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
        body: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(28px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.6s ease-out both",
        "pulse-soft": "pulse-soft 2.2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.32s ease-out both",
        "pop-in": "pop-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};
