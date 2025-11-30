import React, { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useGpu } from '@/hooks/useGpu';
import { useFileQueue } from '@/hooks/useFileQueue';
import { useConversion } from '@/hooks/useConversion';
import { saveOutputFolder, loadOutputFolder } from '@/utils';
import type { ConversionContextType } from '@/types';

// Layout Components
import SplitPane from '@/components/Layout/SplitPane';
import Sidebar from '@/components/Sidebar';
import Queue from '@/components/Queue';
import Inspector from '@/components/Inspector';
import OutputFolderSelector from '@/components/OutputFolderSelector';
import GpuIndicator from '@/components/GpuIndicator';

export const ConversionContext = React.createContext<ConversionContextType | null>(null);

const App: React.FC = () => {
  // State
  const [ffmpegReady, setFfmpegReady] = useState<boolean | null>(null);
  const [outputFolder, setOutputFolder] = useState<string>('');
  const [activeTab, setActiveTab] = useState('queue');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Hooks
  const { gpuInfo, isLoading: gpuLoading } = useGpu();
  const { files, addFiles, removeFile, updateFile, clearAll, retryFile, filesRef } = useFileQueue(outputFolder);
  const conversionCtx = useConversion(updateFile, gpuInfo, filesRef);

  // Init
  useEffect(() => {
    invoke<boolean>('check_ffmpeg').then(setFfmpegReady).catch(() => setFfmpegReady(false));
    const saved = loadOutputFolder();
    if (saved) setOutputFolder(saved);
  }, []);

  useEffect(() => {
    if (outputFolder) saveOutputFolder(outputFolder);
  }, [outputFolder]);

  // Derived
  const selectedFile = files.find(f => f.id === selectedFileId) || null;
  
  // Auto-select newly added file
  const handleFilesAdded = (newFiles: any[]) => {
      addFiles(newFiles);
      if (newFiles.length > 0) setSelectedFileId(newFiles[0].id);
  };

  const handleRemove = (id: string) => {
      removeFile(id);
      if (selectedFileId === id) setSelectedFileId(null);
  };

  if (ffmpegReady === null) return <div className="h-screen w-screen bg-gradient-main flex items-center justify-center text-white">Loading Core...</div>;

  return (
    <ConversionContext.Provider value={conversionCtx}>
      <div className="h-screen w-screen bg-[#0f172a] text-white flex overflow-hidden">
        {/* 1. Left Sidebar (Fixed) */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* 2. Content Area (Split View) */}
        <div className="flex-1 h-full overflow-hidden flex flex-col">
           {/* Top Bar / Toolbar (Optional place for Global Controls) */}
           <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-black/20 shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="font-bold text-lg gradient-text">Queue</h1>
                    <div className="h-6 w-[1px] bg-white/10" />
                    <div className="text-xs text-white/40">{files.length} items</div>
                    {!gpuLoading && <div className="scale-75 origin-left"><GpuIndicator gpuInfo={gpuInfo} /></div>}
                </div>

                <div className="flex items-center gap-3">
                    <OutputFolderSelector outputFolder={outputFolder} onFolderChange={setOutputFolder} />
                    {/* Global Convert All button could go here too */}
                </div>
           </div>

           {/* Split View: Queue | Inspector */}
           <div className="flex-1 min-h-0 relative">
               <SplitPane
                  initialLeftWidth={window.innerWidth * 0.65} // Queue takes 65% by default
                  minLeftWidth={400}
                  maxLeftWidth={1200}
                  left={
                    <Queue 
                        files={files} 
                        selectedId={selectedFileId} 
                        onSelect={setSelectedFileId}
                        onFilesAdded={handleFilesAdded}
                    />
                  }
                  right={
                    <Inspector 
                        file={selectedFile} 
                        onRemove={handleRemove}
                        onRetry={retryFile}
                    />
                  }
               />
           </div>
        </div>
      </div>
    </ConversionContext.Provider>
  );
};

export default React.memo(App);