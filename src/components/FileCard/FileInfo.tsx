import React from 'react';
import { FileAudio, FileVideo } from 'lucide-react';
import { formatFileSize, formatDuration } from '@/constants';
import type { FileItem } from '@/types';

interface FileInfoProps {
  file: FileItem;
  isVideo: boolean;
}

const FileInfo: React.FC<FileInfoProps> = ({ file, isVideo }) => (
  <div className="flex items-start gap-3">
    <div className="flex-shrink-0 mt-1">
      {isVideo ? (
        <FileVideo size={40} className="text-primary-pink" />
      ) : (
        <FileAudio size={40} className="text-primary-purple" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <h4 className="text-white font-semibold truncate" title={file.name}>
        {file.name}
      </h4>
      <div className="flex flex-col gap-1 mt-1 text-xs text-white/60">
        <span className="px-2 py-0.5 rounded bg-white/10 uppercase font-mono inline-block w-fit">
          {isVideo ? 'Video' : 'Audio'}
        </span>
        {file.mediaInfo && (
          <>
            <span>{formatDuration(file.mediaInfo.duration)}</span>
            <span>{formatFileSize(file.mediaInfo.file_size)}</span>
          </>
        )}
      </div>
    </div>
  </div>
);

export default React.memo(FileInfo);
