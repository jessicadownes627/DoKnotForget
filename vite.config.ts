import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function readPackageVersion() {
  const packageJsonPath = resolve(__dirname, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  return packageJson.version?.trim() || "0.0.0";
}

function readIosBuildInfo() {
  const projectPath = resolve(__dirname, "ios/App/App.xcodeproj/project.pbxproj");
  const projectFile = readFileSync(projectPath, "utf8");
  const marketingVersionMatch = projectFile.match(/MARKETING_VERSION = ([^;]+);/);
  const buildVersionMatch = projectFile.match(/CURRENT_PROJECT_VERSION = ([^;]+);/);

  return {
    version: marketingVersionMatch?.[1]?.trim() || readPackageVersion(),
    build: buildVersionMatch?.[1]?.trim() || "1",
  };
}

const iosBuildInfo = readIosBuildInfo();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(iosBuildInfo.version),
    __APP_BUILD__: JSON.stringify(iosBuildInfo.build),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
