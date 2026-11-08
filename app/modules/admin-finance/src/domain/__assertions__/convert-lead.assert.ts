import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJobFromWebsiteLead, canConvert, countUnworkedLeads, needsServiceArea, resolveServiceAreaId, findMatchingCustomer } from '../convert-lead';

const areas: any[] = [
  { id: 'a1', name: 'Santa Barbara', zipCodes: ['93101', '93103'] },
  { id: 'a2', name: 'Goleta', zipCodes: ['93117'] },
];
const lead: any = {
  id: 'l1', organizationId: 'o1', name: 'Pat', phone: '555-201-4488', email: 'p@x.com', address: '1 A St',
  zip: '93101', serviceArea: null, convertedJobId: null, qualifiedAt: null, preferredDate: '2026-11-20',
  preferredTime: null, projectDetails: 'Shed', payer: null, attachTiming: null, ingressInstructions: 'Gate',
};

test('zip then named area resolve; no match is null', () => {
  assert.equal(resolveServiceAreaId(lead, areas), 'a1');
  assert.equal(resolveServiceAreaId({ zip: '99999', serviceArea: ' goleta ' }, areas), 'a2');
  assert.equal(resolveServiceAreaId({ zip: '99999', serviceArea: null }, areas), null);
});

test('needsServiceArea reads either field shape', () => {
  assert.equal(needsServiceArea({ serviceAreaId: null }), true);
  assert.equal(needsServiceArea({ service_area_id: 'a1' }), false);
});

test('canConvert blocks repeat, blank address, blank name', () => {
  assert.equal(canConvert(lead).ok, true);
  assert.equal(canConvert({ ...lead, convertedJobId: 'j1' }).ok, false);
  assert.equal(canConvert({ ...lead, address: ' ' }).ok, false);
  assert.equal(canConvert({ ...lead, name: '' }).ok, false);
});

test('job draft is new, website, carries area and window', () => {
  const j = buildJobFromWebsiteLead(lead, null, 'c1');
  assert.equal(j.status, 'new');
  assert.equal(j.source, 'website');
  assert.equal(j.serviceAreaId, null);
  assert.equal(j.requestedWindow, '2026-11-20');
  assert.equal(j.ingressInstructions, 'Gate');
});

test('unworked count and customer match', () => {
  assert.equal(countUnworkedLeads([lead, { ...lead, qualifiedAt: 't' }, { ...lead, convertedJobId: 'j' }]), 1);
  assert.equal(findMatchingCustomer(lead, [{ id: 'c9', phone: '(555) 201-4488', email: null }]), 'c9');
});
