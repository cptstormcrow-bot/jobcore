declare const ErrorUtils: {
  getGlobalHandler: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

/**
 * Installs a global JS error handler that logs the error and re-throws to the
 * previous handler (if one existed) so React Native's default dev red-box and
 * native crash behavior are preserved. The error is never swallowed.
 */
export function installGlobalErrorHandler(): void {
  const previousHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    console.error('[JOBCORE] Global JS error caught', { error, isFatal });

    if (previousHandler) {
      previousHandler(error, isFatal);
    }
  });
}
