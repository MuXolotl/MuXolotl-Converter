import React, { useCallback, useState } from 'react';
import { X, Copy, Check, ExternalLink, Bug, Info, Settings, Monitor, HardDrive } from 'lucide-react';
import type { GpuInfo } from '@/types';

interface ErrorModalProps {
  isOpen: boolean;
  error: {
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
  } | null;
  onClose: () => void;
}

const GITHUB_ISSUES_URL = 'https://github.com/MuXolotl/MuXolotl-Converter/issues/new';
const APP_VERSION = '1.0.2';

const ErrorModal: React.FC<ErrorModalProps> = ({ isOpen, error, onClose }) => {
  const [copied, setCopied] = useState(false);

  const getSystemInfo = useCallback(() => {
    const ua = navigator.userAgent;
    let os = 'Unknown';
    
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    
    return {
      os,
      platform: navigator.platform,
      language: navigator.language,
    };
  }, []);

  const getErrorText = useCallback(() => {
    if (!error) return '';
    
    const sys = getSystemInfo();
    
    let text = `## Error Report\n\n`;
    text += `**Error:** ${error.title}\n`;
    text += `**Message:** ${error.message}\n\n`;
    
    if (error.details) {
      text += `### Details\n\`\`\`\n${error.details}\n\`\`\`\n\n`;
    }
    
    if (error.fileInfo) {
      text += `### File Information\n`;
      text += `- **Name:** ${error.fileInfo.name}\n`;
      text += `- **Path:** ${error.fileInfo.path}\n`;
      text += `- **Input Format:** ${error.fileInfo.format}\n`;
      text += `- **Output Format:** ${error.fileInfo.outputFormat}\n`;
      if (error.fileInfo.duration) {
        text += `- **Duration:** ${error.fileInfo.duration.toFixed(2)}s\n`;
      }
      if (error.fileInfo.size) {
        text += `- **Size:** ${(error.fileInfo.size / 1024 / 1024).toFixed(2)} MB\n`;
      }
      text += `\n`;
    }
    
    if (error.settings) {
      text += `### Conversion Settings\n`;
      text += `- **Quality:** ${error.settings.quality}\n`;
      text += `- **GPU Acceleration:** ${error.settings.useGpu ? 'Enabled' : 'Disabled'}\n`;
      if (error.settings.sampleRate) text += `- **Sample Rate:** ${error.settings.sampleRate} Hz\n`;
      if (error.settings.channels) text += `- **Channels:** ${error.settings.channels}\n`;
      if (error.settings.width && error.settings.height) {
        text += `- **Resolution:** ${error.settings.width}x${error.settings.height}\n`;
      }
      text += `\n`;
    }
    
    if (error.gpuInfo) {
      text += `### GPU Information\n`;
      text += `- **GPU:** ${error.gpuInfo.name}\n`;
      text += `- **Vendor:** ${error.gpuInfo.vendor}\n`;
      text += `- **Available:** ${error.gpuInfo.available ? 'Yes' : 'No'}\n`;
      if (error.gpuInfo.encoder_h264) text += `- **H.264 Encoder:** ${error.gpuInfo.encoder_h264}\n`;
      if (error.gpuInfo.encoder_h265) text += `- **H.265 Encoder:** ${error.gpuInfo.encoder_h265}\n`;
      text += `\n`;
    }
    
    text += `### System Information\n`;
    text += `- **App Version:** ${APP_VERSION}\n`;
    text += `- **OS:** ${sys.os}\n`;
    text += `- **Platform:** ${sys.platform}\n`;
    text += `- **Language:** ${sys.language}\n`;
    text += `- **Time:** ${new Date().toISOString()}\n`;
    
    return text;
  }, [error, getSystemInfo]);

  const handleCopy = useCallback(async () => {
    const text = getErrorText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  }, [getErrorText]);

  const handleReportIssue = useCallback(() => {
    const text = getErrorText();
    const title = encodeURIComponent(`[Bug] ${error?.title || 'Conversion Error'}`);
    const body = encodeURIComponent(`${text}\n\n## Steps to Reproduce\n1. \n2. \n3. \n\n## Expected Behavior\n\n## Additional Context\n`);
    
    window.open(`${GITHUB_ISSUES_URL}?title=${title}&body=${body}&labels=bug`, '_blank');
  }, [error, getErrorText]);

  if (!isOpen || !error) return null;

  const sys = getSystemInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-800 rounded-xl shadow-2xl border border-red-500/30 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border-b border-red-500/20 shrink-0">
          <div className="flex items-center gap-2 text-red-400">
            <Bug size={18} />
            <span className="font-semibold">{error.title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Error Message */}
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-300">{error.message}</p>
          </div>

          {/* Details */}
          {error.details && (
            <Section icon={<Info size={14} />} title="Technical Details">
              <pre className="p-3 bg-black/30 rounded-lg text-xs text-white/70 font-mono overflow-auto max-h-24">
                {error.details}
              </pre>
            </Section>
          )}

          {/* File Info */}
          {error.fileInfo && (
            <Section icon={<HardDrive size={14} />} title="File Information">
              <div className="grid grid-cols-2 gap-2 text-xs">
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
              </div>
            </Section>
          )}

          {/* Settings */}
          {error.settings && (
            <Section icon={<Settings size={14} />} title="Conversion Settings">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <InfoItem label="Quality" value={error.settings.quality} />
                <InfoItem 
                  label="GPU" 
                  value={error.settings.useGpu ? 'Enabled' : 'Disabled'} 
                  highlight={error.settings.useGpu}
                />
                {error.settings.sampleRate && (
                  <InfoItem label="Sample Rate" value={`${error.settings.sampleRate} Hz`} />
                )}
                {error.settings.channels && (
                  <InfoItem label="Channels" value={String(error.settings.channels)} />
                )}
                {error.settings.width && error.settings.height && (
                  <InfoItem label="Resolution" value={`${error.settings.width}×${error.settings.height}`} />
                )}
              </div>
            </Section>
          )}

          {/* GPU Info */}
          {error.gpuInfo && (
            <Section icon={<Monitor size={14} />} title="GPU Information">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <InfoItem label="GPU" value={error.gpuInfo.name} />
                <InfoItem label="Vendor" value={error.gpuInfo.vendor} />
                <InfoItem 
                  label="Available" 
                  value={error.gpuInfo.available ? 'Yes' : 'No'} 
                  highlight={error.gpuInfo.available}
                />
                {error.gpuInfo.encoder_h264 && (
                  <InfoItem label="H.264" value={error.gpuInfo.encoder_h264} />
                )}
              </div>
            </Section>
          )}

          {/* System Info */}
          <Section icon={<Monitor size={14} />} title="System Information">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <InfoItem label="App Version" value={APP_VERSION} />
              <InfoItem label="OS" value={sys.os} />
              <InfoItem label="Platform" value={sys.platform} />
            </div>
          </Section>

          {/* Common Solutions */}
          <Section icon={<Info size={14} />} title="Common Solutions">
            <ul className="text-xs text-white/60 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                Check if the input file is not corrupted or in use by another program
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                Ensure the output folder has write permissions and enough free space
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                Try a different output format (e.g., MP4 for video, MP3 for audio)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                Disable GPU acceleration if you're experiencing GPU-related errors
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                Check if FFmpeg binaries are properly installed
              </li>
            </ul>
          </Section>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 p-4 border-t border-white/10 bg-black/20 shrink-0">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/80 flex items-center justify-center gap-2 transition-colors"
          >
            {copied ? (
              <>
                <Check size={16} className="text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy size={16} />
                Copy Report
              </>
            )}
          </button>
          
          <button
            onClick={handleReportIssue}
            className="flex-1 py-2.5 px-4 bg-gradient-primary rounded-lg text-sm text-white font-medium flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-purple-500/20"
          >
            <ExternalLink size={16} />
            Report on GitHub
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper Components

const Section: React.FC<{ 
  icon: React.ReactNode; 
  title: string; 
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <div>
    <div className="flex items-center gap-1.5 text-xs text-white/40 uppercase mb-2">
      {icon}
      <span>{title}</span>
    </div>
    {children}
  </div>
);

const InfoItem: React.FC<{ 
  label: string; 
  value: string; 
  truncate?: boolean;
  highlight?: boolean;
}> = ({ label, value, truncate, highlight }) => (
  <div className="p-2 bg-white/5 rounded">
    <div className="text-white/40 text-[10px] uppercase">{label}</div>
    <div className={`text-white ${truncate ? 'truncate' : ''} ${highlight ? 'text-purple-400' : ''}`} title={value}>
      {value}
    </div>
  </div>
);

export default React.memo(ErrorModal);