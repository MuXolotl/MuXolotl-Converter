import { useCallback, useEffect, useRef } from 'react';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/api/notification';
import type { FileItem } from '@/types';

export const useNotifications = () => {
  const permissionGranted = useRef(false);

  useEffect(() => {
    const checkPermission = async () => {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === 'granted';
      }
      permissionGranted.current = granted;
    };
    checkPermission();
  }, []);

  const notifyFileCompleted = useCallback(async (file: FileItem) => {
    if (!permissionGranted.current) return;

    await sendNotification({
      title: '✅ Conversion Complete',
      body: `${file.name} → ${file.outputFormat.toUpperCase()}`,
    });
  }, []);

  const notifyFileFailed = useCallback(async (file: FileItem) => {
    if (!permissionGranted.current) return;

    await sendNotification({
      title: '❌ Conversion Failed',
      body: `${file.name}: ${file.error || 'Unknown error'}`,
    });
  }, []);

  const notifyQueueCompleted = useCallback(async (completedCount: number, failedCount: number) => {
    if (!permissionGranted.current) return;

    await sendNotification({
      title: '🎉 Queue Complete!',
      body: `${completedCount} files converted${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
    });
  }, []);

  return { notifyFileCompleted, notifyFileFailed, notifyQueueCompleted };
};
