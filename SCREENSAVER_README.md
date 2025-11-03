# 🌌 Zen Screensaver Mode

## Overview
A beautiful, meditative visualization mode that cycles through cities around the world, running graph algorithms with calming colors and ambient music.

## How to Access
1. **From Main App**: Click the "✨ Screensaver Mode" button (top right)
2. **Direct URL**: Navigate to `http://localhost:5173/graph_algo_viz?screensaver`

## Features

### 🌍 Global City Tour
- 35+ carefully selected cities worldwide
- Tokyo, Paris, NYC, Amsterdam, Venice, San Francisco, and more
- Variable radius (500m-3000m) based on city density

### 🎨 Algorithm Rotation
Auto-cycles through:
- **BFS** (Breadth-First Search)
- **DFS** (Depth-First Search)
- **Prim's MST** (Minimum Spanning Tree)
- **Kruskal's MST** (Minimum Spanning Tree)

### 🎭 Zen Aesthetics
- **Deep gradient backgrounds**: Subtle dark blue/purple tones
- **Animated highlight colors**: Purple gradients that shift as algorithms progress
- **Smooth transitions**: 1.5s fade between locations
- **Clean UI**: No buttons, just city name and algorithm at bottom
- **Bloom effects**: Glowing edges during traversal

### 🎵 Ambient Audio
- Looping ambient music (mixkit deep urban)
- Low volume, non-intrusive
- Enhances the meditative experience

### ⚙️ Auto-Cycling Logic
1. Load random city with random radius
2. Wait 1 second (entrance)
3. Run random algorithm with random speed (20-50ms)
4. Wait 2-5 seconds after completion
5. Fade out (1.5s)
6. Repeat from step 1

## Implementation Details

### Files Created/Modified
- `src/Screensaver.svelte` - Main screensaver component
- `src/lib/cities.ts` - City database (35 cities)
- `src/main.ts` - Route detection logic
- `src/App.svelte` - Added screensaver button
- `src/lib/MapCanvas.svelte` - Enhanced colors for zen aesthetic

### Color Palette
- **Background**: `#0a0a0f` → `#0d0d12` gradient
- **Buildings**: `#1a1a24`
- **Roads**: `#2a2a3a`
- **Highlights**: Purple gradient `#8b5cf6` → `#e9d5ff`

### Performance
- Uses offscreen canvas caching for static layers
- Sub-edge cache for simplified graph rendering
- Smooth at any city size

## To Exit
Simply navigate away or close the tab. No keyboard/mouse handlers implemented for maximum zen.

## Future Enhancements
- More algorithm variety (Dijkstra, A*)
- Dynamic speed based on graph density
- Custom audio playlist
- Time-of-day color themes
- Particle effects on nodes

Enjoy your zen moment! 🧘‍♂️
