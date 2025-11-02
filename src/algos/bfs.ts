import type { Graph, GraphNode } from '../types';
import type { AlgorithmStep } from './types';

export async function* bfs(
  graph: Graph,
  options?: { source?: string; delayMs?: number }
): AsyncGenerator<AlgorithmStep, AlgorithmStep> {
  const delayMs = options?.delayMs ?? 50;
  const visitedEdges = new Set<string>();
  const visitedNodes = new Set<string>();

  let startNodeId = options?.source;
  if (!startNodeId) {
    const firstNode = graph.nodes.values().next().value;
    if (!firstNode) return { visitedEdges, visitedNodes };
    startNodeId = firstNode.id;
  }

  let queue: string[] = [startNodeId]
  while(queue.length != 0){
    let elem: string | undefined = queue.shift();
    let node: GraphNode | undefined;
    if(elem == undefined){
      continue;
    } else{
      node = graph.nodes.get(elem);
      if(node == undefined){
        continue;
      }
      if(node.edges.length > 0){
        visitedNodes.add(node.edges[0].from)
      }
      for(let i = 0; i < node.edges.length; i++){
        if(visitedNodes.has(node.edges[i].to)){
          continue;
        }else{
          queue.push(node.edges[i].to)
          visitedEdges.add(node.edges[i].id);
          visitedNodes.add(node.edges[i].to)
        }
        
        yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
  }


  return { visitedEdges, visitedNodes };
}
