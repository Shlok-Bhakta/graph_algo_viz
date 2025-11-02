import type { AlgorithmMetadata } from './types';
import { randomEdges } from './random_edges';
import { dfs } from './dfs';
import { bfs } from './bfs';

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
