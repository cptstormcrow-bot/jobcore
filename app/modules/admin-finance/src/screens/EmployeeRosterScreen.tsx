/**
 * Employee roster screen — list query, mirrors `PriceSheetListScreen.tsx`'s
 * structure exactly (optional-props + honest-empty-view pattern, idle/
 * loading/loaded/failed load-state machine, `getModuleSession` for the
 * org-scoped id).
 *
 * Reads `session.org.id` via `getModuleSession`, then queries
 * `EmployeeRepository.listEmployees` for every profile in the organization.
 * A "Show Test Employees" `Toggle` (default off) filters the loaded list
 * through `@jobcore/core`'s `isTestVisible` before rendering — same
 * visibility convention as `isBetaVisible` elsewhere in this module.
 */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, ListItem, EmptyState, LoadingState, ErrorState, ScreenTitle, colors, spacing, typography, Text } from '@jobcore/ui';
import type { Profile } from '@jobcore/core';
import { isTestVisible } from '@jobcore/core';
import type { EmployeeRepository } from '../data/ports';
import { getModuleSession } from '../lib/module-session';

export interface EmployeeRosterScreenProps {
  employees?: EmployeeRepository;
  /** Fired when an employee row is selected, mirrors `PriceSheetListScreen.tsx`'s `onSelectSheet`. */
  onSelectEmployee?: (profile: Profile) => void;
  /** Fired when the "Add Employee" button is pressed. */
  onAddEmployee?: () => void;
  /** Fired when the "Pending Invitations" button is pressed. */
  onViewInvitations?: () => void;
  /** Controlled "Show Test Employees" value; falls back to local state when omitted. */
  showTest?: boolean;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; employees: Profile[] }
  | { kind: 'failed'; message: string };

export function EmployeeRosterScreen(props: EmployeeRosterScreenProps = {}) {
  const { employees: employeeRepository, onSelectEmployee, onAddEmployee, onViewInvitations, showTest: showTestProp } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const showTest = showTestProp ?? false;

  const session = getModuleSession();

  useEffect(() => {
    if (!session || !employeeRepository) {
      return;
    }
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    employeeRepository
      .listEmployees(session.org.id)
      .then((result) => {
        if (!cancelled) {
          setLoadState({ kind: 'loaded', employees: result });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load employees.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, employeeRepository]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Employee Roster"
          message="Sign in to view this organization's employees."
        />
      </View>
    );
  }

  if (!employeeRepository) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Employee Roster"
          message="No data source is connected for this module yet."
        />
      </View>
    );
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading employees..." />
      </View>
    );
  }

  if (loadState.kind === 'failed') {
    return (
      <View style={styles.screen}>
        <ErrorState message={loadState.message} />
      </View>
    );
  }

  const visibleEmployees = loadState.employees.filter((profile) => isTestVisible(profile, showTest) && profile.role !== 'owner');

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Employee Roster" />
        <Button label="Add Employee" style={styles.action} onPress={() => onAddEmployee?.()} disabled={!onAddEmployee} />
        {onViewInvitations ? (
          <Button label="Pending Invitations" variant="outline" style={styles.action} onPress={() => onViewInvitations?.()} />
        ) : null}
        {visibleEmployees.length === 0 ? (
          <EmptyState title="Employee Roster" message="This organization has no employees on file." />
        ) : (
          <Card style={styles.card}>
            {visibleEmployees.map((profile) => (
              <ListItem
                key={profile.id}
                title={profile.fullName}
                subtitle={[
                  profile.role,
                  profile.active ? 'Active' : 'Inactive',
                  profile.isTest ? 'Test' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={onSelectEmployee ? () => onSelectEmployee(profile) : undefined}
              />
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

export default EmployeeRosterScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  action: {
    marginBottom: spacing.sm,
  },
});
