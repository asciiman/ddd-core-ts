/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  roots: ['<rootDir>'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  passWithNoTests: true,
  testPathIgnorePatterns: ['node_modules', 'dist'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['node_modules', 'interfaces', '.mock.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageDirectory: '<rootDir>/coverage/',
  testEnvironment: 'node',
  resetMocks: true,
  maxWorkers: '50%',
};
