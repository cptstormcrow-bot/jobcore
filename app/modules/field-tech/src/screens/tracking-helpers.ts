// Pure tracking helpers for the field-tech screens.
// Mirrors runTrackingLookup / trackingStatusLine in admin-finance's JobEstimateScreen.tsx;
// module isolation forbids importing admin-finance, so the branch logic is ported here.

export interface TrackingResult {
  ok: boolean;
  status: string | null;
  delivered: boolean;
  deliveredAt?: string | null;
  error?: string;
}

export interface TrackingPatch {
  trackingNumber?: string | null;
  trackingStatus?: string | null;
  trackingCheckedAt?: string | null;
  materialsOnsite?: boolean;
}

// Maps a lookup result to the estimate patch to persist plus an optional message to show.
export function trackingResultToPatch(
  trackingNumber: string,
  result: TrackingResult | null,
  nowIso: string,
): { patch: TrackingPatch; message: string | null } {
  const number = trackingNumber.trim();
  if (!number) {
    return { patch: { trackingNumber: null, trackingStatus: null, trackingCheckedAt: null }, message: null };
  }
  // No result at all means the lookup itself failed; keep the number, show a generic message.
  if (!result) {
    return { patch: { trackingNumber: number }, message: 'UPS lookup failed.' };
  }
  if (result.error === 'ups-not-configured') {
    return { patch: { trackingNumber: number }, message: 'UPS lookup not set up yet' };
  }
  if (!result.ok && result.error && !/not.?found/i.test(result.error)) {
    return { patch: { trackingNumber: number }, message: result.error };
  }
  if (!result.ok || (!result.status && !result.delivered)) {
    return { patch: { trackingNumber: number, trackingStatus: 'Not found', trackingCheckedAt: nowIso }, message: null };
  }
  if (result.delivered) {
    return {
      patch: {
        trackingNumber: number,
        trackingStatus: 'Delivered',
        trackingCheckedAt: result.deliveredAt ?? nowIso,
        materialsOnsite: true,
      },
      message: null,
    };
  }
  return { patch: { trackingNumber: number, trackingStatus: result.status, trackingCheckedAt: nowIso }, message: null };
}

// One-line status text under the tracking field: message wins, else the stored UPS status.
export function trackingStatusLine(
  estimate: { trackingStatus: string | null; trackingCheckedAt: string | null } | null,
  message: string | null,
): string | null {
  if (message) return message;
  if (!estimate?.trackingStatus) return null;
  if (estimate.trackingStatus === 'Not found') return 'Not found at UPS';
  const when = estimate.trackingCheckedAt ? ` · checked ${new Date(estimate.trackingCheckedAt).toLocaleString()}` : '';
  return `UPS: ${estimate.trackingStatus}${when}`;
}
