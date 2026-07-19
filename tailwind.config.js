/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        glass: {
          default: 'rgba(255,255,255,0.06)',
          elevated: 'rgba(255,255,255,0.10)',
          subtle: 'rgba(255,255,255,0.03)',
          'light-default': 'rgba(255,255,255,0.45)',
          'light-elevated': 'rgba(255,255,255,0.60)',
          'light-subtle': 'rgba(255,255,255,0.30)',
        },
        ink: '#0A1120',
        surface: '#111827',
        surface2: '#1F2937',
        mint: '#34D399',
        gold: '#FBBF24',
        coral: '#F87171',
        violet: '#A78BFA',
        blue: '#60A5FA',
      },
      backdropBlur: {
        glass: '24px',
        'glass-lg': '32px',
        'glass-sm': '16px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.12)',
        'glass-lg': '0 12px 48px rgba(0,0,0,0.18)',
        'glass-inset': 'inset 0 1px 0 rgba(255,255,255,0.06)',
        glow: {
          mint: '0 0 20px rgba(52,211,153,0.25)',
          gold: '0 0 20px rgba(251,191,36,0.25)',
          coral: '0 0 20px rgba(248,113,113,0.25)',
          violet: '0 0 20px rgba(167,139,250,0.25)',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'blob-drift-1': 'blobDrift1 25s ease-in-out infinite',
        'blob-drift-2': 'blobDrift2 20s ease-in-out infinite',
        'blob-drift-3': 'blobDrift3 30s ease-in-out infinite',
        'blob-drift-4': 'blobDrift4 22s ease-in-out infinite',
        'blob-drift-5': 'blobDrift5 28s ease-in-out infinite',
        'fade-up': 'smFadeUp .45s cubic-bezier(.16,1,.3,1) both',
        'fade-in': 'smFadeIn .3s ease both',
        pulse: 'smPulse 1.8s ease-in-out infinite',
        shimmer: 'smShimmer 1.4s linear infinite',
        'scale-in': 'smFadeUp .5s cubic-bezier(.16,1,.3,1) both',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        blobDrift1: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
        },
        blobDrift2: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(-40px, 30px) scale(1.05)' },
          '66%': { transform: 'translate(25px, -35px) scale(0.95)' },
        },
        blobDrift3: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(20px, 40px) scale(1.15)' },
          '66%': { transform: 'translate(-35px, -25px) scale(0.85)' },
        },
        blobDrift4: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(-25px, -30px) scale(1.08)' },
          '66%': { transform: 'translate(40px, 15px) scale(0.92)' },
        },
        blobDrift5: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(35px, 25px) scale(0.95)' },
          '66%': { transform: 'translate(-15px, -40px) scale(1.1)' },
        },
        smFadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        smFadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        smPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.55' },
        },
        smShimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
