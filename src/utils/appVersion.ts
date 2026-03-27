import { App } from "@capacitor/app";

export async function getAppVersion() {
  const info = await App.getInfo();
  return {
    version: info.version,
    build: info.build,
  };
}
