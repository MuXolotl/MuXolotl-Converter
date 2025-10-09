import React from 'react';
import { AUDIO_SAMPLE_RATES, AUDIO_CHANNELS, VIDEO_RESOLUTIONS, VIDEO_FPS } from '@/constants';
import type { FileSettings } from '@/types';

interface AdvancedSettingsProps {
  isOpen: boolean;
  isAudio: boolean;
  extractAudioOnly: boolean;
  settings: FileSettings;
  disabled: boolean;
  onSettingChange: (updates: Partial<FileSettings>) => void;
}

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  isOpen,
  isAudio,
  extractAudioOnly,
  settings,
  disabled,
  onSettingChange,
}) => {
  const selectClassName =
    'w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-primary-purple cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const showAudioSettings = isAudio || extractAudioOnly;

  if (disabled) return null;

  return (
    <div
      className={`overflow-hidden transition-all duration-200 ${
        isOpen ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="grid grid-cols-2 gap-3">
        {showAudioSettings && (
          <>
            <div>
              <label className="block text-white/60 text-xs mb-1">Sample Rate</label>
              <select
                value={settings.sampleRate || 44100}
                onChange={e => onSettingChange({ sampleRate: parseInt(e.target.value) })}
                className={selectClassName}
              >
                {AUDIO_SAMPLE_RATES.map(rate => (
                  <option key={rate} value={rate}>
                    {rate} Hz
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white/60 text-xs mb-1">Channels</label>
              <select
                value={settings.channels || 2}
                onChange={e => onSettingChange({ channels: parseInt(e.target.value) })}
                className={selectClassName}
              >
                {AUDIO_CHANNELS.map(ch => (
                  <option key={ch.value} value={ch.value}>
                    {ch.label}
                  </option>
                ))}
              </select>
            </div>

            {settings.quality === 'custom' && (
              <div>
                <label className="block text-white/60 text-xs mb-1">Bitrate (kbps)</label>
                <input
                  type="number"
                  value={settings.bitrate || 192}
                  onChange={e => onSettingChange({ bitrate: parseInt(e.target.value) })}
                  min="64"
                  max="320"
                  step="32"
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-primary-purple"
                />
              </div>
            )}
          </>
        )}

        {!isAudio && !extractAudioOnly && (
          <>
            <div>
              <label className="block text-white/60 text-xs mb-1">Resolution</label>
              <select
                value={settings.width && settings.height ? `${settings.width}x${settings.height}` : 'original'}
                onChange={e => {
                  const value = e.target.value;
                  if (value === 'original') {
                    onSettingChange({ width: undefined, height: undefined });
                  } else {
                    const [w, h] = value.split('x').map(Number);
                    onSettingChange({ width: w, height: h });
                  }
                }}
                className={selectClassName}
              >
                {VIDEO_RESOLUTIONS.map(res => (
                  <option key={res.value} value={res.value}>
                    {res.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white/60 text-xs mb-1">Frame Rate</label>
              <select
                value={settings.fps?.toString() || 'original'}
                onChange={e => {
                  const value = e.target.value;
                  onSettingChange({ fps: value === 'original' ? undefined : parseInt(value) });
                }}
                className={selectClassName}
              >
                {VIDEO_FPS.map(fps => (
                  <option key={fps.value} value={fps.value}>
                    {fps.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(AdvancedSettings);