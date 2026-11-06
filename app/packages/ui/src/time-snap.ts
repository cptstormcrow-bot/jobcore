/** Pure start-time snapping for TimePicker (kept apart from React Native so plain-node tests can import it). */

export interface TimeParts {
  hour: number;
  minute: string;
  meridiem: string;
}

/** Start times run 7:00 AM to 6:00 PM (Jeff 2026-11-06). */
export const HOURS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

/** AM can only be 7 to 11; PM can only be 12 and 1 to 6. */
export function meridiemFor(hour: number): string {
  return hour >= 7 && hour <= 11 ? 'AM' : 'PM';
}

/**
 * Snap a picked time into the 7:00 AM to 6:00 PM window.
 * An hour tap drives AM/PM (Jeff 2026-11-06: "let the AM and PM follow picking the time"), so 12 and 1 to 6 land
 * on PM and 7 to 11 land on AM. An AM/PM tap drives the hour: AM keeps an AM hour, else lands on 11; PM lands on 12.
 */
export function snapTime(p: TimeParts, hourTapped = false): TimeParts {
  let { hour, meridiem } = p;
  if (!HOURS.includes(hour)) hour = meridiem === 'AM' ? 7 : 12;
  if (hourTapped) meridiem = meridiemFor(hour);
  if (meridiemFor(hour) !== meridiem) {
    if (meridiem === 'AM') hour = 11;
    else if (meridiem === 'PM') hour = hour >= 7 && hour <= 11 ? 12 : hour;
  }
  const minute = hour === 6 && meridiemFor(hour) === 'PM' ? '00' : p.minute;
  return { hour, minute, meridiem: meridiemFor(hour) };
}
