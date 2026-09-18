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
  };
})
