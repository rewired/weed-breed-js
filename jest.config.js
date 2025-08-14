/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testEnvironment: 'node',
  transform: {}, // Needed for ES Modules
  moduleFileExtensions: ['js', 'json', 'node'],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  "transformIgnorePatterns": [
    "/node_modules/"
  ],
};

export default config;
