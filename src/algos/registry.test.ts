import { describe, expect, it } from 'vitest';
import { algorithms, getAlgorithmById } from './registry';

describe('algorithm registry', () => {
  it('registers each algorithm with unique ids and executable runners', () => {
    const ids = algorithms.map(algorithm => algorithm.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual([
      'Bellman-Ford',
      'Djikstra',
      'Kruskal',
      'Prim',
      'astar',
      'bfs',
      'dfs',
      'random-edges'
    ]);
    expect(algorithms.every(algorithm => typeof algorithm.run === 'function')).toBe(true);
  });

  it('looks algorithms up by id', () => {
    expect(getAlgorithmById('bfs')?.name).toBe('Breadth-First Search');
    expect(getAlgorithmById('missing')).toBeUndefined();
  });
});
