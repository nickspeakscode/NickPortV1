import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { RARITY, RECENT_LIMIT, pickPokemon, pokemonOptions } from '../src/lib/pokemonRelease.js';

// A small seeded generator so the odds check is repeatable.
function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

test('every Pokemon is listed once, with a known rarity and a sprite on disk', () => {
  assert.equal(new Set(pokemonOptions.map((option) => option.name.toLowerCase())).size, pokemonOptions.length, 'duplicate name');
  assert.equal(new Set(pokemonOptions.map((option) => option.src)).size, pokemonOptions.length, 'duplicate sprite');
  for (const option of pokemonOptions) {
    assert.ok(RARITY[option.rarity], option.name);
    assert.ok(existsSync(new URL(`../public${option.src}`, import.meta.url)), `${option.name}: missing ${option.src}`);
  }
});

test('recent Pokemon never come back, so there are no repeats in a row', () => {
  const random = seeded(7);
  let recent = [];
  for (let pull = 0; pull < 2000; pull += 1) {
    const picked = pickPokemon(random, recent);
    assert.ok(!recent.includes(picked.name), `${picked.name} was released again too soon`);
    recent = [picked.name, ...recent].slice(0, RECENT_LIMIT);
  }
});

test('rarer tiers come up less often', () => {
  const random = seeded(42);
  const counts = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
  let recent = [];
  const pulls = 20000;
  for (let pull = 0; pull < pulls; pull += 1) {
    const picked = pickPokemon(random, recent);
    counts[picked.rarity] += 1;
    recent = [picked.name, ...recent].slice(0, RECENT_LIMIT);
  }
  assert.ok(counts.common > counts.uncommon && counts.uncommon > counts.rare && counts.rare > counts.legendary, JSON.stringify(counts));
  const legendaryShare = counts.legendary / pulls;
  assert.ok(legendaryShare > 0.02 && legendaryShare < 0.06, `legendary share ${legendaryShare}`);
});

test('the roll maps onto the weights', () => {
  assert.equal(pickPokemon(() => 0).name, pokemonOptions[0].name);
  assert.equal(pickPokemon(() => 0.999999).name, pokemonOptions[pokemonOptions.length - 1].name);
});
