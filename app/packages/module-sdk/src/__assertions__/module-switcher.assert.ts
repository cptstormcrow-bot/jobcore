import test from 'node:test';
import assert from 'node:assert/strict';
import { registerModule, moduleSwitcherItems, getEnabledModules } from '../index';

const mk = (id: string, displayName: string, roles: string[]) =>
  ({ id, displayName, requiredRoles: roles, routes: [], navEntries: [] }) as never;

registerModule(mk('mod-a', 'Alpha', ['owner', 'admin']));
registerModule(mk('mod-b', 'Beta', ['owner', 'admin']));
registerModule(mk('mod-c', 'Gamma', ['tech']));

test('moduleSwitcherItems: non owner/admin gets []', () => {
  assert.deepEqual(moduleSwitcherItems('mod-a', 'tech'), []);
  assert.deepEqual(moduleSwitcherItems('mod-a', null), []);
  assert.deepEqual(moduleSwitcherItems('mod-a', undefined), []);
});

test('moduleSwitcherItems: admin gets role-visible modules minus current', () => {
  assert.deepEqual(moduleSwitcherItems('mod-a', 'admin'), [{ label: 'Beta', route: '/m/mod-b' }]);
  assert.deepEqual(moduleSwitcherItems('none', 'owner').map((r) => r.route), ['/m/mod-a', '/m/mod-b']);
});

// hideFromSwitcher: registered and role-enabled, but never listed in the switcher.
registerModule({
  id: 'mod-hidden',
  displayName: 'Hidden',
  requiredRoles: ['owner', 'admin'],
  routes: [],
  navEntries: [],
  hideFromSwitcher: true,
} as never);

test('moduleSwitcherItems: hideFromSwitcher module is filtered out', () => {
  assert.deepEqual(moduleSwitcherItems('mod-a', 'admin'), [{ label: 'Beta', route: '/m/mod-b' }]);
  assert.deepEqual(moduleSwitcherItems('none', 'owner').map((r) => r.route), ['/m/mod-a', '/m/mod-b']);
  for (const role of ['owner', 'admin']) {
    assert.ok(!moduleSwitcherItems('none', role).some((r) => r.route === '/m/mod-hidden'));
  }
});

test('getEnabledModules: hideFromSwitcher module is still role-enabled', () => {
  const org = { enabledModules: ['mod-a', 'mod-b', 'mod-c', 'mod-hidden'] } as unknown as Parameters<
    typeof getEnabledModules
  >[0];
  assert.ok(getEnabledModules(org, 'owner').some((m) => m.id === 'mod-hidden'));
});
