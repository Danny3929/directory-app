import { describe, it, expect } from 'vitest';
import { similarGyms } from './similar.js';

// Small made-up gyms. lat/lng only matter for the "nearest wins a tie" rule.
const gym = (id, name, tags, lat = -1.29, lng = 36.78) => ({ id, slug: `g${id}`, name, tags, lat, lng });

const me = gym(1, 'Me', ['boxing', 'strength', 'weights']);

describe('similarGyms (Dan: most shared tags, ties nearest, then A to Z)', () => {
  it('never includes the gym itself', () => {
    const result = similarGyms(me, [me, gym(2, 'B', ['boxing'])]);
    expect(result.map((g) => g.id)).toEqual([2]);
  });

  it('puts the gym sharing the most tags first', () => {
    const one = gym(2, 'One', ['boxing']);
    const three = gym(3, 'Three', ['boxing', 'strength', 'weights']);
    const two = gym(4, 'Two', ['strength', 'weights', 'yoga']);
    expect(similarGyms(me, [one, three, two]).map((g) => g.name)).toEqual(['Three', 'Two', 'One']);
  });

  it('leaves out gyms that share no tag', () => {
    expect(similarGyms(me, [gym(2, 'Yoga', ['yoga'])])).toEqual([]);
  });

  it('gives at most 3', () => {
    const many = [2, 3, 4, 5, 6].map((id) => gym(id, `G${id}`, ['boxing']));
    expect(similarGyms(me, many)).toHaveLength(3);
  });

  it('breaks a tie by distance: the nearer gym first', () => {
    const far = gym(2, 'Aaa Far', ['boxing'], -1.4, 36.9);
    const near = gym(3, 'Zzz Near', ['boxing'], -1.291, 36.781);
    expect(similarGyms(me, [far, near]).map((g) => g.name)).toEqual(['Zzz Near', 'Aaa Far']);
  });

  it('breaks a full tie (same tags, same place) A to Z, ignoring case', () => {
    const b = gym(2, 'bravo', ['boxing']);
    const a = gym(3, 'Alpha', ['boxing']);
    expect(similarGyms(me, [b, a]).map((g) => g.name)).toEqual(['Alpha', 'bravo']);
  });

  it('still works when a gym has no tags or no position', () => {
    const noTags = { id: 2, name: 'No tags' };
    const noPlace = { id: 3, name: 'No place', tags: ['boxing'] };
    expect(similarGyms(me, [noTags, noPlace]).map((g) => g.name)).toEqual(['No place']);
  });

  it('gives an empty list for a gym with no tags', () => {
    expect(similarGyms({ id: 9, name: 'Bare' }, [me])).toEqual([]);
  });
});
