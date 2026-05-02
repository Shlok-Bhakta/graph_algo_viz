import { describe, expect, it, vi } from 'vitest';
import { astar } from './astar';
import { bfs } from './bfs';
import { bellmanford } from './bellman-ford';
import { dfs } from './dfs';
import { Djikstra } from './djikstra';
import { Kruskal } from './kruskal';
import { Prim } from './prim';
import { randomEdges } from './random_edges';
import { collectGenerator, makeWeightedGraph } from '../test/fixtures';

describe('traversal algorithms', () => {
  it('bfs visits every reachable node from the source', async () => {
    const { returned, yields } = await collectGenerator(bfs(makeWeightedGraph(), { source: 'A', delayMs: 0 }));

    expect(yields.length).toBeGreaterThan(0);
    expect([...returned.visitedNodes].sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(returned.visitedEdges.size).toBe(3);
    expect(returned.visitedEdges.has('A->B')).toBe(true);
  });

  it('bfs only yields when it discovers a new edge', async () => {
    const { returned, yields } = await collectGenerator(bfs(makeWeightedGraph(), { source: 'A', delayMs: 0 }));

    expect(yields).toHaveLength(returned.visitedEdges.size);
    yields.forEach((step, index) => {
      expect(step.visitedEdges.size).toBe(index + 1);
    });
  });

  it('dfs visits every reachable node from the source', async () => {
    const { returned, yields } = await collectGenerator(dfs(makeWeightedGraph(), { source: 'A', delayMs: 0 }));

    expect(yields.length).toBeGreaterThan(0);
    expect([...returned.visitedNodes].sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(returned.visitedEdges.size).toBe(3);
  });

  it('dfs only yields when it discovers a new edge', async () => {
    const { returned, yields } = await collectGenerator(dfs(makeWeightedGraph(), { source: 'A', delayMs: 0 }));

    expect(yields).toHaveLength(returned.visitedEdges.size);
    yields.forEach((step, index) => {
      expect(step.visitedEdges.size).toBe(index + 1);
    });
  });

  it('defaults to an empty result on an empty graph', async () => {
    const { returned } = await collectGenerator(bfs({ nodes: new Map(), edges: [] }, { delayMs: 0 }));

    expect(returned.visitedNodes.size).toBe(0);
    expect(returned.visitedEdges.size).toBe(0);
  });
});

describe('shortest path algorithms', () => {
  it('dijkstra returns the lowest-cost path from source to sink', async () => {
    const { returned } = await collectGenerator(Djikstra(makeWeightedGraph(), {
      source: 'A',
      sink: 'D',
      delayMs: 0
    }));

    expect(returned.visitedEdges).toEqual(new Set(['C->D', 'B->C', 'A->B']));
    expect(returned.visitedNodes).toEqual(new Set(['D', 'C', 'B', 'A']));
  });

  it('bellman-ford returns the lowest-cost path from source to sink', async () => {
    const { returned } = await collectGenerator(bellmanford(makeWeightedGraph(), {
      source: 'A',
      sink: 'D',
      delayMs: 0
    }));

    expect(returned.visitedEdges).toEqual(new Set(['C->D', 'B->C', 'A->B']));
    expect(returned.visitedNodes).toEqual(new Set(['D', 'C', 'B', 'A']));
  });

  it('a star returns a valid shortest path from source to sink', async () => {
    const { returned } = await collectGenerator(astar(makeWeightedGraph(), {
      source: 'A',
      sink: 'D',
      delayMs: 0
    }));

    expect(returned.visitedEdges).toEqual(new Set(['C->D', 'B->C', 'A->B']));
    expect(returned.visitedNodes).toEqual(new Set(['D', 'C', 'B', 'A']));
  });

  it('shortest path algorithms can skip reconstruction yields while returning the final path', async () => {
    const expectedPath = new Set(['C->D', 'B->C', 'A->B']);
    const algorithms = [Djikstra, bellmanford, astar];

    const runs = await Promise.all(algorithms.map(async (run) => ({
      normal: await collectGenerator(run(makeWeightedGraph(), {
        source: 'A',
        sink: 'D',
        delayMs: 0
      })),
      skipped: await collectGenerator(run(makeWeightedGraph(), {
        source: 'A',
        sink: 'D',
        delayMs: 0,
        skipPathReconstructionYields: true
      }))
    })));

    runs.forEach(({ normal, skipped }) => {
      expect(skipped.returned.visitedEdges).toEqual(expectedPath);
      expect(skipped.yields.length).toBeLessThan(normal.yields.length);
    });
  });

  it('shortest path algorithms return empty results when source or sink is missing', async () => {
    const graph = makeWeightedGraph();
    const dijkstra = await collectGenerator(Djikstra(graph, { source: 'A', delayMs: 0 }));
    const bellmanFord = await collectGenerator(bellmanford(graph, { sink: 'D', delayMs: 0 }));
    const aStar = await collectGenerator(astar(graph, { source: 'missing', sink: 'D', delayMs: 0 }));

    expect(dijkstra.returned.visitedEdges.size).toBe(0);
    expect(bellmanFord.returned.visitedEdges.size).toBe(0);
    expect(aStar.returned.visitedEdges.size).toBe(0);
  });
});

describe('minimum spanning tree algorithms', () => {
  it('kruskal selects a minimum spanning tree over the reachable component', async () => {
    const { returned } = await collectGenerator(Kruskal(makeWeightedGraph(), { source: 'A', delayMs: 0 }));

    expect(returned.visitedEdges.size).toBe(3);
    expect(returned.visitedNodes).toEqual(new Set(['A', 'B', 'C', 'D']));
    expect([...returned.visitedEdges].sort()).toEqual(['A->B', 'B->C', 'C->D']);
  });

  it('prim selects a minimum spanning tree from the source', async () => {
    const { returned } = await collectGenerator(Prim(makeWeightedGraph(), { source: 'A', delayMs: 0 }));

    expect(returned.visitedEdges.size).toBe(3);
    expect(returned.visitedNodes).toEqual(new Set(['A', 'B', 'C', 'D']));
    expect([...returned.visitedEdges].sort()).toEqual(['A->B', 'B->C', 'C->D']);
  });
});

describe('random edge demo algorithm', () => {
  it('visits every edge once and includes all incident nodes', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const graph = makeWeightedGraph();

    const { returned, yields } = await collectGenerator(randomEdges(graph, { delayMs: 0 }));

    expect(yields).toHaveLength(graph.edges.length);
    expect(returned.visitedEdges).toEqual(new Set(graph.edges.map(edge => edge.id)));
    expect(returned.visitedNodes).toEqual(new Set(['A', 'B', 'C', 'D']));

    random.mockRestore();
  });
});
