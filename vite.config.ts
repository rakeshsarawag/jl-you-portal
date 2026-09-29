import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const isTest = mode === 'test';
  return {
    plugins: isTest
      ? [react()]
      : [
          figmaAssetResolver(),
          // The React and Tailwind plugins are both required for Make, even if
          // Tailwind is not being actively used – do not remove them
          react(),
          tailwindcss(),
        ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
      // Ensure only one copy of React is bundled regardless of how dependencies import it
      dedupe: ['react', 'react-dom'],
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: isTest ? [] : ['**/*.svg', '**/*.csv'],

    optimizeDeps: {
      // List all React-consuming packages upfront so Vite bundles them in a
      // single optimization pass and never creates multiple React singletons.
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-router',
        'motion/react',
        'recharts',
        'lucide-react',
        'sonner',
        'next-themes',
      ],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Heavy chart library — only needed in analytics / payroll views
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
              return 'vendor-charts';
            }
            // Animation library — only needed in pages that use motion components
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
              return 'vendor-motion';
            }
            // Core React runtime — always needed, keep in its own chunk
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router')
            ) {
              return 'vendor-react';
            }
            // UI utilities shared across many pages
            if (
              id.includes('node_modules/lucide-react') ||
              id.includes('node_modules/sonner') ||
              id.includes('node_modules/next-themes') ||
              id.includes('node_modules/@radix-ui')
            ) {
              return 'vendor-ui';
            }
          },
        },
      },
    },
  };
})
