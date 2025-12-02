import { memo, useState, useCallback } from 'react';
import { X, Copy, Check, ExternalLink, Bug, Info, Settings, Monitor, HardDrive } from 'lucide-react';
import { APP_CONFIG } from '@/config';
import { getSystemInfo } from '@/utils';
import type { GpuInfo, SystemInfo } from '@/types';

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

interface ErrorModalProps {
  isOpen: boolean;
  error: ErrorInfo | null;
  onClose: () => void;
}

function ErrorModal({ isOpen, error, onClose }: ErrorModalProps) {
  const [copied, setCopied] = useState(false);

  const generateErrorReport = useCallback(() => {
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
      if (error.fileInfo.duration) {
        lines.push(`- **Duration:** ${error.fileInfo.duration.toFixed(2)}s`);
      }
      if (error.fileInfo.size) {
        lines.push(`- **Size:** ${(error.fileInfo.size / 1024 / 1024).toFixed(2)} MB`);
      }
      lines.push('');
    }

    if (error.settings) {
      lines.push('### Conversion Settings');
      lines.push(`- **Quality:** ${error.settings.quality}`);
      lines.push(`- **GPU Acceleration:** ${error.settings.useGpu ? 'Enabled' : 'Disabled'}`);
      if (error.settings.sampleRate) lines.push(`- **Sample Rate:** ${error.settings.sampleRate} Hz`);
      if (error.settings.channels) lines.push(`- **Channels:** ${error.settings.channels}`);
      if (error.settings.width && error.settings.height) {
        lines.push(`- **Resolution:** ${error.settings.width}x${error.settings.height}`);
      }
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
  }, [error]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generateErrorReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  }, [generateErrorReport]);

  const handleReportIssue = useCallback(() => {
    const title = encodeURIComponent(`[Bug] ${error?.title || 'Conversion Error'}`);
    const body = encodeURIComponent(
      `${generateErrorReport()}\n\n## Steps to Reproduce\n1. \n2. \n3. \n\n## Expected Behavior\n\n## Additional Context\n`
    );
    window.open(`${APP_CONFIG.github.issues}?title=${title}&body=${body}&labels=bug`, '_blank');
  }, [error, generateErrorReport]);

  if (!isOpen || !error) return null;

  const sys = getSystemInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-800 rounded-xl shadow-2xl border border-red-500/30 overflow-hidden max-h-[90vh] flex flex-col">
        <ModalHeader title={error.title} onClose={onClose} />

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-300">{error.message}</p>
          </div>

          {error.details && (
            <Section icon={<Info size={14} />} title="Technical Details">
              <pre className="p-3 bg-black/30 rounded-lg text-xs text-white/70 font-mono overflow-auto max-h-24">
                {error.details}
              </pre>
            </Section>
          )}

          {error.fileInfo && (
            <Section icon={<HardDrive size={14} />} title="File Information">
              <InfoGrid>
                <InfoItem label="Name" value={error.fileInfo.name} truncate />
                <InfoItem label="Path" value={error.fileInfo.path} truncate />
                <InfoItem label="Input Format" value={error.fileInfo.format.toUpperCase()} />
                <InfoItem label="Output Format" value={error.fileInfo.outputFormat.toUpperCase()} highlight />
                {error.fileInfo.duration && (
                  <InfoItem label="Duration" value={`${error.fileInfo.duration.toFixed(2)}s`} />
                )}
                {error.fileInfo.size && (
                  <InfoItem label="Size" value={`${(error.fileInfo.size / 1024 / 1024).toFixed(2)} MB`} />
                )}
              </InfoGrid>
            </Section>
          )}

          {error.settings && (
            <Section icon={<Settings size={14} />} title="Conversion Settings">
              <InfoGrid cols={3}>
                <InfoItem label="Quality" value={error.settings.quality} />
                <InfoItem label="GPU" value={error.settings.useGpu ? 'Enabled' : 'Disabled'} highlight={error.settings.useGpu} />
                {error.settings.sampleRate && <InfoItem label="Sample Rate" value={`${error.settings.sampleRate} Hz`} />}
                {error.settings.channels && <InfoItem label="Channels" value={String(error.settings.channels)} />}
                {error.settings.width && error.settings.height && (
                  <InfoItem label="Resolution" value={`${error.settings.width}×${error.settings.height}`} />
                )}
              </InfoGrid>
            </Section>
          )}

          {error.gpuInfo && (
            <Section icon={<Monitor size={14} />} title="GPU Information">
              <InfoGrid>
                <InfoItem label="GPU" value={error.gpuInfo.name} />
                <InfoItem label="Vendor" value={error.gpuInfo.vendor} />
                <InfoItem label="Available" value={error.gpuInfo.available ? 'Yes' : 'No'} highlight={error.gpuInfo.available} />
                {error.gpuInfo.encoder_h264 && <InfoItem label="H.264" value={error.gpuInfo.encoder_h264} />}
              </InfoGrid>
            </Section>
          )}

          <Section icon={<Monitor size={14} />} title="System Information">
            <InfoGrid cols={3}>
              <InfoItem label="App Version" value={APP_CONFIG.version} />
              <InfoItem label="OS" value={sys.os} />
              <InfoItem label="Platform" value={sys.platform} />
            </InfoGrid>
          </Section>

          <Section icon={<Info size={14} />} title="Common Solutions">
            <ul className="text-xs text-white/60 space-y-1.5">
              <SolutionItem>Check if the input file is not corrupted or in use</SolutionItem>
              <SolutionItem>Ensure the output folder has write permissions</SolutionItem>
              <SolutionItem>Try a different output format (e.g., MP4 for video, MP3 for audio)</SolutionItem>
              <SolutionItem>Disable GPU acceleration if experiencing GPU-related errors</SolutionItem>
              <SolutionItem>Check if FFmpeg binaries are properly installed</SolutionItem>
            </ul>
          </Section>
        </div>

        <div className="flex items-center gap-2 p-4 border-t border-white/10 bg-black/20 shrink-0">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/80 flex items-center justify-center gap-2 transition-colors"
          >
            {copied ? <><Check size={16} className="text-green-400" /> Copied!</> : <><Copy size={16} /> Copy Report</>}
          </button>
          <button
            onClick={handleReportIssue}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-sm text-white font-medium flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-purple-500/20"
          >
            <ExternalLink size={16} /> Report on GitHub
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border-b border-red-500/20 shrink-0">
      <div className="flex items-center gap-2 text-red-400">
        <Bug size={18} />
        <span className="font-semibold">{title}</span>
      </div>
      <button
        onClick={onClose}
        className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-white/40 uppercase mb-2">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function InfoGrid({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return <div className={`grid grid-cols-${cols} gap-2 text-xs`}>{children}</div>;
}

function InfoItem({ label, value, truncate, highlight }: { label: string; value: string; truncate?: boolean; highlight?: boolean }) {
  return (
    <div className="p-2 bg-white/5 rounded">
      <div className="text-white/40 text-[10px] uppercase">{label}</div>
      <div className={`text-white ${truncate ? 'truncate' : ''} ${highlight ? 'text-purple-400' : ''}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function SolutionItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-purple-400">•</span>
      {children}
    </li>
  );
}

export default memo(ErrorModal);