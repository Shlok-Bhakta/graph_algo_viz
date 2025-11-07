import type { Edge, Graph, GraphNode } from '../types';
import type { AlgorithmStep } from './types';


export async function* bellmanford(
  graph: Graph,
  options?: { source?: string; sink?: string; delayMs?: number }
): AsyncGenerator<AlgorithmStep, AlgorithmStep> {
  const delayMs = options?.delayMs ?? 50;
  let visitedEdges = new Set<string>();
  let visitedNodes = new Set<string>();
  let reachableEdges = new Set<Edge>();
  const startNodeId = options?.source;
  if (!startNodeId) {
    return { visitedEdges, visitedNodes };
  }
  const endNodeId = options?.sink;
  if (!endNodeId) {
    return { visitedEdges, visitedNodes };
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
          reachableEdges.add(node.edges[i])
        }
        
      }
    }
    
  }
  // yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
  // await new Promise(resolve => setTimeout(resolve, delayMs));
  let reachable = visitedNodes
  visitedEdges = new Set<string>();
  visitedNodes = new Set<string>();
  const distances = new Map<string, number>();
  const parents = new Map<string, {nodeId: string, edgeId: string} | null>();
  for(let node of reachable){
    distances.set(node, Infinity)
    parents.set(node, null)
  }
  distances.set(startNodeId, 0)
  // Continuously do relax v-1 times on all edges
  for(let i = 0; i < reachable.size-1; i++){        
    const tempEdges: Set<string> = new Set();
    const tempNodes: Set<string> = new Set();
    for(let edge of reachableEdges){
      const currentDist = distances.get(edge.from) ?? Infinity
      const newDist = currentDist + edge.weight;
      const oldDist = distances.get(edge.to) ?? Infinity
      if (newDist < oldDist){
        distances.set(edge.to, newDist)
        parents.set(edge.to, {nodeId: edge.from, edgeId: edge.id})
        
        tempEdges.add(edge.id)
        tempNodes.add(edge.from)
        tempNodes.add(edge.to)
        yield { visitedEdges: tempEdges, visitedNodes: tempNodes };
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  visitedEdges.clear()
  visitedNodes.clear()

  let curr = endNodeId
  while(curr != startNodeId){
    const parent = parents.get(curr)!;
    visitedNodes.add(curr)
    visitedNodes.add(parent.nodeId)
    visitedEdges.add(parent.edgeId)
    curr = parent.nodeId
    yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  visitedNodes.add(startNodeId)
  yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
  await new Promise(resolve => setTimeout(resolve, delayMs));
  




  return { visitedEdges, visitedNodes };
}
