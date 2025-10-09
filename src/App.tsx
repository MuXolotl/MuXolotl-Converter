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
import { generateOutputPath, sortFilesByStatus, saveQueue, loadQueue, clearQueue, saveOutputFolder, loadOutputFolder } from '@/utils';
import type { FileItem, ConversionContextType } from '@/types';

export const ConversionContext = React.createContext<ConversionContextType | null>(null);

const MAX_PARALLEL_CONVERSIONS = 4;
const MAX_FILES_IN_QUEUE = 50;
const AUTOSAVE_INTERVAL_MS = 10000;

const App: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  const [parallelConversion, setParallelConversion] = useState(false);
  const [outputFolder, setOutputFolder] = useState<string>('');
  const [expandedAdvanced, setExpandedAdvanced] = useState<Set<string>>(new Set());
  const [expandedCompactCard, setExpandedCompactCard] = useState<string | null>(null);

  const { gpuInfo, isLoading: gpuLoading } = useGpu();

  // ============================================================================
  // FILE MANAGEMENT
  // ============================================================================

  const handleFilesAdded = useCallback(
    (newFiles: FileItem[]) => {
      const availableSlots = MAX_FILES_IN_QUEUE - files.length;

      if (availableSlots <= 0) {
        alert(`⚠️ Queue is full! Maximum ${MAX_FILES_IN_QUEUE} files allowed.`);
        return;
      }

      const existingPaths = new Set(files.map(f => f.path));
      const uniqueFiles = newFiles.filter(f => !existingPaths.has(f.path));
      const duplicateCount = newFiles.length - uniqueFiles.length;

      if (duplicateCount > 0) {
        alert(`⚠️ ${duplicateCount} duplicate file${duplicateCount > 1 ? 's' : ''} skipped.`);
      }

      const filesToAdd = uniqueFiles.slice(0, availableSlots);
      const exceededCount = uniqueFiles.length - filesToAdd.length;

      if (exceededCount > 0) {
        alert(`⚠️ Only ${filesToAdd.length} files added. ${exceededCount} exceeded limit.`);
      }

      if (filesToAdd.length === 0) return;

      const filesWithPath = outputFolder
        ? filesToAdd.map(file => ({ ...file, outputPath: generateOutputPath(file, outputFolder) }))
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

  const handleClearAll = useCallback(() => {
    setFiles([]);
    clearQueue();
  }, []);

  // ============================================================================
  // STORAGE
  // ============================================================================

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

  useEffect(() => {
    if (outputFolder) saveOutputFolder(outputFolder);
  }, [outputFolder]);

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

  // ============================================================================
  // CONVERSION
  // ============================================================================

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
              onClearAll={handleClearAll}
            />
          </div>
        </div>
      </div>
    </ConversionContext.Provider>
  );
};

export default React.memo(App);