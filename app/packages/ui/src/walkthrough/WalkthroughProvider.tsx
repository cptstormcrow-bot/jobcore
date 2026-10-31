import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { WALKTHROUGH_STEPS, WalkthroughStep, WalkthroughStepId } from './walkthrough-content';
import { HELP_CARDS } from './help-content';
import { setBoolPref } from '../lib/local-prefs';

const WALKTHROUGH_COMPLETED_KEY = 'walkthrough_v1_completed';

export interface WalkthroughContextValue {
  isOpen: boolean;
  currentStep: WalkthroughStep | null;
  currentIndex: number;
  open: () => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  finish: () => void;
  jumpTo: (stepId: WalkthroughStepId) => void;
  standaloneStep: WalkthroughStep | null;
  showHelp: (stepId: string) => void;
  dismissHelp: () => void;
}

const WalkthroughContext = createContext<WalkthroughContextValue | undefined>(undefined);

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [standaloneStep, setStandaloneStep] = useState<WalkthroughStep | null>(null);

  // No auto-open at launch: the tour opens only from Options > Help (Jeff 2026-10-30).

  const open = useCallback(() => {
    setCurrentIndex(0);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, WALKTHROUGH_STEPS.length - 1));
  }, []);

  const prev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const skip = useCallback(() => {
    setIsOpen(false);
    Promise.resolve(setBoolPref(WALKTHROUGH_COMPLETED_KEY, true));
  }, []);

  const finish = useCallback(() => {
    setIsOpen(false);
    Promise.resolve(setBoolPref(WALKTHROUGH_COMPLETED_KEY, true));
  }, []);

  const jumpTo = useCallback((stepId: WalkthroughStepId) => {
    const idx = WALKTHROUGH_STEPS.findIndex((step) => step.id === stepId);
    if (idx === -1) return;
    setCurrentIndex(idx);
  }, []);

  const showHelp = useCallback((stepId: string) => {
    const step = [...WALKTHROUGH_STEPS, ...HELP_CARDS].find((step) => step.id === stepId);
    if (!step) return;
    setStandaloneStep(step);
  }, []);

  const dismissHelp = useCallback(() => {
    setStandaloneStep(null);
  }, []);

  const currentStep = isOpen ? WALKTHROUGH_STEPS[currentIndex] ?? null : null;

  const value = useMemo<WalkthroughContextValue>(
    () => ({
      isOpen,
      currentStep,
      currentIndex,
      open,
      close,
      next,
      prev,
      skip,
      finish,
      jumpTo,
      standaloneStep,
      showHelp,
      dismissHelp,
    }),
    [
      isOpen,
      currentStep,
      currentIndex,
      open,
      close,
      next,
      prev,
      skip,
      finish,
      jumpTo,
      standaloneStep,
      showHelp,
      dismissHelp,
    ]
  );

  return <WalkthroughContext.Provider value={value}>{children}</WalkthroughContext.Provider>;
}

export function useWalkthrough(): WalkthroughContextValue {
  const context = useContext(WalkthroughContext);
  if (context === undefined) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider');
  }
  return context;
}
