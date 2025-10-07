import React, { useContext } from 'react';
import { Clock } from 'lucide-react';
import FileCard from '@/components/FileCard';
import { ConversionContext } from '@/App';
import type { FileItem } from '@/types';

interface FileListProps {
  files: FileItem[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  gpuAvailable: boolean;
  expandedAdvanced: Set<string>;
  onToggleAdvanced: (fileId: string) => void;
}

const FileList: React.FC<FileListProps> = ({
  files,
  onRemove,
  onRetry,
  gpuAvailable,
  expandedAdvanced,
  onToggleAdvanced,
}) => {
  const conversionContext = useContext(ConversionContext);

  if (!conversionContext) {
    throw new Error('FileList must be used within ConversionContext');
  }

  if (files.length === 0) {
    return (
      <div className="glass h-full flex items-center justify-center">
        <div className="text-center text-white/40">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No files in queue</p>
          <p className="text-sm mt-2">Drop files or click browse to start</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass h-full flex flex-col">
      <div className="p-3 border-b border-white/10 flex-shrink-0">
        <h3 className="text-white font-semibold">Conversion Queue ({files.length})</h3>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        <div className="space-y-3">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onRemove={() => onRemove(file.id)}
              onRetry={() => onRetry(file.id)}
              gpuAvailable={gpuAvailable}
              isAdvancedOpen={expandedAdvanced.has(file.id)}
              onToggleAdvanced={() => onToggleAdvanced(file.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(FileList);
