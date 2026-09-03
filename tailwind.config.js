/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        'flash-red': {
          '0%, 100%': { backgroundColor: '#b91c1c' },
          '50%': { backgroundColor: '#ef4444' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0.92)' },
          '60%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'check-draw': {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'hl-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'hl-pulse': {
          '0%, 100%': { transform: 'scaleX(1)', opacity: '0.5' },
          '50%': { transform: 'scaleX(0.6)', opacity: '0.2' },
        },
      },
      animation: {
        marquee: 'marquee 22s linear infinite',
        'flash-red': 'flash-red 1s ease-in-out infinite',
        'fade-up': 'fade-up 0.4s ease-out both',
        pop: 'pop 0.2s ease-out',
        'pulse-ring': 'pulse-ring 1.2s cubic-bezier(0.4,0,0.2,1) infinite',
        float: 'float 3s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'check-draw': 'check-draw 0.35s ease-out forwards',
        'spin-slow': 'spin-slow 1s linear infinite',
        'hl-bounce': 'hl-bounce 1.6s ease-in-out infinite',
        'hl-pulse': 'hl-pulse 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
