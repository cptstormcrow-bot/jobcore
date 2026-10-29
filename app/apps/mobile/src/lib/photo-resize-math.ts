export const MAX_PHOTO_EDGE = 1600;

export interface PhotoTargetSize {
  width: number;
  height: number;
  resize: boolean;
}

/** Target dimensions so the long edge is at most `maxEdge`; never upscales. Invalid dims => resize:false. */
export function photoTargetSize(width: number, height: number, maxEdge: number = MAX_PHOTO_EDGE): PhotoTargetSize {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width, height, resize: false };
  }
  const long = Math.max(width, height);
  if (long <= maxEdge) {
    return { width, height, resize: false };
  }
  const scale = maxEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resize: true,
  };
}
