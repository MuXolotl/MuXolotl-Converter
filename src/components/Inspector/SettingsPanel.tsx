import { memo } from 'react';
import { QUALITY_OPTIONS, AUDIO_SAMPLE_RATES, AUDIO_CHANNELS, VIDEO_RESOLUTIONS, VIDEO_FPS } from '@/constants';
import type { FileItem, FileSettings } from '@/types';
import type { TabId } from './Tabs';

interface SettingsPanelProps {
  file: FileItem;
  activeTab: TabId;
  disabled: boolean;
  onChange: (updates: Partial<FileSettings>) => void;
}

function SettingsPanel({ file, activeTab, disabled, onChange }: SettingsPanelProps) {
  const isVideo = file.mediaInfo?.media_type === 'video';
  const extractAudio = file.settings.extractAudioOnly;

  if (activeTab === 'general') {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-4">
          <div className="text-[10px] uppercase text-blue-400 font-bold tracking-wider mb-1">Optimization</div>
          <p className="text-xs text-blue-200/70">Select a quality preset. "Custom" allows manual bitrate control.</p>
        </div>

        <SettingRow label="Quality Preset">
          <Select
            value={file.settings.quality}
            onChange={e => onChange({ quality: e.target.value as FileSettings['quality'] })}
            disabled={disabled}
            options={QUALITY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          />
        </SettingRow>

        {isVideo && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <label className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-white/5 rounded transition-colors">
              <input
                type="checkbox"
                checked={file.settings.extractAudioOnly}
                onChange={e => onChange({ extractAudioOnly: e.target.checked })}
                disabled={disabled}
              />
              <div>
                <div className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">Extract Audio</div>
                <div className="text-xs text-white/40">Convert video file to audio only</div>
              </div>
            </label>
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'video' && !extractAudio) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <SettingRow label="Resolution">
          <Select
            value={file.settings.width && file.settings.height ? `${file.settings.width}x${file.settings.height}` : 'original'}
            onChange={e => {
              const val = e.target.value;
              if (val === 'original') {
                onChange({ width: undefined, height: undefined });
              } else {
                const [w, h] = val.split('x').map(Number);
                onChange({ width: w, height: h });
              }
            }}
            disabled={disabled}
            options={VIDEO_RESOLUTIONS.map(r => ({ value: r.value, label: r.label }))}
          />
        </SettingRow>

        <SettingRow label="Frame Rate">
          <Select
            value={file.settings.fps?.toString() || 'original'}
            onChange={e => onChange({ fps: e.target.value === 'original' ? undefined : parseInt(e.target.value) })}
            disabled={disabled}
            options={VIDEO_FPS.map(f => ({ value: f.value, label: f.label }))}
          />
        </SettingRow>
      </div>
    );
  }

  if (activeTab === 'audio') {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <SettingRow label="Sample Rate">
          <Select
            value={file.settings.sampleRate?.toString() || '44100'}
            onChange={e => onChange({ sampleRate: parseInt(e.target.value) })}
            disabled={disabled}
            options={AUDIO_SAMPLE_RATES.map(r => ({ value: r.toString(), label: `${r} Hz` }))}
          />
        </SettingRow>

        <SettingRow label="Channels">
          <Select
            value={file.settings.channels?.toString() || '2'}
            onChange={e => onChange({ channels: parseInt(e.target.value) })}
            disabled={disabled}
            options={AUDIO_CHANNELS.map(c => ({ value: c.value.toString(), label: c.label }))}
          />
        </SettingRow>

        {file.settings.quality === 'custom' && (
          <SettingRow label="Bitrate (kbps)">
            <input
              type="number"
              value={file.settings.bitrate || 192}
              onChange={e => onChange({ bitrate: parseInt(e.target.value) })}
              disabled={disabled}
              min={64}
              max={320}
              step={32}
              className="w-full px-3 py-2 bg-[#0f172a] border border-white/10 rounded text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </SettingRow>
        )}
      </div>
    );
  }

  if (activeTab === 'metadata') {
    return (
      <div className="text-center py-8 text-white/30 text-xs">
        Metadata editing coming soon...
      </div>
    );
  }

  return null;
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group">
      <label className="block text-[11px] font-medium text-slate-400 mb-1.5 group-hover:text-slate-300 transition-colors">
        {label}
      </label>
      {children}
    </div>
  );
}

interface SelectProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled: boolean;
  options: Array<{ value: string; label: string }>;
}

function Select({ value, onChange, disabled, options }: SelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full px-3 py-2.5 bg-[#0f172a] border border-white/10 rounded text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer appearance-none"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

export default memo(SettingsPanel);