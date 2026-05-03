/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#030712',
          800: '#111827',
          700: '#1f2937'
        },
        neon: {
          cyan: '#06b6d4',
          blue: '#3b82f6',
          violet: '#8b5cf6',
          red: '#ef4444'
        }
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'spin-reverse-slow': 'spin-reverse 10s linear infinite',
        'pulse-glow': 'pulse-glow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 2s linear infinite',
        'fade-in': 'fade-in 0.8s ease-out forwards',
        'blink-eye': 'blink-eye 7s infinite',
        'float-hud': 'float-hud 4s ease-in-out infinite'
      },
      keyframes: {
        'spin-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' }
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 0.8, filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.5))' },
          '50%': { opacity: 1, filter: 'drop-shadow(0 0 25px rgba(6, 182, 212, 0.8))' }
        },
        'scanline': {
          '0%': { top: '0%' },
          '100%': { top: '100%' }
        },
        'fade-in': {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        },
        'blink-eye': {
          '0%, 94%, 98%, 100%': { transform: 'scaleY(1)' },
          '96%': { transform: 'scaleY(0.1)' }
        },
        'float-hud': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        }
      }
    },
  },
  plugins: [],
}
