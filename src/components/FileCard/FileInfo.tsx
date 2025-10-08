import React from 'react';
import { FileAudio, FileVideo } from 'lucide-react';
import { formatFileSize, formatDuration } from '@/constants';
import type { FileItem } from '@/types';

interface FileInfoProps {
  file: FileItem;
  isVideo: boolean;
}

const FileInfo: React.FC<FileInfoProps> = ({ file, isVideo }) => (
  <div className="flex items-start gap-2">
    {/* Icon + type*/}
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      {isVideo ? (
        <FileVideo size={32} className="text-primary-pink" />
      ) : (
        <FileAudio size={32} className="text-primary-purple" />
      )}
      <span className="px-1.5 py-0.5 rounded bg-white/10 uppercase font-mono text-[9px] text-white/70">
        {isVideo ? 'Video' : 'Audio'}
      </span>
    </div>

    {/* Name + metadata */}
    <div className="flex-1 min-w-0">
      <h4 className="text-white font-semibold truncate text-sm" title={file.name}>
        {file.name}
      </h4>
      {file.mediaInfo && (
        <div className="flex items-center gap-2 mt-1 text-[10px] text-white/60">
          <span>{formatDuration(file.mediaInfo.duration)}</span>
          <span className="text-white/30">•</span>
          <span>{formatFileSize(file.mediaInfo.file_size)}</span>
        </div>
      )}
    </div>
  </div>
);

export default React.memo(FileInfo);
