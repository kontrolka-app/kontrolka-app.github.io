import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATARS, ACCESSORIES, resolveAvatar, isUnlocked, DEFAULT_AVATAR } from '../js/avatars.js';
import { BADGE_IDS } from '../js/achievements.js';
import { sanitizeData } from '../js/storage.js';

test('10 персонажей и аксессуары; открываются только существующими значками', () => {
  assert.equal(AVATARS.length, 10);
  assert.equal(new Set(AVATARS.map((a) => a.id)).size, AVATARS.length);
  for (const x of [...AVATARS, ...ACCESSORIES]) if (x.unlock) assert.ok(BADGE_IDS.has(x.unlock), x.id);
  assert.ok(ACCESSORIES.some((x) => x.id === 'scarf' && x.unlock === 'week'), 'Неделя → шарф');
  assert.ok(ACCESSORIES.some((x) => x.id === 'crown' && x.unlock === 'q1000'), 'Тысячник → корона');
});

test('выбор: закрытое или неизвестное — енот без аксессуара', () => {
  assert.equal(resolveAvatar({ avatar: 'owl', accessory: 'crown' }, {}).avatar.id, DEFAULT_AVATAR);
  assert.equal(resolveAvatar({ avatar: 'owl', accessory: 'crown' }, {}).accessory, null);
  const r = resolveAvatar({ avatar: 'owl', accessory: 'crown' }, { expert: 1, q1000: 1 });
  assert.equal(r.avatar.id, 'owl');
  assert.equal(r.accessory.id, 'crown');
  assert.equal(resolveAvatar({ avatar: 'нет', accessory: '' }, {}).avatar.id, DEFAULT_AVATAR);
  assert.ok(isUnlocked(AVATARS[0], {}));
  assert.equal(sanitizeData({ schemaVersion: 1, settings: { avatar: 5 } }).data.settings.avatar, '');
  assert.equal(sanitizeData({ schemaVersion: 1, settings: { avatar: 'cat' } }).data.settings.avatar, 'cat');
});

test('компаньон: свой персонаж или как аватарка', async () => {
  const { resolveCompanion } = await import('../js/avatars.js');
  assert.equal(resolveCompanion({ avatar: 'cat', accessory: 'bow', companionId: '' }, { perfect: 1 }).avatar.id, 'cat', 'пусто — как аватарка');
  assert.equal(resolveCompanion({ avatar: 'cat', accessory: 'bow', companionId: '' }, { perfect: 1 }).accessory.id, 'bow');
  const own = resolveCompanion({ avatar: 'cat', companionId: 'penguin' }, {});
  assert.equal(own.avatar.id, 'penguin');
  assert.equal(own.sameAsAvatar, false);
  assert.equal(resolveCompanion({ avatar: 'cat', companionId: 'owl' }, {}).avatar.id, 'cat', 'закрытый — как аватарка');
  assert.equal(sanitizeData({ schemaVersion: 1, settings: { companionId: 'dino' } }).data.settings.companionId, 'dino');
  assert.equal(sanitizeData({ schemaVersion: 1 }).data.settings.companionId, '');
});
