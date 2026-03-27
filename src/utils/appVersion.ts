declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;

export const APP_VERSION = __APP_VERSION__;
export const APP_BUILD = __APP_BUILD__;

export function appVersionLabel() {
  return `Version ${APP_VERSION} (${APP_BUILD})`;
}
