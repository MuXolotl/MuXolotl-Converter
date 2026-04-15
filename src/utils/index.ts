/**
 * Central re-export hub for all utilities.
 *
 * Import from '@/utils' works as before — no changes needed in consumers.
 */

export { formatFileSize, formatDuration, formatEta } from './format';
export {
  generateFileId,
  generateOutputPath,
  truncatePath,
} from './paths';
export {
  processFilePaths,
  getDefaultFormat,
  getDefaultSettings,
} from './media';
export {
  saveQueue,
  loadQueue,
  clearQueue,
  saveOutputFolder,
  loadOutputFolder,
} from './storage';

// General utilities that don't belong to a specific domain

import type { FileItem, ConversionStatus, QueueStats, SystemInfo } from '@/types';

const STATUS_PRIORITY: Record<ConversionStatus, number> = {
  processing: 0,
  pending: 1,
  cancelled: 2,
  failed: 3,
  completed: 4,
};

export function sortFilesByStatus(files: FileItem[]): FileItem[] {
  return [...files].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    if (['completed', 'failed', 'cancelled'].includes(a.status)) {
      return (b.completedAt || 0) - (a.completedAt || 0);
    }
    return (b.addedAt || 0) - (a.addedAt || 0);
  });
}

export function getQueueStats(files: FileItem[]): QueueStats {
  return {
    total: files.length,
    pending: files.filter((f) => f.status === 'pending').length,
    processing: files.filter((f) => f.status === 'processing').length,
    completed: files.filter((f) => f.status === 'completed').length,
    failed: files.filter((f) => f.status === 'failed').length,
  };
}

export function getSystemInfo(): SystemInfo {
  const ua = navigator.userAgent;
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  return {
    os,
    platform: navigator.platform,
    language: navigator.language,
  };
}