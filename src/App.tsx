import { useState, useCallback, useEffect, useMemo, createContext } from 'react';
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
import Footer from '@/components/Footer';

export const ConversionContext = createContext<ConversionContextType | null>(null);

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

export default function App() {
  const [ffmpegReady, setFfmpegReady] = useState<boolean | null>(null);
  const [outputFolder, setOutputFolder] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorModal, setErrorModal] = useState<ErrorState | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);

  const { gpuInfo, isLoading: gpuLoading } = useGpu();
  const queue = useFileQueue(outputFolder);

  const handleError = useCallback((file: FileItem, error: string) => {
    setErrorModal({
      title: 'Conversion Failed',
      message: error || 'Error',
      details: error,
      fileInfo: {
        name: file.name,
        path: file.path,
        format: file.mediaInfo?.format_name.split(',')[0] || 'unknown',
        outputFormat: file.outputFormat,
        duration: file.mediaInfo?.duration,
        size: file.mediaInfo?.file_size,
      },
      settings: { ...file.settings },
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

  useEffect(() => {
    const init = async () => {
      try {
        const isReady = await invoke<boolean>('check_ffmpeg');
        setFfmpegReady(isReady);
        const saved = loadOutputFolder();
        if (saved) setOutputFolder(saved);
        setIsLoaded(true);
        setTimeout(() => invoke('close_splash').catch(() => {}), 500);
      } catch {
        setFfmpegReady(false);
        setIsLoaded(true);
        invoke('close_splash').catch(() => {});
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isLoaded) saveOutputFolder(outputFolder);
  }, [outputFolder, isLoaded]);

  const selectedFile = useMemo(() => {
    if (selectedIds.size === 0) return null;
    return queue.files.find(f => f.id === Array.from(selectedIds)[0]) || null;
  }, [queue.files, selectedIds]);

  const handleFilesAdded = useCallback((newFiles: FileItem[]) => {
    queue.addFiles(newFiles);
    if (newFiles.length > 0) setSelectedIds(new Set([newFiles[0].id]));
  }, [queue]);

  const handleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds(prev => {
      if (multi) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(queue.files.map(f => f.id)));
  }, [queue.files]);

  const handleDeselectAll = useCallback(() => setSelectedIds(new Set()), []);

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

  if (ffmpegReady === null) return null;

  if (ffmpegReady === false) {
    return (
      <div className="h-screen w-screen bg-[#0f172a] text-white flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-2">FFmpeg Not Found</h1>
          <p className="text-white/60">Please ensure FFmpeg binaries are installed.</p>
        </div>
      </div>
    );
  }

  return (
    <ConversionContext.Provider value={conversion}>
      <div className="h-screen w-screen bg-[#0f172a] text-white flex flex-col overflow-hidden">
        <TitleBar />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar onFeedbackClick={() => setFeedbackOpen(true)} />
          <div className="flex-1 h-full overflow-hidden flex flex-col">
            <Toolbar
              stats={queue.stats}
              gpuInfo={gpuInfo}
              gpuLoading={gpuLoading}
              outputFolder={outputFolder}
              onFolderChange={setOutputFolder}
            />
            <div className="flex-1 min-h-0 relative">
              <SplitPane
                initialLeftWidth={Math.min(window.innerWidth * 0.80, 1000)}
                minLeftWidth={600}
                maxLeftWidth={1400}
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
            <Footer
              isOpen={isConsoleOpen}
              onToggle={() => setIsConsoleOpen(!isConsoleOpen)}
              lastFile={queue.files[0]}
            />
          </div>
        </div>
        <ErrorModal
          isOpen={!!errorModal}
          error={errorModal}
          onClose={() => setErrorModal(null)}
        />
        <FeedbackModal
          isOpen={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          gpuInfo={gpuInfo}
          stats={queue.stats}
        />
      </div>
    </ConversionContext.Provider>
  );
}