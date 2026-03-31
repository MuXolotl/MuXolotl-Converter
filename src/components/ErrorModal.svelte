<script lang="ts">
  import { X, Copy, Check, ExternalLink, Bug, Info, Settings, Monitor, HardDrive } from 'lucide-svelte';
  import { APP_CONFIG } from '@/config';
  import { getSystemInfo } from '@/utils';
  import type { GpuInfo } from '@/types';

  interface ErrorInfo {
    title: string;
    message: string;
    details?: string;
    fileInfo?: {
      name: string;
      path: string;
      format: string;
      outputFormat: string;
      duration?: number;
      size?: number;
    };
    settings?: {
      quality: string;
      useGpu: boolean;
      sampleRate?: number;
      channels?: number;
      width?: number;
      height?: number;
    };
    gpuInfo?: GpuInfo;
  }

  interface Props {
    isOpen: boolean;
    error: ErrorInfo | null;
    onClose: () => void;
  }

  let { isOpen, error, onClose }: Props = $props();

  let copied = $state(false);

  function generateErrorReport(): string {
    if (!error) return '';
    const sys = getSystemInfo();
    const lines: string[] = [
      '## Error Report\n',
      `**Error:** ${error.title}`,
      `**Message:** ${error.message}\n`,
    ];

    if (error.details) {
      lines.push(`### Details\n\`\`\`\n${error.details}\n\`\`\`\n`);
    }

    if (error.fileInfo) {
      lines.push('### File Information');
      lines.push(`- **Name:** ${error.fileInfo.name}`);
      lines.push(`- **Path:** ${error.fileInfo.path}`);
      lines.push(`- **Input Format:** ${error.fileInfo.format}`);
      lines.push(`- **Output Format:** ${error.fileInfo.outputFormat}`);
      if (error.fileInfo.duration) lines.push(`- **Duration:** ${error.fileInfo.duration.toFixed(2)}s`);
      if (error.fileInfo.size) lines.push(`- **Size:** ${(error.fileInfo.size / 1024 / 1024).toFixed(2)} MB`);
      lines.push('');
    }

    if (error.settings) {
      lines.push('### Conversion Settings');
      lines.push(`- **Quality:** ${error.settings.quality}`);
      lines.push(`- **GPU Acceleration:** ${error.settings.useGpu ? 'Enabled' : 'Disabled'}`);
      if (error.settings.sampleRate) lines.push(`- **Sample Rate:** ${error.settings.sampleRate} Hz`);
      if (error.settings.channels) lines.push(`- **Channels:** ${error.settings.channels}`);
      if (error.settings.width && error.settings.height) lines.push(`- **Resolution:** ${error.settings.width}x${error.settings.height}`);
      lines.push('');
    }

    if (error.gpuInfo) {
      lines.push('### GPU Information');
      lines.push(`- **GPU:** ${error.gpuInfo.name}`);
      lines.push(`- **Vendor:** ${error.gpuInfo.vendor}`);
      lines.push(`- **Available:** ${error.gpuInfo.available ? 'Yes' : 'No'}`);
      if (error.gpuInfo.encoder_h264) lines.push(`- **H.264 Encoder:** ${error.gpuInfo.encoder_h264}`);
      lines.push('');
    }

    lines.push('### System Information');
    lines.push(`- **App Version:** ${APP_CONFIG.version}`);
    lines.push(`- **OS:** ${sys.os}`);
    lines.push(`- **Platform:** ${sys.platform}`);
    lines.push(`- **Language:** ${sys.language}`);
    lines.push(`- **Time:** ${new Date().toISOString()}`);

    return lines.join('\n');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generateErrorReport());
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  }

  function handleReportIssue() {
    const title = encodeURIComponent(`[Bug] ${error?.title || 'Conversion Error'}`);
    const body = encodeURIComponent(
      `${generateErrorReport()}\n\n## Steps to Reproduce\n1. \n2. \n3. \n\n## Expected Behavior\n\n## Additional Context\n`,
    );
    window.open(`${APP_CONFIG.github.issues}?title=${title}&body=${body}&labels=bug`, '_blank');
  }

  let sys = $derived(getSystemInfo());
</script>

{#if isOpen && error}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
  >
    <div
      class="w-full max-w-2xl bg-slate-800 rounded-xl shadow-2xl border border-red-500/30 overflow-hidden max-h-[90vh] flex flex-col"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-4 py-3 bg-red-500/10 border-b border-red-500/20 shrink-0"
      >
        <div class="flex items-center gap-2 text-red-400">
          <Bug size={18} />
          <span class="font-semibold">{error.title}</span>
        </div>
        <button
          onclick={onClose}
          class="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p class="text-sm text-red-300">{error.message}</p>
        </div>

        {#if error.details}
          <div>
            <div class="flex items-center gap-1.5 text-xs text-white/40 uppercase mb-2">
              <Info size={14} /><span>Technical Details</span>
            </div>
            <pre
              class="p-3 bg-black/30 rounded-lg text-xs text-white/70 font-mono overflow-auto max-h-24">{error.details}</pre>
          </div>
        {/if}

        {#if error.fileInfo}
          <div>
            <div class="flex items-center gap-1.5 text-xs text-white/40 uppercase mb-2">
              <HardDrive size={14} /><span>File Information</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="p-2 bg-white/5 rounded">
                <div class="text-white/40 text-[10px] uppercase">Name</div>
                <div class="text-white truncate" title={error.fileInfo.name}>{error.fileInfo.name}</div>
              </div>
              <div class="p-2 bg-white/5 rounded">
                <div class="text-white/40 text-[10px] uppercase">Path</div>
                <div class="text-white truncate" title={error.fileInfo.path}>{error.fileInfo.path}</div>
              </div>
              <div class="p-2 bg-white/5 rounded">
                <div class="text-white/40 text-[10px] uppercase">Input Format</div>
                <div class="text-white">{error.fileInfo.format.toUpperCase()}</div>
              </div>
              <div class="p-2 bg-white/5 rounded">
                <div class="text-white/40 text-[10px] uppercase">Output Format</div>
                <div class="text-white text-purple-400">{error.fileInfo.outputFormat.toUpperCase()}</div>
              </div>
              {#if error.fileInfo.duration}
                <div class="p-2 bg-white/5 rounded">
                  <div class="text-white/40 text-[10px] uppercase">Duration</div>
                  <div class="text-white">{error.fileInfo.duration.toFixed(2)}s</div>
                </div>
              {/if}
              {#if error.fileInfo.size}
                <div class="p-2 bg-white/5 rounded">
                  <div class="text-white/40 text-[10px] uppercase">Size</div>
                  <div class="text-white">{(error.fileInfo.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        {#if error.settings}
          <div>
            <div class="flex items-center gap-1.5 text-xs text-white/40 uppercase mb-2">
              <Settings size={14} /><span>Conversion Settings</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs">
              <div class="p-2 bg-white/5 rounded">
                <div class="text-white/40 text-[10px] uppercase">Quality</div>
                <div class="text-white">{error.settings.quality}</div>
              </div>
              <div class="p-2 bg-white/5 rounded">
                <div class="text-white/40 text-[10px] uppercase">GPU</div>
                <div class="text-white {error.settings.useGpu ? 'text-purple-400' : ''}">{error.settings.useGpu ? 'Enabled' : 'Disabled'}</div>
              </div>
              {#if error.settings.sampleRate}
                <div class="p-2 bg-white/5 rounded">
                  <div class="text-white/40 text-[10px] uppercase">Sample Rate</div>
                  <div class="text-white">{error.settings.sampleRate} Hz</div>
                </div>
              {/if}
              {#if error.settings.channels}
                <div class="p-2 bg-white/5 rounded">
                  <div class="text-white/40 text-[10px] uppercase">Channels</div>
                  <div class="text-white">{error.settings.channels}</div>
                </div>
              {/if}
              {#if error.settings.width && error.settings.height}
                <div class="p-2 bg-white/5 rounded">
                  <div class="text-white/40 text-[10px] uppercase">Resolution</div>
                  <div class="text-white">{error.settings.width}×{error.settings.height}</div>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        {#if error.gpuInfo}
          <div>
            <div class="flex items-center gap-1.5 text-xs text-white/40 uppercase mb-2">
              <Monitor size={14} /><span>GPU Information</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="p-2 bg-white/5 rounded">
                <div class="text-white/40 text-[10px] uppercase">GPU</div>
                <div class="text-white">{error.gpuInfo.name}</div>
              </div>
              <div class="p-2 bg-white/5 rounded">
                <div class="text-white/40 text-[10px] uppercase">Vendor</div>
                <div class="text-white">{error.gpuInfo.vendor}</div>
              </div>
              <div class="p-2 bg-white/5 rounded">
                <div class="text-white/40 text-[10px] uppercase">Available</div>
                <div class="text-white {error.gpuInfo.available ? 'text-purple-400' : ''}">{error.gpuInfo.available ? 'Yes' : 'No'}</div>
              </div>
              {#if error.gpuInfo.encoder_h264}
                <div class="p-2 bg-white/5 rounded">
                  <div class="text-white/40 text-[10px] uppercase">H.264</div>
                  <div class="text-white">{error.gpuInfo.encoder_h264}</div>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <div>
          <div class="flex items-center gap-1.5 text-xs text-white/40 uppercase mb-2">
            <Monitor size={14} /><span>System Information</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-xs">
            <div class="p-2 bg-white/5 rounded">
              <div class="text-white/40 text-[10px] uppercase">App Version</div>
              <div class="text-white">{APP_CONFIG.version}</div>
            </div>
            <div class="p-2 bg-white/5 rounded">
              <div class="text-white/40 text-[10px] uppercase">OS</div>
              <div class="text-white">{sys.os}</div>
            </div>
            <div class="p-2 bg-white/5 rounded">
              <div class="text-white/40 text-[10px] uppercase">Platform</div>
              <div class="text-white">{sys.platform}</div>
            </div>
          </div>
        </div>

        <div>
          <div class="flex items-center gap-1.5 text-xs text-white/40 uppercase mb-2">
            <Info size={14} /><span>Common Solutions</span>
          </div>
          <ul class="text-xs text-white/60 space-y-1.5">
            <li class="flex items-start gap-2"><span class="text-purple-400">•</span>Check if the input file is not corrupted or in use</li>
            <li class="flex items-start gap-2"><span class="text-purple-400">•</span>Ensure the output folder has write permissions</li>
            <li class="flex items-start gap-2"><span class="text-purple-400">•</span>Try a different output format (e.g., MP4 for video, MP3 for audio)</li>
            <li class="flex items-start gap-2"><span class="text-purple-400">•</span>Disable GPU acceleration if experiencing GPU-related errors</li>
            <li class="flex items-start gap-2"><span class="text-purple-400">•</span>Check if FFmpeg binaries are properly installed</li>
          </ul>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center gap-2 p-4 border-t border-white/10 bg-black/20 shrink-0">
        <button
          onclick={handleCopy}
          class="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/80 flex items-center justify-center gap-2 transition-colors"
        >
          {#if copied}
            <Check size={16} class="text-green-400" /> Copied!
          {:else}
            <Copy size={16} /> Copy Report
          {/if}
        </button>
        <button
          onclick={handleReportIssue}
          class="flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-sm text-white font-medium flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-purple-500/20"
        >
          <ExternalLink size={16} /> Report on GitHub
        </button>
      </div>
    </div>
  </div>
{/if}