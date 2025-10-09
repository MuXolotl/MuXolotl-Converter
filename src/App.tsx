import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import Header from '@/components/Header';
import GpuIndicator from '@/components/GpuIndicator';
import DropZone from '@/components/DropZone';
import FileList from '@/components/FileList';
import ConvertButton from '@/components/ConvertButton';
import OutputFolderSelector from '@/components/OutputFolderSelector';
import { useGpu } from '@/hooks/useGpu';
import { useConversion } from '@/hooks/useConversion';
import { useNotifications } from '@/hooks/useNotifications';
import { useFileManager } from '@/components/FileManager';
import { generateOutputPath, sortFilesByStatus } from '@/utils';
import { saveQueue, loadQueue, clearQueue, saveOutputFolder, loadOutputFolder } from '@/utils/storage';
import type { FileItem, ConversionContextType } from '@/types';

export const ConversionContext = React.createContext<ConversionContextType | null>(null);

const MAX_PARALLEL_CONVERSIONS = 4;
const MAX_FILES_IN_QUEUE = 50;
const AUTOSAVE_INTERVAL_MS = 5000;

const App: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  const [parallelConversion, setParallelConversion] = useState(false);
  const [outputFolder, setOutputFolder] = useState<string>('');
  const [expandedAdvanced, setExpandedAdvanced] = useState<Set<string>>(new Set());
  const [expandedCompactCard, setExpandedCompactCard] = useState<string | null>(null);

  const { gpuInfo, isLoading: gpuLoading } = useGpu();
  const { notifyFileCompleted, notifyFileFailed, notifyQueueCompleted } = useNotifications();

  const { handleFilesAdded, handleFileRemove, handleApplyToAll, handleClearCompleted, handleClearAll } = useFileManager(
    {
      files,
      setFiles,
      outputFolder,
      maxFiles: MAX_FILES_IN_QUEUE,
      setExpandedAdvanced,
      setExpandedCompactCard,
    }
  );

  // Load saved state
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

  // Auto-save output folder
  useEffect(() => {
    if (outputFolder) saveOutputFolder(outputFolder);
  }, [outputFolder]);

  // Auto-save queue
  const prevFilesForSave = useRef<string>('');
  useEffect(() => {
    const interval = setInterval(() => {
      if (files.length > 0) {
        const filesString = JSON.stringify(files);
        if (filesString !== prevFilesForSave.current) {
          saveQueue(files);
          prevFilesForSave.current = filesString;
          console.log(`💾 Auto-saved ${files.length} files to queue`);
        }
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [files]);

  // Track notifications
  const prevFilesRef = useRef<FileItem[]>([]);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Debounce notifications
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    notificationTimeoutRef.current = setTimeout(() => {
      const prevFiles = prevFilesRef.current;
      prevFilesRef.current = files;

      files.forEach(file => {
        const prevFile = prevFiles.find(f => f.id === file.id);
        if (prevFile && prevFile.status !== file.status) {
          if (file.status === 'completed') notifyFileCompleted(file);
          else if (file.status === 'failed') notifyFileFailed(file);
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
    }, 100); // 100ms debounce

    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
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
        alert(`⚠️ FFmpeg is not installed.\n\nError: ${error}`);
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
        await Promise.allSettled(chunk.map(file => conversionContext.startConversion(file)));
      }
    } else {
      for (const file of pendingFiles) {
        await conversionContext.startConversion(file).catch(() => {});
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

              <OutputFolderSelector outputFolder={outputFolder} onFolderChange={setOutputFolder} />

              <div className="glass px-3 py-2 flex items-center justify-between">
                <span className="text-white text-sm">Parallel conversion</span>
                <input
                  type="checkbox"
                  checked={parallelConversion}
                  onChange={e => setParallelConversion(e.target.checked)}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 checked:bg-primary-purple cursor-pointer"
                  title={`Enable parallel processing (max ${MAX_PARALLEL_CONVERSIONS} files)`}
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
              onClearAll={() => {
                handleClearAll();
                clearQueue();
              }}
              onCancelAll={handleCancelAll}
            />
          </div>
        </div>
      </div>
    </ConversionContext.Provider>
  );
};

export default React.memo(App);