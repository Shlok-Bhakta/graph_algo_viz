import type { AlgorithmMetadata } from './types';
import { randomEdges } from './random_edges';
import { dfs } from './dfs';
import { bfs } from './bfs';
import { Kruskal } from './kruskal';
import { Prim } from './prim';

export const algorithms: AlgorithmMetadata[] = [
  {
    id: 'dfs',
    name: 'Depth-First Search',
    description: 'Explores as far as possible along each branch before backtracking',
    category: 'traversal',
    requiresSource: false,
    requiresSink: false,
    run: dfs
  },
  {
    id: 'bfs',
    name: 'Breadth-First Search',
    description: 'Explores every path equally.',
    category: 'traversal',
    requiresSource: false,
    requiresSink: false,
    run: bfs
  },
  {
    id: 'Kruskal',
    name: 'Kruskal\'s Sinimum Spanning Tree',
    description: 'Connects all nodes using the minimum distance',
    category: 'mst',
    requiresSource: false,
    requiresSink: false,
    run: Kruskal
  },
  {
    id: 'Prim',
    name: 'Prim\'s Sinimum Spanning Tree',
    description: 'Connects all nodes using the minimum distance but in a different way',
    category: 'mst',
    requiresSource: false,
    requiresSink: false,
    run: Prim
  },
  {
    id: 'random-edges',
    name: 'Random Edges',
    description: 'Randomly selects edges until all are visited (demo)',
    category: 'demo',
    requiresSource: false,
    requiresSink: false,
    run: randomEdges
  }
];

export function getAlgorithmById(id: string): AlgorithmMetadata | undefined {
  return algorithms.find(algo => algo.id === id);
}
