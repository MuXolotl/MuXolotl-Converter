import { useEffect } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import type { FileItem } from '@/types';

export const useTaskbarProgress = (files: FileItem[]) => {
  useEffect(() => {
    const updateTaskbarProgress = async () => {
      const totalFiles = files.length;
      if (totalFiles === 0) {
        await appWindow.setProgressBar({ status: 'none' });
        return;
      }

      const completed = files.filter(f => f.status === 'completed').length;
      const failed = files.filter(f => f.status === 'failed').length;
      const processing = files.filter(f => f.status === 'processing');
      const cancelled = files.filter(f => f.status === 'cancelled').length;

      // Если есть ошибки - показываем красный
      if (failed > 0 && processing.length === 0) {
        await appWindow.setProgressBar({
          status: 'error',
          progress: (completed + failed + cancelled) / totalFiles,
        });
        return;
      }

      // Если есть активные конвертации
      if (processing.length > 0) {
        // Считаем средний прогресс активных файлов
        const avgProgress =
          processing.reduce((sum, f) => sum + (f.progress?.percent || 0), 0) / processing.length / 100;

        const overallProgress = (completed + avgProgress) / totalFiles;

        await appWindow.setProgressBar({
          status: 'normal',
          progress: Math.min(Math.max(overallProgress, 0), 1), // clamp 0-1
        });
      } else {
        // Все завершено
        await appWindow.setProgressBar({ status: 'none' });
      }
    };

    updateTaskbarProgress();
  }, [files]);
};