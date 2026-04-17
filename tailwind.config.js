/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        flow: {
          bg: '#0A0A0A',
          'bg-secondary': '#111111',
          card: '#161616',
          elevated: '#1C1C1C',
          border: '#2A2A2A',
          cyan: '#00F5FF',
          green: '#00D46A',
          orange: '#FF6B35',
          red: '#FF3B3B',
          muted: '#888888',
          'very-muted': '#444444',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 245, 255, 0.15)',
        'glow-green': '0 0 20px rgba(0, 212, 106, 0.15)',
        'glow-red': '0 0 20px rgba(255, 59, 59, 0.15)',
        'glow-orange': '0 0 20px rgba(255, 107, 53, 0.15)',
      },
    },
  },
  plugins: [],
}
