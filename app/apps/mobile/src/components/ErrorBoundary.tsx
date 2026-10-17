import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button, Text } from '@jobcore/ui';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * React error boundaries must be class components — there is no hook
 * equivalent for `getDerivedStateFromError` / `componentDidCatch`.
 * Wraps a routed module screen (see `app/m/[moduleId].tsx`) so a crash in
 * one module's contributed component doesn't take down the whole app shell.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[JOBCORE] ErrorBoundary caught error', { error, errorInfo });
  }

  handleGoBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  override render(): React.ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.center}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Button label="Go back" onPress={this.handleGoBack} />
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
});
