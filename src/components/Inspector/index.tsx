import React, { useContext } from 'react';
import { FileItem } from '@/types';
import { ConversionContext } from '@/App';
import { useFileSettings } from '@/hooks/useFileSettings';
import { formatDuration, formatFileSize } from '@/utils';
import FormatSettings from '@/components/FileCard/FormatSettings';
import AdvancedSettings from '@/components/FileCard/AdvancedSettings';
import MetadataEditor from '@/components/FileCard/MetadataEditor';
import { FileVideo, FileAudio, Trash2, RotateCcw, Play } from 'lucide-react';

interface InspectorProps {
  file: FileItem | null;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

const Inspector: React.FC<InspectorProps> = ({ file, onRemove, onRetry }) => {
  const context = useContext(ConversionContext);
  
  if (!file || !context) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-white/20 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center mb-4">
          <SettingsIcon size={32} />
        </div>
        <p className="text-sm">Select a file to configure settings</p>
      </div>
    );
  }

  return <InspectorContent file={file} context={context} onRemove={onRemove} onRetry={onRetry} />;
};


const InspectorContent: React.FC<{ 
    file: FileItem, 
    context: any,
    onRemove: (id: string) => void,
    onRetry: (id: string) => void
}> = ({ file, context, onRemove, onRetry }) => {
  const { updateFile, startConversion, cancelConversion, isConverting } = context;
  const { formats, recommendations, validation } = useFileSettings(file);
  
  const isVideo = file.mediaInfo?.media_type === 'video';
  const isAudio = file.mediaInfo?.media_type === 'audio';
  
  const Icon = isVideo ? FileVideo : FileAudio;
  const isDisabled = file.status !== 'pending';
  const isProcessing = file.status === 'processing';

  const handleFormatChange = (fmt: string) => {
      updateFile(file.id, { outputFormat: fmt, outputPath: undefined });
  };
  const handleSettingChange = (updates: any) => {
      updateFile(file.id, { settings: { ...file.settings, ...updates } });
  };
  const handleExtractToggle = (val: boolean) => {
      updateFile(file.id, {
          settings: { ...file.settings, extractAudioOnly: val },
          outputFormat: val ? 'mp3' : 'mp4',
          outputPath: undefined
      });
  };
  
  // NEW: Metadata Handler
  const handleMetadataChange = (metadata: any) => {
      updateFile(file.id, { settings: { ...file.settings, metadata } });
  };

  return (
    <div className="h-full flex flex-col bg-black/20 border-l border-white/10">
      {/* Header / Preview */}
      <div className="h-48 bg-black/40 flex flex-col items-center justify-center relative group">
        <Icon size={48} className={`opacity-50 ${isVideo ? 'text-primary-pink' : 'text-primary-purple'}`} />
        <div className="absolute bottom-2 left-2 right-2">
            <div className="text-xs font-mono text-white/60 bg-black/60 px-2 py-1 rounded backdrop-blur-sm truncate text-center">
                {file.name}
            </div>
        </div>
      </div>

      {/* File Details */}
      <div className="p-4 border-b border-white/5">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div><div className="text-white/40 mb-0.5">Duration</div><div className="text-white font-mono">{formatDuration(file.mediaInfo?.duration || 0)}</div></div>
          <div><div className="text-white/40 mb-0.5">Size</div><div className="text-white font-mono">{formatFileSize(file.mediaInfo?.file_size || 0)}</div></div>
          <div><div className="text-white/40 mb-0.5">Resolution</div><div className="text-white font-mono">{file.mediaInfo?.video_streams[0] ? `${file.mediaInfo.video_streams[0].width}x${file.mediaInfo.video_streams[0].height}` : 'N/A'}</div></div>
          <div><div className="text-white/40 mb-0.5">Codec</div><div className="text-white font-mono opacity-70">{file.mediaInfo?.video_streams[0]?.codec || file.mediaInfo?.audio_streams[0]?.codec || 'N/A'}</div></div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
         {/* Validation Banner */}
         {file.status === 'pending' && validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="space-y-2 p-3 bg-white/5 rounded-lg">
              {validation.errors.map((e, i) => <div key={i} className="text-[10px] text-red-300 flex gap-2">❌ {e}</div>)}
              {validation.warnings.map((w, i) => <div key={i} className="text-[10px] text-yellow-300 flex gap-2">⚠️ {w}</div>)}
            </div>
         )}

         <div className="space-y-2">
             <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Output Format</h3>
             <FormatSettings 
                inputFormat={file.mediaInfo?.format_name || 'unknown'}
                outputFormat={file.outputFormat}
                quality={file.settings.quality}
                formats={formats}
                disabled={isDisabled}
                recommendedFormats={recommendations}
                onFormatChange={handleFormatChange}
                onQualityChange={(q) => handleSettingChange({ quality: q })}
                isAdvancedOpen={false} 
                isVideo={isVideo}
                extractAudioOnly={file.settings.extractAudioOnly}
                onToggleExtractAudio={handleExtractToggle}
             />
         </div>
         
         {/* NEW: Metadata Section */}
         <div className="space-y-2">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Metadata</h3>
            <MetadataEditor 
                metadata={file.settings.metadata}
                onChange={handleMetadataChange}
                disabled={isDisabled}
            />
         </div>

         <div className="space-y-2">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Advanced Settings</h3>
            <AdvancedSettings
                isOpen={true}
                isAudio={isAudio}
                extractAudioOnly={file.settings.extractAudioOnly}
                settings={file.settings}
                disabled={isDisabled}
                onSettingChange={handleSettingChange}
            />
         </div>
      </div>

      {/* Actions Footer */}
      <div className="p-4 border-t border-white/10 bg-black/20 flex flex-col gap-2">
         {file.status === 'pending' ? (
            <button 
                onClick={() => startConversion(file)}
                className="w-full py-3 bg-gradient-primary rounded-lg text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-purple/20 hover:shadow-primary-purple/40 transition-all"
            >
                <Play size={16} fill="currentColor" /> Convert This File
            </button>
         ) : isProcessing ? (
            <button onClick={() => cancelConversion(file.id)} className="w-full py-3 bg-red-500/20 text-red-400 rounded-lg font-bold hover:bg-red-500/30">Cancel</button>
         ) : (
            <button onClick={() => onRetry(file.id)} className="w-full py-3 bg-white/10 text-white rounded-lg font-bold hover:bg-white/20 flex items-center justify-center gap-2"><RotateCcw size={16} /> Retry</button>
         )}

         <button onClick={() => onRemove(file.id)} className="w-full py-2 text-xs text-white/40 hover:text-red-400 flex items-center justify-center gap-2 transition-colors"><Trash2 size={12} /> Remove from queue</button>
      </div>
    </div>
  );
};

const SettingsIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

export default React.memo(Inspector);