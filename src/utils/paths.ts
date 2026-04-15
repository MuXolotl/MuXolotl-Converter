/**
 * File path generation and manipulation utilities.
 */

import type { FileItem } from '@/types';

let idCounter = 0;

export function generateFileId(): string {
  idCounter = (idCounter + 1) % 10000;
  return `${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate output path for a file conversion.
 *
 * Uses standard naming: `basename.newext`. Collisions are resolved
 * by appending `_1`, `_2`, etc. suffixes — same approach as most
 * popular converters (HandBrake, fre:ac, foobar2000).
 */
export function generateOutputPath(
  file: FileItem,
  folder: string,
  existingPaths?: Set<string>,
): string {
  const lastDot = file.name.lastIndexOf('.');
  const baseName = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
  const outputExt = file.outputFormat.toLowerCase();
  const separator = folder.includes('\\') ? '\\' : '/';
  const normalizedFolder = folder.replace(/[\\/]+$/, '');

  let candidate = `${normalizedFolder}${separator}${baseName}.${outputExt}`;

  if (existingPaths) {
    let counter = 1;
    while (existingPaths.has(candidate)) {
      candidate = `${normalizedFolder}${separator}${baseName}_${counter}.${outputExt}`;
      counter++;
    }
  }

  return candidate;
}

export function truncatePath(path: string, maxLength = 30): string {
  if (path.length <= maxLength) return path;
  const parts = path.split(/[\\/]/);
  if (parts.length <= 2) return `${path.substring(0, maxLength - 3)}...`;
  return `${parts[0]}/.../${parts[parts.length - 1]}`;
}