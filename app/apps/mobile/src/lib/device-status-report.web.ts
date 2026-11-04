// Web has no offline queue, so there is nothing to report to the Tech sync monitor (#0101).
export async function reportDeviceStatus(_isOnline: boolean, _force = false): Promise<void> {
  return;
}
