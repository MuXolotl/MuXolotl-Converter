import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open as openDialog } from '@tauri-apps/api/dialog';
import { FolderOpen, ExternalLink } from 'lucide-react';
import Header from './components/Header';
import GpuIndicator from './components/GpuIndicator';
import DropZone from './components/DropZone';
import FileList from './components/FileList';
import ConvertButton from './components/ConvertButton';
import { useGpu } from './hooks/useGpu';
import { useConversion } from './hooks/useConversion';
import { truncatePath, generateOutputPath } from './utils';
import type { FileItem, ConversionContextType } from './types';

export const ConversionContext = React.createContext<ConversionContextType | null>(null);

const App: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  const [parallelConversion, setParallelConversion] = useState(false);
  const [outputFolder, setOutputFolder] = useState<string>('');
  const [expandedAdvanced, setExpandedAdvanced] = useState<Set<string>>(new Set());

  const { gpuInfo, isLoading: gpuLoading } = useGpu();

  const updateFile = useCallback(
    (fileId: string, updates: Partial<FileItem>) => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.id !== fileId) return f;
          const updated = { ...f, ...updates };
          if (outputFolder && updated.status === 'pending') {
            if (updates.outputFormat !== undefined || updated.outputPath === undefined) {
              updated.outputPath = generateOutputPath(updated, outputFolder);
            }
          }
          return updated;
        })
      );
    },
    [outputFolder]
  );

  const conversionContext = useConversion(updateFile, gpuInfo);

  useEffect(() => {
    invoke<boolean>('check_ffmpeg')
      .then(setFfmpegAvailable)
      .catch((error) => {
        console.error('FFmpeg check failed:', error);
        setFfmpegAvailable(false);
        alert(
          `⚠️ FFmpeg is not installed or not found in PATH.\n\nPlease install FFmpeg to use this application.\n\nError: ${error}`
        );
      });
  }, []);

  useEffect(() => {
    if (outputFolder) {
      setFiles((prev) =>
        prev.map((file) =>
          file.status === 'pending' ? { ...file, outputPath: generateOutputPath(file, outputFolder) } : file
        )
      );
    }
  }, [outputFolder]);

  const sortedFiles = useMemo(() => {
    const statusOrder = { processing: 0, pending: 1, cancelled: 2, failed: 3, completed: 4 };
    return [...files].sort((a, b) => {
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      if (['completed', 'failed', 'cancelled'].includes(a.status)) {
        return (b.completedAt || 0) - (a.completedAt || 0);
      }
      return (b.addedAt || 0) - (a.addedAt || 0);
    });
  }, [files]);

  const handleFilesAdded = useCallback(
    (newFiles: FileItem[]) => {
      const filesWithPath = outputFolder
        ? newFiles.map((file) => ({ ...file, outputPath: generateOutputPath(file, outputFolder) }))
        : newFiles;
      setFiles((prev) => [...filesWithPath, ...prev]);
    },
    [outputFolder]
  );

  const handleFileRemove = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setExpandedAdvanced((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
  }, []);

  const handleRetry = useCallback(
    (fileId: string) => {
      updateFile(fileId, { status: 'pending', progress: null, error: null, completedAt: undefined });
    },
    [updateFile]
  );

  const handleSelectOutputFolder = useCallback(async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setOutputFolder(selected);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }, []);

  const handleOpenOutputFolder = useCallback(async () => {
    if (!outputFolder) return;
    try {
      await invoke('open_folder', { path: outputFolder });
    } catch (error) {
      console.error('Failed to open folder:', error);
      alert(`Failed to open folder: ${error}`);
    }
  }, [outputFolder]);

  const handleConvertAll = useCallback(async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    console.log(
      `🚀 Starting ${parallelConversion ? 'parallel' : 'sequential'} conversion for ${pendingFiles.length} files`
    );

    if (parallelConversion) {
      await Promise.allSettled(
        pendingFiles.map((file) =>
          conversionContext.startConversion(file).catch((err) => console.error(`Failed to convert ${file.name}:`, err))
        )
      );
    } else {
      for (const file of pendingFiles) {
        try {
          await conversionContext.startConversion(file);
        } catch (error) {
          console.error(`Failed to convert ${file.name}:`, error);
        }
      }
    }
  }, [files, parallelConversion, conversionContext]);

  const handleToggleAdvanced = useCallback((fileId: string) => {
    setExpandedAdvanced((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const canConvert =
    files.some((f) => f.status === 'pending') && !conversionContext.isConverting && ffmpegAvailable === true;
  const pendingCount = files.filter((f) => f.status === 'pending').length;

  if (ffmpegAvailable === null) {
    return (
      <div className="w-screen h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-white text-xl">Checking FFmpeg...</div>
      </div>
    );
  }

  return (
    <ConversionContext.Provider value={conversionContext}>
      <div className="w-screen h-screen bg-gradient-main overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
          <div className="flex-shrink-0 flex items-center justify-between">
            <Header />
            {!gpuLoading && <GpuIndicator gpuInfo={gpuInfo} />}
          </div>

          <div className="flex-shrink-0 flex gap-3">
            <div className="flex-1">
              <DropZone onFilesAdded={handleFilesAdded} />
            </div>

            <div className="w-64 flex flex-col gap-2">
              <ConvertButton
                disabled={!canConvert}
                isConverting={conversionContext.isConverting}
                onClick={handleConvertAll}
                fileCount={pendingCount}
              />

              <div className="flex gap-2 items-stretch">
                <button
                  onClick={handleSelectOutputFolder}
                  className="glass px-4 py-3 flex items-center gap-2 hover:bg-white/10 transition-colors flex-1 min-w-0"
                  title={outputFolder || 'Click to select output folder'}
                >
                  <FolderOpen size={18} className="text-primary-purple flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    {outputFolder ? (
                      <>
                        <div className="text-white text-xs font-semibold">Output Folder:</div>
                        <div className="text-white/80 text-xs truncate font-mono">{truncatePath(outputFolder)}</div>
                      </>
                    ) : (
                      <div className="text-white text-sm font-semibold">Select Output Folder</div>
                    )}
                  </div>
                </button>

                <button
                  onClick={handleOpenOutputFolder}
                  disabled={!outputFolder}
                  className={`glass px-3 py-3 flex items-center justify-center transition-all flex-shrink-0 w-12
                           ${outputFolder ? 'hover:bg-white/10 cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
                  title={outputFolder ? 'Open output folder' : 'No folder selected'}
                >
                  <ExternalLink
                    size={18}
                    className={`${outputFolder ? 'text-primary-pink hover:scale-110' : 'text-white/40'} transition-all`}
                  />
                </button>
              </div>

              <div className="glass px-3 py-2 flex items-center justify-between">
                <span className="text-white text-sm">Parallel conversion</span>
                <input
                  type="checkbox"
                  checked={parallelConversion}
                  onChange={(e) => setParallelConversion(e.target.checked)}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 checked:bg-primary-purple cursor-pointer"
                  title="Enable parallel processing (may increase CPU/GPU usage)"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <FileList
              files={sortedFiles}
              onRemove={handleFileRemove}
              onRetry={handleRetry}
              gpuAvailable={gpuInfo?.available || true}
              expandedAdvanced={expandedAdvanced}
              onToggleAdvanced={handleToggleAdvanced}
            />
          </div>
        </div>
      </div>
    </ConversionContext.Provider>
  );
};

export default React.memo(App);
