import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useGpu } from '@/hooks/useGpu';
import { useFileQueue } from '@/hooks/useFileQueue';
import { useConversion } from '@/hooks/useConversion';
import { saveOutputFolder, loadOutputFolder } from '@/utils';
import type { ConversionContextType, FileItem, GpuInfo } from '@/types';

import TitleBar from '@/components/TitleBar';
import Sidebar from '@/components/Sidebar';
import Toolbar from '@/components/Toolbar';
import SplitPane from '@/components/Layout/SplitPane';
import Queue from '@/components/Queue';
import Inspector from '@/components/Inspector';
import ErrorModal from '@/components/ErrorModal';
import FeedbackModal from '@/components/FeedbackModal';

export const ConversionContext = React.createContext<ConversionContextType | null>(null);

interface ErrorState {
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

const App: React.FC = () => {
  const [ffmpegReady, setFfmpegReady] = useState<boolean | null>(null);
  const [outputFolder, setOutputFolder] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorModal, setErrorModal] = useState<ErrorState | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const { gpuInfo, isLoading: gpuLoading } = useGpu();
  const queue = useFileQueue(outputFolder);
  
  // Error handler with full info
  const handleError = useCallback((file: FileItem, error: string) => {
    setErrorModal({
      title: 'Conversion Failed',
      message: error || 'An unknown error occurred during conversion.',
      details: error,
      fileInfo: {
        name: file.name,
        path: file.path,
        format: file.mediaInfo?.format_name.split(',')[0] || 'unknown',
        outputFormat: file.outputFormat,
        duration: file.mediaInfo?.duration,
        size: file.mediaInfo?.file_size,
      },
      settings: {
        quality: file.settings.quality,
        useGpu: file.settings.useGpu,
        sampleRate: file.settings.sampleRate,
        channels: file.settings.channels,
        width: file.settings.width,
        height: file.settings.height,
      },
      gpuInfo,
    });
  }, [gpuInfo]);

  const conversion = useConversion(
    queue.updateFile, 
    gpuInfo, 
    queue.filesRef, 
    outputFolder,
    handleError
  );

  // Initialize
  useEffect(() => {
    invoke<boolean>('check_ffmpeg')
      .then(setFfmpegReady)
      .catch(() => setFfmpegReady(false));

    const saved = loadOutputFolder();
    if (saved) setOutputFolder(saved);
  }, []);

  // Persist output folder
  useEffect(() => {
    saveOutputFolder(outputFolder);
  }, [outputFolder]);

  // Selected file for inspector
  const selectedFile = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const firstId = Array.from(selectedIds)[0];
    return queue.files.find(f => f.id === firstId) || null;
  }, [queue.files, selectedIds]);

  // Handlers
  const handleFilesAdded = useCallback((newFiles: FileItem[]) => {
    queue.addFiles(newFiles);
    if (newFiles.length > 0) {
      setSelectedIds(new Set([newFiles[0].id]));
    }
  }, [queue]);

  const handleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds(prev => {
      if (multi) {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      }
      return new Set([id]);
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(queue.files.map(f => f.id)));
  }, [queue.files]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleRemove = useCallback((id: string) => {
    queue.removeFile(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [queue]);

  const handleRemoveSelected = useCallback(() => {
    selectedIds.forEach(id => queue.removeFile(id));
    setSelectedIds(new Set());
  }, [selectedIds, queue]);

  // Loading state
  if (ffmpegReady === null) {
    return (
      <div className="h-screen w-screen bg-gradient-main flex items-center justify-center">
        <div className="text-white text-lg flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  // Error state
  if (ffmpegReady === false) {
    return (
      <div className="h-screen w-screen bg-gradient-main flex flex-col">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="glass p-8 max-w-md text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-white mb-2">FFmpeg Not Found</h1>
            <p className="text-white/60 text-sm">
              Please ensure FFmpeg binaries are properly installed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConversionContext.Provider value={conversion}>
      <div className="h-screen w-screen bg-[#0f172a] text-white flex flex-col overflow-hidden">
        {/* Title Bar */}
        <TitleBar />

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <Sidebar onFeedbackClick={() => setFeedbackOpen(true)} />

          {/* Main Content */}
          <div className="flex-1 h-full overflow-hidden flex flex-col">
            {/* Toolbar */}
            <Toolbar
              stats={queue.stats}
              gpuInfo={gpuInfo}
              gpuLoading={gpuLoading}
              outputFolder={outputFolder}
              onFolderChange={setOutputFolder}
            />

            {/* Split View */}
            <div className="flex-1 min-h-0">
              <SplitPane
                initialLeftWidth={Math.min(window.innerWidth * 0.55, 700)}
                minLeftWidth={400}
                maxLeftWidth={900}
                left={
                  <Queue
                    files={queue.sortedFiles}
                    selectedIds={selectedIds}
                    onSelect={handleSelect}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                    onRemove={handleRemove}
                    onRemoveSelected={handleRemoveSelected}
                    onFilesAdded={handleFilesAdded}
                  />
                }
                right={
                  <Inspector
                    file={selectedFile}
                    selectedCount={selectedIds.size}
                    outputFolder={outputFolder}
                    onRetry={queue.retryFile}
                  />
                }
              />
            </div>
          </div>
        </div>

        {/* Error Modal */}
        <ErrorModal
          isOpen={!!errorModal}
          error={errorModal}
          onClose={() => setErrorModal(null)}
        />

        {/* Feedback Modal */}
        <FeedbackModal
          isOpen={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          gpuInfo={gpuInfo}
          stats={queue.stats}
        />
      </div>
    </ConversionContext.Provider>
  );
};

export default App;