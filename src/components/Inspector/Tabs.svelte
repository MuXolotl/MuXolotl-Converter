<script lang="ts">
  import { Settings, Film, Music, FileText } from 'lucide-svelte';

  export type TabId = 'general' | 'video' | 'audio' | 'metadata';

  interface TabDef {
    id: TabId;
    label: string;
    shortLabel: string;
    icon: typeof Settings;
  }

  const TABS: TabDef[] = [
    { id: 'general', label: 'Format', shortLabel: 'Fmt', icon: Settings },
    { id: 'video', label: 'Video', shortLabel: 'Vid', icon: Film },
    { id: 'audio', label: 'Audio', shortLabel: 'Aud', icon: Music },
    { id: 'metadata', label: 'Meta', shortLabel: 'Meta', icon: FileText },
  ];

  interface Props {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
    hasVideo: boolean;
    hasAudio: boolean;
  }

  let { activeTab, onTabChange, hasVideo, hasAudio }: Props = $props();
</script>

<div class="flex items-center gap-0.5 p-0.5 bg-black/20 rounded-lg mb-3">
  {#each TABS as tab (tab.id)}
    {@const isDisabled = (tab.id === 'video' && !hasVideo) || (tab.id === 'audio' && !hasAudio)}
    {@const Icon = tab.icon}
    <button
      onclick={() => !isDisabled && onTabChange(tab.id)}
      disabled={isDisabled}
      class="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded text-[10px] font-medium transition-all min-w-0
        {isDisabled
          ? 'opacity-30 cursor-not-allowed'
          : activeTab === tab.id
            ? 'bg-[#3b82f6] text-white shadow-lg shadow-blue-900/20'
            : 'text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer'}"
      title={tab.label}
    >
      <Icon size={12} class="shrink-0" />
      <span class="truncate">{tab.shortLabel}</span>
    </button>
  {/each}
</div>