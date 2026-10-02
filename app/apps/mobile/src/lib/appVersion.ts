import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { AppVersionInfo } from '@jobcore/ui';

export function getAppVersion(): AppVersionInfo {
  const cfg = Constants.expoConfig;
  const raw = Platform.OS === 'android' ? cfg?.android?.versionCode : cfg?.ios?.buildNumber;
  return {
    version: cfg?.version ?? 'unknown',
    build: raw != null ? String(raw) : null,
  };
}
