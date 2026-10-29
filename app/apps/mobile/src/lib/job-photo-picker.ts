import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { photoMetaFrom } from './photo-asset-meta';
import { shrinkPhoto } from './photo-resize';

export interface PickedJobPhoto {
  uri: string;
  mimeType: string;
  fileSize?: number;
}

// The picked image is downscaled (long edge <= 1600) and re-encoded as JPEG via shrinkPhoto; if that fails the
// original asset is returned with its real mimeType.
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
  const small = await shrinkPhoto(asset.uri, asset.width, asset.height);
  if (small.shrunk) {
    return { uri: small.uri, mimeType: 'image/jpeg' };
  }
  const mimeType = asset.mimeType?.trim().toLowerCase() || photoMetaFrom(asset).contentType;
  return asset.fileSize === undefined
    ? { uri: asset.uri, mimeType }
    : { uri: asset.uri, mimeType, fileSize: asset.fileSize };
}
