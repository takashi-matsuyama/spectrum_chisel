import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

// Flat config. The p5/DOM "shell" runs p5 in global mode, so its bare calls
// (createCanvas, color, map, ...) are globals attached to window by p5.
// Detecting undefined p5 names is delegated to the type checker via
// @types/p5's global declarations (tsconfig "types": ["p5/global"]); ESLint
// here focuses on style and quality, so no-undef is relaxed for shell files.
export default [
  { ignores: ['dist/**', 'node_modules/**', 'assets/**', '.vite/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    // p5 global-mode shell: relies on globals provided by p5 at runtime.
    files: ['src/main.js', 'src/audio.js', 'src/ui.js', 'src/composer.js', 'src/export.js', 'src/playback.js', 'src/recording.js', 'src/view.js', 'src/drawing/**/*.js'],
    languageOptions: {
      globals: {
        p5: 'readonly',
        SVG: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  prettier,
];
