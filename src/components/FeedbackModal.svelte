<script lang="ts">
  import { X, Bug, Lightbulb, ExternalLink, Send, ChevronDown, Monitor } from 'lucide-svelte';
  import { APP_CONFIG } from '@/config';
  import { getSystemInfo } from '@/utils';
  import type { GpuInfo, QueueStats } from '@/types';

  type FeedbackType = 'bug' | 'feature';
  type Severity = 'low' | 'medium' | 'high' | 'critical';
  type FeedbackCategory = 'conversion' | 'ui' | 'performance' | 'crash' | 'other';

  const CATEGORIES: { value: FeedbackCategory; label: string; icon: string }[] = [
    { value: 'conversion', label: 'Conversion Issue', icon: '🔄' },
    { value: 'ui', label: 'User Interface', icon: '🎨' },
    { value: 'performance', label: 'Performance', icon: '⚡' },
    { value: 'crash', label: 'Crash/Freeze', icon: '💥' },
    { value: 'other', label: 'Other', icon: '📝' },
  ];

  const SEVERITIES: { value: Severity; label: string }[] = [
    { value: 'low', label: 'Low - Minor inconvenience' },
    { value: 'medium', label: 'Medium - Affects workflow' },
    { value: 'high', label: 'High - Major functionality broken' },
    { value: 'critical', label: 'Critical - App unusable' },
  ];

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    gpuInfo?: GpuInfo;
    stats?: QueueStats;
  }

  let { isOpen, onClose, gpuInfo, stats }: Props = $props();

  let type = $state<FeedbackType>('bug');
  let category = $state<FeedbackCategory>('conversion');
  let severity = $state<Severity>('medium');
  let title = $state('');
  let description = $state('');
  let stepsToReproduce = $state('');
  let expectedBehavior = $state('');
  let includeSystemInfo = $state(true);

  let sys = $derived(getSystemInfo());

  function generateIssueBody(): string {
    const lines: string[] = [];

    if (type === 'bug') {
      lines.push('## Bug Report\n');
      lines.push(`**Category:** ${CATEGORIES.find((c) => c.value === category)?.label}`);
      lines.push(`**Severity:** ${SEVERITIES.find((s) => s.value === severity)?.label}\n`);
      lines.push(`## Description\n${description || '_No description provided_'}\n`);
      lines.push(`## Steps to Reproduce\n${stepsToReproduce || '1. \n2. \n3. '}\n`);
      lines.push(`## Expected Behavior\n${expectedBehavior || '_No expected behavior provided_'}\n`);
    } else {
      lines.push('## Feature Request\n');
      lines.push(`## Description\n${description || '_No description provided_'}\n`);
      lines.push(`## Use Case\n${stepsToReproduce || '_Why do you need this feature?_'}\n`);
      lines.push(`## Proposed Solution\n${expectedBehavior || '_How do you think this should work?_'}\n`);
    }

    if (includeSystemInfo) {
      lines.push('## System Information');
      lines.push(`- **App Version:** ${APP_CONFIG.version}`);
      lines.push(`- **OS:** ${sys.os}`);
      lines.push(`- **Platform:** ${sys.platform}`);
      if (gpuInfo) {
        lines.push(`- **GPU:** ${gpuInfo.name} (${gpuInfo.vendor})`);
        lines.push(`- **GPU Available:** ${gpuInfo.available ? 'Yes' : 'No'}`);
      }
      if (stats) {
        lines.push(`- **Queue Stats:** ${stats.total} total, ${stats.completed} completed, ${stats.failed} failed`);
      }
    }

    return lines.join('\n');
  }

  function handleSubmit() {
    const issueTitle = encodeURIComponent(
      type === 'bug' ? `[Bug] ${title || 'Bug Report'}` : `[Feature] ${title || 'Feature Request'}`,
    );
    const issueBody = encodeURIComponent(generateIssueBody());
    const labels = type === 'bug' ? 'bug' : 'enhancement';
    window.open(`${APP_CONFIG.github.issues}?title=${issueTitle}&body=${issueBody}&labels=${labels}`, '_blank');
    handleClose();
  }

  function handleClose() {
    title = '';
    description = '';
    stepsToReproduce = '';
    expectedBehavior = '';
    category = 'conversion';
    severity = 'medium';
    onClose();
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <div class="w-full max-w-2xl bg-slate-800 rounded-xl shadow-2xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-2">
          <Send size={18} class="text-purple-400" />
          <span class="font-semibold text-white">Send Feedback</span>
        </div>
        <button onclick={handleClose} class="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors">
          <X size={18} />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Type selector -->
        <div class="flex gap-2">
          <button
            onclick={() => (type = 'bug')}
            class="flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all
              {type === 'bug'
                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-red-500/10 hover:border-red-500/30'}"
          >
            <Bug size={18} />
            <span class="font-medium">Report Bug</span>
          </button>
          <button
            onclick={() => (type = 'feature')}
            class="flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all
              {type === 'feature'
                ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-yellow-500/10 hover:border-yellow-500/30'}"
          >
            <Lightbulb size={18} />
            <span class="font-medium">Request Feature</span>
          </button>
        </div>

        <!-- Title -->
        <div>
          <label class="block text-xs text-white/60 mb-1.5" for="feedback-title">
            Title <span class="text-red-400">*</span>
          </label>
          <input
            id="feedback-title"
            type="text"
            bind:value={title}
            placeholder={type === 'bug' ? 'Brief description of the issue' : 'What feature would you like?'}
            class="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500"
          />
        </div>

        <!-- Bug-specific fields -->
        {#if type === 'bug'}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-white/60 mb-1.5" for="feedback-category">Category</label>
              <div class="relative">
                <select
                  id="feedback-category"
                  bind:value={category}
                  class="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-purple-500"
                >
                  {#each CATEGORIES as cat (cat.value)}
                    <option value={cat.value}>{cat.icon} {cat.label}</option>
                  {/each}
                </select>
                <ChevronDown size={14} class="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-white/60 mb-1.5" for="feedback-severity">Severity</label>
              <div class="relative">
                <select
                  id="feedback-severity"
                  bind:value={severity}
                  class="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-purple-500"
                >
                  {#each SEVERITIES as sev (sev.value)}
                    <option value={sev.value}>{sev.label}</option>
                  {/each}
                </select>
                <ChevronDown size={14} class="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
            </div>
          </div>
        {/if}

        <!-- Description -->
        <div>
          <label class="block text-xs text-white/60 mb-1.5" for="feedback-description">
            Description <span class="text-red-400">*</span>
          </label>
          <textarea
            id="feedback-description"
            bind:value={description}
            placeholder={type === 'bug' ? 'Describe what happened...' : 'Describe the feature you want...'}
            rows={3}
            class="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-purple-500"
          ></textarea>
        </div>

        <!-- Steps / Use case -->
        <div>
          <label class="block text-xs text-white/60 mb-1.5" for="feedback-steps">
            {type === 'bug' ? 'Steps to Reproduce' : 'Use Case'}
          </label>
          <textarea
            id="feedback-steps"
            bind:value={stepsToReproduce}
            placeholder={type === 'bug' ? '1. Go to...\n2. Click on...\n3. See error' : 'Why do you need this feature?'}
            rows={3}
            class="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-purple-500"
          ></textarea>
        </div>

        <!-- Expected / Proposed -->
        <div>
          <label class="block text-xs text-white/60 mb-1.5" for="feedback-expected">
            {type === 'bug' ? 'Expected Behavior' : 'Proposed Solution'}
          </label>
          <textarea
            id="feedback-expected"
            bind:value={expectedBehavior}
            placeholder={type === 'bug' ? 'What should have happened?' : 'How should this feature work?'}
            rows={2}
            class="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-purple-500"
          ></textarea>
        </div>

        <!-- System info toggle -->
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/[0.07] transition-colors">
          <input type="checkbox" bind:checked={includeSystemInfo} class="w-4 h-4 rounded bg-white/10 border-white/20 checked:bg-purple-500" />
          <div class="flex-1">
            <div class="text-sm text-white">Include System Information</div>
            <div class="text-xs text-white/40">OS, App version, GPU info — helps us fix issues faster</div>
          </div>
        </label>

        {#if includeSystemInfo}
          <div class="p-3 bg-black/20 rounded-lg text-xs text-white/50 space-y-1">
            <div class="flex items-center gap-2 text-white/70 mb-2">
              <Monitor size={12} />
              <span>System info that will be included:</span>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 pl-5">
              <span>App Version: {APP_CONFIG.version}</span>
              <span>OS: {sys.os}</span>
              <span>Platform: {sys.platform}</span>
              {#if gpuInfo}
                <span>GPU: {gpuInfo.name}</span>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-3 p-4 border-t border-white/10 bg-black/20 shrink-0">
        <button onclick={handleClose} class="px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors">
          Cancel
        </button>
        <button
          onclick={handleSubmit}
          disabled={!title.trim() || !description.trim()}
          class="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-sm text-white font-medium flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ExternalLink size={16} /> Open on GitHub
        </button>
      </div>
    </div>
  </div>
{/if}