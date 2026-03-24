import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: {
          DEFAULT: "#F5F0E8",
          dark: "#EDE7D4",
        },
        accent: {
          DEFAULT: "#C41E3A",
          dark: "#8B1428",
          light: "#E8426A",
        },
        choice: {
          bg: "#1A1A2E",
          text: "#F5F0E8",
          hover: "#2D2D4E",
        },
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        body: ["Lora", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
}

export default config
