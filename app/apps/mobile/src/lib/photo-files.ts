// Device-local job photo files. Capture copies here; upload happens in the op handler.
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export function localPhotoDir(orgId: string, jobId: string): string {
  return `${FileSystem.documentDirectory}job-photos/${orgId}/${jobId}/`;
}

export function localPhotoPath(orgId: string, jobId: string, photoId: string, ext: string = 'jpg'): string {
  return `${localPhotoDir(orgId, jobId)}${photoId}.${ext}`;
}

export function storagePathFor(orgId: string, jobId: string, photoId: string, ext: string = 'jpg'): string {
  return `${orgId}/${jobId}/${photoId}.${ext}`;
}

export function planningStoragePathFor(orgId: string, jobId: string, photoId: string, ext: string): string {
  return `planning/${orgId}/${jobId}/${photoId}.${ext}`;
}

export async function copyToLocal(
  uri: string,
  orgId: string,
  jobId: string,
  photoId: string,
  ext: string = 'jpg'
): Promise<string> {
  if (Platform.OS === 'web') return uri;
  await FileSystem.makeDirectoryAsync(localPhotoDir(orgId, jobId), { intermediates: true });
  const to = localPhotoPath(orgId, jobId, photoId, ext);
  await FileSystem.copyAsync({ from: uri, to });
  return to;
}

export async function localPhotoExists(localUri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    return info.exists;
  } catch {
    return false;
  }
}
