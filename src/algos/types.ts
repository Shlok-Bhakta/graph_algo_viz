import type { Graph } from '../types';

export interface AlgorithmStep {
  visitedEdges: Set<string>;
  visitedNodes: Set<string>;
}

export interface AlgorithmOptions {
  source?: string;
  sink?: string;
  delayMs?: number;
  skipPathReconstructionYields?: boolean;
}

export type AlgorithmGenerator = (
  graph: Graph, 
  options?: AlgorithmOptions
) => AsyncGenerator<AlgorithmStep, AlgorithmStep>;

export interface AlgorithmMetadata {
  id: string;
  name: string;
  description: string;
  category: 'traversal' | 'shortest-path' | 'demo' | 'mst';
  requiresSource: boolean;
  requiresSink: boolean;
  viewportScale?: number;
  run: AlgorithmGenerator;
}
