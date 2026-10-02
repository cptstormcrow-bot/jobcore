import test from 'node:test';
import assert from 'node:assert/strict';
import { registerModule, moduleSwitcherItems } from '../index';

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
