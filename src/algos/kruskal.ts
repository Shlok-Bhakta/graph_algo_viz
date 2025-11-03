import type { Graph, GraphNode } from '../types';
import type { AlgorithmStep } from './types';

class UnionFind {
  parent: Map<string, string>;
  rank: Map<string, number>;

  constructor(nodes: Iterable<string>){
    this.parent = new Map();
    this.rank = new Map();
    for(const node of nodes){
      this.parent.set(node, node);
      this.rank.set(node, 0);
    }
  }

  find(x: string): string {
    let root = x
    while(this.parent.get(root) != root){
      root = this.parent.get(root)!;
    }
    // Do a little lazy speedup optimizaiton here
    while(x != root){
      let next: string = this.parent.get(x)!;
      this.parent.set(next, root);  
      x = next;
    }
    return root
  }

  union(x: string, y: string): boolean {
    let x_root = this.find(x)
    let y_root = this.find(y)

    if (x_root == y_root) {
      return false
    }
    if(this.rank.get(x_root)! < this.rank.get(y_root)!){
      this.parent.set(x_root, y_root)
    }else if(this.rank.get(y_root)! < this.rank.get(x_root)!){
      this.parent.set(y_root, x_root)
    }else{
      this.parent.set(y_root, x_root)
      this.rank.set(x_root, this.rank.get(x_root)!+1)
    }
    return true
  }
}

export async function* Kruskal(
  graph: Graph,
  options?: { source?: string; delayMs?: number }
): AsyncGenerator<AlgorithmStep, AlgorithmStep> {
  const delayMs = options?.delayMs ?? 50;
  let visitedEdges = new Set<string>();
  let visitedNodes = new Set<string>();
  // Get all reachable Edges
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
        
      }
    }
    
  }
  // yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
  // await new Promise(resolve => setTimeout(resolve, delayMs));
  // const edges_sorted = 
  let reachable = visitedNodes
  visitedEdges = new Set<string>();
  visitedNodes = new Set<string>();
  const edgeSet = new Set(Array.from(reachable).flatMap(nodeId => graph.nodes.get(nodeId)!.edges).filter(e =>
  reachable.has(e.to)).map(e => e.id));
  const edges_sorted = Array.from(edgeSet).map(id => graph.edges.find(e => e.id === id)!).sort((a, b) => a.
  weight - b.weight);
  const uf = new UnionFind(reachable)
  for(let i = 0; i < edges_sorted.length; i++){
    if(uf.find(edges_sorted[i].to) != uf.find(edges_sorted[i].from)){
      uf.union(edges_sorted[i].to, edges_sorted[i].from)
      visitedNodes.add(edges_sorted[i].to)
      visitedNodes.add(edges_sorted[i].from)
      visitedEdges.add(edges_sorted[i].id)
      yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }





  return { visitedEdges, visitedNodes };
}
