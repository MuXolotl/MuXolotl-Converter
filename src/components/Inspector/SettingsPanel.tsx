import React from 'react';
import { QUALITY_OPTIONS, AUDIO_SAMPLE_RATES, AUDIO_CHANNELS, VIDEO_RESOLUTIONS, VIDEO_FPS } from '@/constants';
import type { FileItem, FileSettings } from '@/types';

interface SettingsPanelProps {
  file: FileItem;
  disabled: boolean;
  onChange: (updates: Partial<FileSettings>) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ file, disabled, onChange }) => {
  const isAudio = file.mediaInfo?.media_type === 'audio' || file.settings.extractAudioOnly;

  return (
    <div className="space-y-4">
      {/* Quality */}
      <SettingRow label="Quality">
        <Select
          value={file.settings.quality}
          onChange={e => onChange({ quality: e.target.value as FileSettings['quality'] })}
          disabled={disabled}
          options={QUALITY_OPTIONS}
        />
      </SettingRow>

      {isAudio ? (
        <AudioSettings file={file} disabled={disabled} onChange={onChange} />
      ) : (
        <VideoSettings file={file} disabled={disabled} onChange={onChange} />
      )}

      {/* GPU Toggle (video only) */}
      {!isAudio && (
        <SettingRow label="GPU Acceleration">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={file.settings.useGpu}
              onChange={e => onChange({ useGpu: e.target.checked })}
              disabled={disabled}
              className="w-4 h-4 rounded bg-white/10 border-white/20 checked:bg-purple-500 disabled:opacity-50"
            />
            <span className="text-xs text-white/60">
              {file.settings.useGpu ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </SettingRow>
      )}
    </div>
  );
};

const AudioSettings: React.FC<SettingsPanelProps> = ({ file, disabled, onChange }) => (
  <>
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
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
        />
      </SettingRow>
    )}
  </>
);

const VideoSettings: React.FC<SettingsPanelProps> = ({ file, disabled, onChange }) => {
  const handleResolutionChange = (value: string) => {
    if (value === 'original') {
      onChange({ width: undefined, height: undefined });
    } else {
      const [w, h] = value.split('x').map(Number);
      onChange({ width: w, height: h });
    }
  };

  const currentResolution = file.settings.width && file.settings.height
    ? `${file.settings.width}x${file.settings.height}`
    : 'original';

  return (
    <>
      <SettingRow label="Resolution">
        <Select
          value={currentResolution}
          onChange={e => handleResolutionChange(e.target.value)}
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
    </>
  );
};

// Shared components

interface SettingRowProps {
  label: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4">
    <label className="text-xs text-white/60 shrink-0">{label}</label>
    <div className="flex-1 max-w-[180px]">{children}</div>
  </div>
);

interface SelectProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled: boolean;
  options: Array<{ value: string; label: string }>;
}

const Select: React.FC<SelectProps> = ({ value, onChange, disabled, options }) => (
  <select
    value={value}
    onChange={onChange}
    disabled={disabled}
    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 cursor-pointer"
  >
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

export default React.memo(SettingsPanel);