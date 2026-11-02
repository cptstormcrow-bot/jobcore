/**
 * Picks the one active card processor.
 *
 * Set EXPO_PUBLIC_CARD_PROCESSOR in apps/mobile/.env to none | stripe | square | helcim
 * and restart the bundler. Unknown or missing values fall back to `none`.
 */

import {
  HelcimCardProcessor,
  ManualCardProcessor,
  SquareCardProcessor,
  StripeCardProcessor,
} from './adapters';
import type { CardProcessor, CardProcessorId } from './types';

export const CARD_PROCESSORS: Record<CardProcessorId, CardProcessor> = {
  none: ManualCardProcessor,
  stripe: StripeCardProcessor,
  square: SquareCardProcessor,
  helcim: HelcimCardProcessor,
};

export function getCardProcessor(id: string | undefined = process.env.EXPO_PUBLIC_CARD_PROCESSOR): CardProcessor {
  return CARD_PROCESSORS[(id ?? 'none') as CardProcessorId] ?? ManualCardProcessor;
}

export * from './types';
