import type { Graph } from '../types';

export interface AlgorithmStep {
  visitedEdges: Set<string>;
  visitedNodes: Set<string>;
}

export type AlgorithmGenerator = (
  graph: Graph, 
  options?: { source?: string; sink?: string; delayMs?: number }
) => AsyncGenerator<AlgorithmStep, AlgorithmStep>;

export interface AlgorithmMetadata {
  id: string;
  name: string;
  description: string;
  category: 'traversal' | 'shortest-path' | 'demo' | 'mst';
  requiresSource: boolean;
  requiresSink: boolean;
  run: AlgorithmGenerator;
}
