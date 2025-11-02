<script lang="ts">
  import { algorithms } from '../algos/registry';
  import type { AlgorithmMetadata } from '../algos/types';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelectAlgorithm: (algoId: string) => void;
  }

  let { isOpen, onClose, onSelectAlgorithm }: Props = $props();
  
  let searchQuery = $state('');
  
  const filteredAlgorithms = $derived(
    algorithms.filter(algo => 
      algo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      algo.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );
  
  const groupedAlgorithms = $derived(
    filteredAlgorithms.reduce((acc, algo) => {
      if (!acc[algo.category]) {
        acc[algo.category] = [];
      }
      acc[algo.category].push(algo);
      return acc;
    }, {} as Record<string, AlgorithmMetadata[]>)
  );
  
  const categoryLabels: Record<string, string> = {
    'demo': 'Demo',
    'traversal': 'Graph Traversal',
    'shortest-path': 'Shortest Path'
  };
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 z-40 bg-black/20"
    onclick={handleBackdropClick}
  >
    <div class="absolute left-2 bottom-16 w-80 max-h-[70vh] bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-2xl overflow-hidden">
      <div class="p-3 border-b border-white/10">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search algorithms..."
          class="w-full px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-white/30"
        />
      </div>
      
      <div class="overflow-y-auto max-h-[calc(70vh-60px)] p-2 space-y-3">
        {#each Object.entries(groupedAlgorithms) as [category, algos]}
          <div>
            <h3 class="text-xs font-medium text-white/50 uppercase tracking-wide mb-1.5 px-2">
              {categoryLabels[category]}
            </h3>
            <div class="space-y-1">
              {#each algos as algo}
                <button
                  onclick={() => {
                    onSelectAlgorithm(algo.id);
                    onClose();
                  }}
                  class="w-full text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div class="text-sm font-medium text-white">{algo.name}</div>
                  <div class="text-xs text-white/60 mt-0.5">{algo.description}</div>
                  {#if algo.requiresSource || algo.requiresSink}
                    <div class="text-xs text-white/40 mt-0.5">
                      Requires: {algo.requiresSource ? 'Source' : ''}{algo.requiresSource && algo.requiresSink ? ' + ' : ''}{algo.requiresSink ? 'Sink' : ''}
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/each}
        
        {#if filteredAlgorithms.length === 0}
          <div class="text-center text-white/40 text-sm py-8">
            No algorithms found
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
