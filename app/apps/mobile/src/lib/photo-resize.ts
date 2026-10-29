import * as ImageManipulator from 'expo-image-manipulator';
import { MAX_PHOTO_EDGE, photoTargetSize } from './photo-resize-math';

const JPEG_QUALITY = 0.7;

/**
 * Downscale (long edge <= 1600, never upscale) and re-encode as JPEG ~0.7 before the photo is copied/queued.
 * Returns the new uri (shrunk:true, always JPEG), or the original uri (shrunk:false) on any failure so a photo is never lost.
 */
export async function shrinkPhoto(uri: string, width?: number, height?: number): Promise<{ uri: string; shrunk: boolean }> {
  try {
    const actions: ImageManipulator.Action[] = [];
    if (width && height) {
      const target = photoTargetSize(width, height, MAX_PHOTO_EDGE);
      if (target.resize) {
        actions.push({ resize: { width: target.width, height: target.height } });
      }
    }
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return out.uri ? { uri: out.uri, shrunk: true } : { uri, shrunk: false };
  } catch {
    return { uri, shrunk: false };
  }
}
