import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open as openDialog } from '@tauri-apps/api/dialog';
import { FolderOpen, ExternalLink } from 'lucide-react';
import Header from '@/components/Header';
import GpuIndicator from '@/components/GpuIndicator';
import DropZone from '@/components/DropZone';
import FileList from '@/components/FileList';
import ConvertButton from '@/components/ConvertButton';
import { useGpu } from '@/hooks/useGpu';
import { useConversion } from '@/hooks/useConversion';
import { useNotifications } from '@/hooks/useNotifications';
import { truncatePath, generateOutputPath, sortFilesByStatus } from '@/utils';
import { saveQueue, loadQueue, clearQueue, saveOutputFolder, loadOutputFolder } from '@/utils/storage';
import type { FileItem, ConversionContextType } from '@/types';

export const ConversionContext = React.createContext<ConversionContextType | null>(null);

const MAX_PARALLEL_CONVERSIONS = 4;
const MAX_FILES_IN_QUEUE = 50;
const AUTOSAVE_INTERVAL_MS = 2000;

const App: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  const [parallelConversion, setParallelConversion] = useState(false);
  const [outputFolder, setOutputFolder] = useState<string>('');
  const [expandedAdvanced, setExpandedAdvanced] = useState<Set<string>>(new Set());
  const [expandedCompactCard, setExpandedCompactCard] = useState<string | null>(null);

  const { gpuInfo, isLoading: gpuLoading } = useGpu();
  const { notifyFileCompleted, notifyFileFailed, notifyQueueCompleted } = useNotifications();

  // Load queue and output folder on mount
  useEffect(() => {
    const savedFiles = loadQueue();
    if (savedFiles.length > 0) {
      setFiles(savedFiles);
      console.log(`✅ Restored ${savedFiles.length} files from previous session`);
    }

    const savedFolder = loadOutputFolder();
    if (savedFolder) {
      setOutputFolder(savedFolder);
      console.log(`✅ Restored output folder: ${savedFolder}`);
    }
  }, []);

  // Auto-save output folder when changed
  useEffect(() => {
    if (outputFolder) {
      saveOutputFolder(outputFolder);
    }
  }, [outputFolder]);

  // Auto-save queue
  useEffect(() => {
    const interval = setInterval(() => {
      if (files.length > 0) {
        saveQueue(files);
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [files]);

  // Track queue completion for notifications
  const prevFilesRef = React.useRef<FileItem[]>([]);
  useEffect(() => {
    const prevFiles = prevFilesRef.current;
    prevFilesRef.current = files;

    files.forEach(file => {
      const prevFile = prevFiles.find(f => f.id === file.id);
      if (prevFile && prevFile.status !== file.status) {
        if (file.status === 'completed') {
          notifyFileCompleted(file);
        } else if (file.status === 'failed') {
          notifyFileFailed(file);
        }
      }
    });

    const wasProcessing = prevFiles.some(f => f.status === 'processing');
    const isProcessing = files.some(f => f.status === 'processing');
    const hasPending = files.some(f => f.status === 'pending');

    if (wasProcessing && !isProcessing && !hasPending && files.length > 0) {
      const completed = files.filter(f => f.status === 'completed').length;
      const failed = files.filter(f => f.status === 'failed').length;
      notifyQueueCompleted(completed, failed);
    }
  }, [files, notifyFileCompleted, notifyFileFailed, notifyQueueCompleted]);

  const updateFile = useCallback(
    (fileId: string, updates: Partial<FileItem>) => {
      setFiles(prev =>
        prev.map(f => {
          if (f.id !== fileId) return f;
          const updated = { ...f, ...updates };

          if (outputFolder && updated.status === 'pending' && !updated.outputPath) {
            if (updates.outputFormat !== undefined) {
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
      .catch(error => {
        console.error('FFmpeg check failed:', error);
        setFfmpegAvailable(false);
        alert(
          `⚠️ FFmpeg is not installed or not found in PATH.\n\nPlease install FFmpeg to use this application.\n\nError: ${error}`
        );
      });
  }, []);

  useEffect(() => {
    if (outputFolder) {
      setFiles(prev =>
        prev.map(file =>
          file.status === 'pending' && !file.outputPath
            ? { ...file, outputPath: generateOutputPath(file, outputFolder) }
            : file
        )
      );
    }
  }, [outputFolder]);

  const sortedFiles = useMemo(() => sortFilesByStatus(files), [files]);

  const handleFilesAdded = useCallback(
    (newFiles: FileItem[]) => {
      const currentCount = files.length;
      const availableSlots = MAX_FILES_IN_QUEUE - currentCount;

      if (availableSlots <= 0) {
        alert(`⚠️ Queue is full! Maximum ${MAX_FILES_IN_QUEUE} files allowed.\n\nPlease remove some files first.`);
        return;
      }

      const existingPaths = new Set(files.map(f => f.path));
      const uniqueFiles = newFiles.filter(f => !existingPaths.has(f.path));
      const duplicateCount = newFiles.length - uniqueFiles.length;

      if (duplicateCount > 0) {
        alert(
          `⚠️ ${duplicateCount} file${duplicateCount > 1 ? 's are' : ' is'} already in the queue and will be skipped.`
        );
      }

      const filesToAdd = uniqueFiles.slice(0, availableSlots);
      const exceededCount = uniqueFiles.length - filesToAdd.length;

      if (exceededCount > 0) {
        alert(
          `⚠️ Only ${filesToAdd.length} files added.\n\n${exceededCount} files exceeded the ${MAX_FILES_IN_QUEUE} file limit.`
        );
      }

      if (filesToAdd.length === 0) return;

      const filesWithPath = outputFolder
        ? filesToAdd.map(file => ({
            ...file,
            outputPath: generateOutputPath(file, outputFolder),
          }))
        : filesToAdd;

      setFiles(prev => [...filesWithPath, ...prev]);
    },
    [files, outputFolder]
  );

  const handleFileRemove = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setExpandedAdvanced(prev => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
    setExpandedCompactCard(prev => (prev === fileId ? null : prev));
  }, []);

  const handleRetry = useCallback(
    (fileId: string) => {
      updateFile(fileId, {
        status: 'pending',
        progress: null,
        error: null,
        completedAt: undefined,
      });
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
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    console.log(
      `🚀 Starting ${parallelConversion ? 'parallel' : 'sequential'} conversion for ${pendingFiles.length} files`
    );

    if (parallelConversion) {
      const chunks = [];
      for (let i = 0; i < pendingFiles.length; i += MAX_PARALLEL_CONVERSIONS) {
        chunks.push(pendingFiles.slice(i, i + MAX_PARALLEL_CONVERSIONS));
      }

      for (const chunk of chunks) {
        await Promise.allSettled(
          chunk.map(file =>
            conversionContext.startConversion(file).catch(err => console.error(`Failed to convert ${file.name}:`, err))
          )
        );
      }
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
    setExpandedAdvanced(prev => {
      const next = new Set(prev);
      next.has(fileId) ? next.delete(fileId) : next.add(fileId);
      return next;
    });
  }, []);

  const handleToggleCompactCard = useCallback((fileId: string | null) => {
    setExpandedCompactCard(prev => (prev === fileId ? null : fileId));
  }, []);

  // Batch actions
  const handleApplyToAll = useCallback(() => {
    const firstPending = files.find(f => f.status === 'pending');
    if (!firstPending) return;

    setFiles(prev =>
      prev.map(file =>
        file.status === 'pending'
          ? {
              ...file,
              outputFormat: firstPending.outputFormat,
              settings: { ...firstPending.settings },
              outputPath: outputFolder
                ? generateOutputPath({ ...file, outputFormat: firstPending.outputFormat }, outputFolder)
                : undefined,
            }
          : file
      )
    );
  }, [files, outputFolder]);

  const handleClearCompleted = useCallback(() => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'));
  }, []);

  const handleClearAll = useCallback(() => {
    setFiles([]);
    clearQueue();
  }, []);

  const handleCancelAll = useCallback(async () => {
    const processingFiles = files.filter(f => f.status === 'processing');
    await Promise.all(processingFiles.map(file => conversionContext.cancelConversion(file.id)));
  }, [files, conversionContext]);

  const canConvert =
    files.some(f => f.status === 'pending') && !conversionContext.isConverting && ffmpegAvailable === true;

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const fileCountDisplay = `${files.length}/${MAX_FILES_IN_QUEUE}`;

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
              <DropZone onFilesAdded={handleFilesAdded} currentCount={files.length} maxCount={MAX_FILES_IN_QUEUE} />
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
                  className={`glass px-3 py-3 flex items-center justify-center transition-all flex-shrink-0 w-12 ${
                    outputFolder ? 'hover:bg-white/10 cursor-pointer' : 'opacity-30 cursor-not-allowed'
                  }`}
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
                  onChange={e => setParallelConversion(e.target.checked)}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 checked:bg-primary-purple cursor-pointer"
                  title={`Enable parallel processing (max ${MAX_PARALLEL_CONVERSIONS} files at once)`}
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
              expandedCompactCard={expandedCompactCard}
              onToggleCompactCard={handleToggleCompactCard}
              fileCountDisplay={fileCountDisplay}
              onApplyToAll={handleApplyToAll}
              onClearCompleted={handleClearCompleted}
              onClearAll={handleClearAll}
              onCancelAll={handleCancelAll}
            />
          </div>
        </div>
      </div>
    </ConversionContext.Provider>
  );
};

export default React.memo(App);
