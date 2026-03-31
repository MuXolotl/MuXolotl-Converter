<script lang="ts">
  import { Layers, MessageSquarePlus, Github } from 'lucide-svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { APP_CONFIG } from '@/config';

  interface Props {
    onFeedbackClick: () => void;
  }

  let { onFeedbackClick }: Props = $props();

  function openGithub() {
    invoke('open_folder', { path: APP_CONFIG.github.repo }).catch(() => {});
  }
</script>

<div class="w-12 h-full flex flex-col items-center py-3 bg-[#0f172a] border-r border-white/5 select-none z-20">
  <div class="flex-1 flex flex-col gap-3 w-full">
    <button
      class="relative w-full h-10 flex items-center justify-center transition-all text-blue-400"
      title="Queue"
    >
      <div class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
      <Layers size={20} strokeWidth={2.5} />
    </button>
  </div>

  <div class="flex flex-col gap-3 w-full pb-2">
    <button
      onclick={onFeedbackClick}
      class="relative w-full h-10 flex items-center justify-center transition-all text-slate-500 hover:text-slate-300"
      title="Send Feedback"
    >
      <MessageSquarePlus size={20} strokeWidth={2} />
    </button>
    <button
      onclick={openGithub}
      class="relative w-full h-10 flex items-center justify-center transition-all text-slate-500 hover:text-slate-300"
      title="GitHub"
    >
      <Github size={20} strokeWidth={2} />
    </button>
  </div>
</div>