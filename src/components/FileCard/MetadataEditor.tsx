import React from 'react';
import { Tag, Music, User, Disc, Calendar } from 'lucide-react';
import { FileMetadata } from '@/types';

interface MetadataEditorProps {
  metadata: FileMetadata | undefined;
  onChange: (updates: FileMetadata) => void;
  disabled: boolean;
}

const MetadataEditor: React.FC<MetadataEditorProps> = ({ metadata = {}, onChange, disabled }) => {
  const handleChange = (field: keyof FileMetadata, value: string) => {
    onChange({ ...metadata, [field]: value });
  };

  const inputs = [
    { key: 'title', icon: Tag, placeholder: 'Title', width: 'col-span-2' },
    { key: 'artist', icon: User, placeholder: 'Artist', width: 'col-span-1' },
    { key: 'album', icon: Disc, placeholder: 'Album', width: 'col-span-1' },
    { key: 'genre', icon: Music, placeholder: 'Genre', width: 'col-span-1' },
    { key: 'year', icon: Calendar, placeholder: 'Year', width: 'col-span-1' },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3">
      {inputs.map(({ key, icon: Icon, placeholder, width }) => (
        <div key={key} className={`${width} relative`}>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
            <Icon size={14} />
          </div>
          <input
            type="text"
            value={metadata[key] || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 pl-9 text-xs text-white placeholder-white/20 focus:outline-none focus:border-primary-purple focus:bg-white/10 transition-all disabled:opacity-50"
          />
        </div>
      ))}
    </div>
  );
};

export default React.memo(MetadataEditor);