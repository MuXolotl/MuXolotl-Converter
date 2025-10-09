import { useCallback } from 'react';
import { generateOutputPath } from '@/utils';
import type { FileItem } from '@/types';

interface UseFileManagerProps {
  files: FileItem[];
  setFiles: React.Dispatch<React.SetStateAction<FileItem[]>>;
  outputFolder: string;
  maxFiles: number;
  setExpandedAdvanced: React.Dispatch<React.SetStateAction<Set<string>>>;
  setExpandedCompactCard: React.Dispatch<React.SetStateAction<string | null>>;
}

export const useFileManager = ({
  files,
  setFiles,
  outputFolder,
  maxFiles,
  setExpandedAdvanced,
  setExpandedCompactCard,
}: UseFileManagerProps) => {
  const handleFilesAdded = useCallback(
    (newFiles: FileItem[]) => {
      const availableSlots = maxFiles - files.length;

      if (availableSlots <= 0) {
        alert(`⚠️ Queue is full! Maximum ${maxFiles} files allowed.`);
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
    [files, outputFolder, maxFiles, setFiles]
  );

  const handleFileRemove = useCallback(
    (fileId: string) => {
      setFiles(prev => prev.filter(f => f.id !== fileId));
      setExpandedAdvanced(prev => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
      setExpandedCompactCard(prev => (prev === fileId ? null : prev));
    },
    [setFiles, setExpandedAdvanced, setExpandedCompactCard]
  );

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
  }, [files, outputFolder, setFiles]);

  const handleClearCompleted = useCallback(() => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'));
  }, [setFiles]);

  const handleClearAll = useCallback(() => {
    setFiles([]);
  }, [setFiles]);

  return {
    handleFilesAdded,
    handleFileRemove,
    handleApplyToAll,
    handleClearCompleted,
    handleClearAll,
  };
};