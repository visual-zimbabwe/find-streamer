// Flat ESLint config (ESLint 10 dropped legacy .eslintrc support).
// Lenient by design: every rule is downgraded to "warn" so lint never blocks.
const expoFlat = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

// Walk a flat-config block and rewrite every rule severity to "warn".
function downgradeToWarn(block) {
  if (!block || !block.rules) return block;
  const rules = {};
  for (const [name, value] of Object.entries(block.rules)) {
    if (Array.isArray(value)) {
      const [severity, ...rest] = value;
      const normalized = severity === 'off' || severity === 0 ? severity : 'warn';
      rules[name] = [normalized, ...rest];
    } else {
      rules[name] = value === 'off' || value === 0 ? value : 'warn';
    }
  }
  return { ...block, rules };
}

module.exports = [
  ...expoFlat.map(downgradeToWarn),
  prettier,
  {
    files: ['tests/**/*.js', '*.config.js', 'scratch/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'dist/**',
      'web-build/**',
      '.expo/**',
      '.expo-export-check/**',
      'scratch/**',
    ],
  },
];
