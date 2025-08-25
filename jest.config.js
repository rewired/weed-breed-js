/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testEnvironment: 'node',
  transform: {}, // Needed for ES Modules
  moduleFileExtensions: ['js', 'mjs', 'json', 'node'],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.test.mjs'
  ],
  "transformIgnorePatterns": [
    "/node_modules/"
  ],
};

export default config;
