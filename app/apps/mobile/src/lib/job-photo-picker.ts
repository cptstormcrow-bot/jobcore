import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { photoMetaFrom } from './photo-asset-meta';

export interface PickedJobPhoto {
  uri: string;
  mimeType: string;
  fileSize?: number;
}

// expo-image-manipulator is not a dependency, so there is no re-encode here. An image/jpeg asset is
// returned as-is; any other mime is returned with its real mimeType and the caller decides what to do.
// Returns null on cancel or denied permission.
export async function pickJobPhoto(source: 'camera' | 'library'): Promise<PickedJobPhoto | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return null;
    }
  } else if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return null;
    }
  }
  const options = { mediaTypes: ['images' as const], quality: 0.6 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset?.uri) {
    return null;
  }
  const mimeType = asset.mimeType?.trim().toLowerCase() || photoMetaFrom(asset).contentType;
  return asset.fileSize === undefined
    ? { uri: asset.uri, mimeType }
    : { uri: asset.uri, mimeType, fileSize: asset.fileSize };
}
