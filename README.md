# Graph Algo Viz

Check out screensaver mode! 
[https://shlok-bhakta.github.io/graph_algo_viz?screensaver](https://shlok-bhakta.github.io/graph_algo_viz/?screensaver)

I have an exam in CS 411 for my uni where I will be answering questions on graph algorithms. Some of these are still a bit fuzzy to me on a lower level so I wanted to learn by making a cool project to visualize these algorithms on real graph data from [OpenStreetMap](https://www.openstreetmap.org/#map=4/38.01/-95.84)

## Screensaver Mode Options

You can customize the screensaver by adding URL parameters:

### Filter Algorithms
Use `?screensaver&algorithms=` or `?screensaver&algos=` with a comma-separated list:

**Examples:**
- Only BFS and DFS: `?screensaver&algos=bfs,dfs`
- Only shortest path algorithms: `?screensaver&algorithms=bellman-ford,djikstra,astar`
- Only MST algorithms: `?screensaver&algos=prim,kruskal`

**Available algorithms** (case-insensitive):
- `bfs` - Breadth-First Search
- `dfs` - Depth-First Search
- `prim` - Prim's Minimum Spanning Tree
- `kruskal` - Kruskal's Minimum Spanning Tree
- `bellman-ford` - Bellman-Ford Shortest Path
- `djikstra` - Dijkstra's Shortest Path
- `astar` - A* Shortest Path