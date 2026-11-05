import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

// A payment QR image from the photo library, untouched: no resize or re-encode (that spoils scanning).
// Returns null on cancel or denied permission.
export async function pickBarcodeImage(): Promise<{ uri: string; mimeType: string } | null> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset?.uri) return null;
  const mime = asset.mimeType?.trim().toLowerCase();
  return { uri: asset.uri, mimeType: mime && mime.startsWith('image/') ? mime : 'image/jpeg' };
}
