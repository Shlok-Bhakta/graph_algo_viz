import { describe, expect, it, vi } from 'vitest';
import { buildGraph } from './graph';
import type { Element } from '../types';

describe('buildGraph', () => {
  it('builds bidirectional weighted edges from highway geometry and ignores non-highways', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const elements: Element[] = [
      {
        type: 'way',
        id: 1,
        tags: { highway: 'residential' },
        geometry: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 0.001 }
        ]
      },
      {
        type: 'way',
        id: 2,
        tags: { building: 'yes' },
        geometry: [
          { lat: 1, lon: 1 },
          { lat: 1, lon: 1.001 }
        ]
      }
    ];

    const graph = buildGraph(elements);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges.map(edge => edge.id).sort()).toEqual([
      '0.00000,0.00000->0.00000,0.00100',
      '0.00000,0.00100->0.00000,0.00000'
    ]);
    expect(graph.edges[0].weight).toBeGreaterThan(100);
    expect(graph.edges[0].weight).toBeCloseTo(graph.edges[1].weight);
    expect(graph.nodes.get('0.00000,0.00000')?.edges).toHaveLength(1);

    log.mockRestore();
  });

  it('collapses degree-two road chains while preserving raw graph metadata', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const graph = buildGraph([
      {
        type: 'way',
        id: 10,
        tags: { highway: 'primary' },
        geometry: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 0.001 },
          { lat: 0, lon: 0.002 },
          { lat: 0, lon: 0.003 }
        ]
      },
      {
        type: 'way',
        id: 11,
        tags: { highway: 'primary' },
        geometry: [
          { lat: 0, lon: 0.001 },
          { lat: 0.001, lon: 0.001 }
        ]
      }
    ]);

    expect(graph._raw?.nodes).toHaveLength(5);
    expect(graph._raw?.edges).toHaveLength(8);
    expect(graph.nodes.has('0.00000,0.00200')).toBe(false);

    const collapsed = graph.edges.find(
      edge => edge.from === '0.00000,0.00300' && edge.to === '0.00000,0.00100'
    );
    expect(collapsed?.subEdges).toEqual([
      '0.00000,0.00300->0.00000,0.00200',
      '0.00000,0.00200->0.00000,0.00100'
    ]);
    expect(collapsed?.way.geometry.map(point => `${point.lat},${point.lon}`)).toEqual([
      '0,0.003',
      '0,0.002',
      '0,0.001'
    ]);

    log.mockRestore();
  });
});
