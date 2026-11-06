import test from 'node:test';
import assert from 'node:assert/strict';
import { panchangRoute, muhuratRoute, horoscopeRoute, searchTitle, searchDescription, isPrivateRoute } from '../src/lib/seo-routing.ts';
test('dated Panchang keeps its date and rejects impossible dates', () => {
  assert.equal(panchangRoute('2026-09-12').path, '/panchang/2026-09-12');
  assert.equal(panchangRoute('2026-02-30'), null);
  assert.equal(panchangRoute('2028-02-29').date, '2028-02-29');
});
test('Muhurat preserves category and maps property to home', () => {
  assert.equal(muhuratRoute('property').purpose, 'home');
  assert.equal(muhuratRoute('marriage').path, '/muhurat/marriage');
  assert.equal(muhuratRoute('unknown'), null);
});
test('sign hubs are distinct from daily pages and invalid paths fail', () => {
  assert.equal(horoscopeRoute('aries').path, '/horoscope/aries');
  assert.equal(horoscopeRoute('aries', 'daily').path, '/horoscope/aries/daily');
  assert.equal(horoscopeRoute('unknown'), null);
  assert.equal(horoscopeRoute('aries', 'unknown'), null);
});
test('snippet formatting preserves topics and does not duplicate brand', () => {
  assert.equal(searchTitle('Mars in the 12th House: Meaning and Remedies'), 'Mars in the 12th House: Meaning and Remedies | AstroYou');
  assert.equal(searchTitle('Free Kundali | AstroYou'), 'Free Kundali | AstroYou');
  assert.equal(searchDescription('Short description.'), 'Short description.');
});
test('private route matching does not hide public guides', () => {
  assert.equal(isPrivateRoute('/settings/subscription'), true);
  assert.equal(isPrivateRoute('/consult/guide/chat'), true);
  assert.equal(isPrivateRoute('/free-kundali'), false);
  assert.equal(isPrivateRoute('/remedies-guide'), false);
});
