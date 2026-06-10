import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  projects: [
    {
      displayName: "node",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/src/lib/**/*.test.ts",
        "<rootDir>/src/app/api/**/*.test.ts",
      ],
      transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest", {}],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
    {
      displayName: "jsdom",
      testEnvironment: "jsdom",
      testMatch: [
        "<rootDir>/src/components/**/*.test.tsx",
        "<rootDir>/src/hooks/**/*.test.ts",
        "<rootDir>/src/hooks/**/*.test.tsx",
      ],
      transform: {
        "^.+\\.(t|j)sx?$": [
          "@swc/jest",
          {
            jsc: {
              transform: {
                react: { runtime: "automatic" },
              },
            },
          },
        ],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^@xyflow/react$": "<rootDir>/src/__mocks__/@xyflow/react.tsx",
      },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
  ],
};

export default createJestConfig(config);
