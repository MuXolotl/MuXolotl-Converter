import React, { useState, useCallback } from 'react';
import { X, Bug, Lightbulb, ExternalLink, Send, ChevronDown, Monitor, Cpu, HardDrive } from 'lucide-react';
import type { GpuInfo } from '@/types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  gpuInfo?: GpuInfo;
  stats?: {
    total: number;
    completed: number;
    failed: number;
  };
}

type FeedbackType = 'bug' | 'feature';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type Category = 'conversion' | 'ui' | 'performance' | 'crash' | 'other';

const GITHUB_ISSUES_URL = 'https://github.com/MuXolotl/MuXolotl-Converter/issues/new';
const APP_VERSION = '1.0.2';

const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: 'conversion', label: 'Conversion Issue', icon: '🔄' },
  { value: 'ui', label: 'User Interface', icon: '🎨' },
  { value: 'performance', label: 'Performance', icon: '⚡' },
  { value: 'crash', label: 'Crash/Freeze', icon: '💥' },
  { value: 'other', label: 'Other', icon: '📝' },
];

const SEVERITIES: { value: Severity; label: string; color: string }[] = [
  { value: 'low', label: 'Low - Minor inconvenience', color: 'text-blue-400' },
  { value: 'medium', label: 'Medium - Affects workflow', color: 'text-yellow-400' },
  { value: 'high', label: 'High - Major functionality broken', color: 'text-orange-400' },
  { value: 'critical', label: 'Critical - App unusable', color: 'text-red-400' },
];

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, gpuInfo, stats }) => {
  const [type, setType] = useState<FeedbackType>('bug');
  const [category, setCategory] = useState<Category>('conversion');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [includeSystemInfo, setIncludeSystemInfo] = useState(true);

  const getSystemInfo = useCallback(() => {
    const ua = navigator.userAgent;
    let os = 'Unknown';
    
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    
    return { os, platform: navigator.platform };
  }, []);

  const generateIssueBody = useCallback(() => {
    const sys = getSystemInfo();
    let body = '';

    if (type === 'bug') {
      body += `## Bug Report\n\n`;
      body += `**Category:** ${CATEGORIES.find(c => c.value === category)?.label}\n`;
      body += `**Severity:** ${SEVERITIES.find(s => s.value === severity)?.label}\n\n`;
      body += `## Description\n${description || '_No description provided_'}\n\n`;
      body += `## Steps to Reproduce\n${stepsToReproduce || '1. \n2. \n3. '}\n\n`;
      body += `## Expected Behavior\n${expectedBehavior || '_No expected behavior provided_'}\n\n`;
    } else {
      body += `## Feature Request\n\n`;
      body += `## Description\n${description || '_No description provided_'}\n\n`;
      body += `## Use Case\n${stepsToReproduce || '_Why do you need this feature?_'}\n\n`;
      body += `## Proposed Solution\n${expectedBehavior || '_How do you think this should work?_'}\n\n`;
    }

    if (includeSystemInfo) {
      body += `## System Information\n`;
      body += `- **App Version:** ${APP_VERSION}\n`;
      body += `- **OS:** ${sys.os}\n`;
      body += `- **Platform:** ${sys.platform}\n`;
      
      if (gpuInfo) {
        body += `- **GPU:** ${gpuInfo.name} (${gpuInfo.vendor})\n`;
        body += `- **GPU Available:** ${gpuInfo.available ? 'Yes' : 'No'}\n`;
      }
      
      if (stats) {
        body += `- **Queue Stats:** ${stats.total} total, ${stats.completed} completed, ${stats.failed} failed\n`;
      }
    }

    return body;
  }, [type, category, severity, description, stepsToReproduce, expectedBehavior, includeSystemInfo, gpuInfo, stats, getSystemInfo]);

  const handleSubmit = useCallback(() => {
    const issueTitle = encodeURIComponent(
      type === 'bug' 
        ? `[Bug] ${title || 'Bug Report'}`
        : `[Feature] ${title || 'Feature Request'}`
    );
    const issueBody = encodeURIComponent(generateIssueBody());
    const labels = type === 'bug' ? 'bug' : 'enhancement';
    
    window.open(`${GITHUB_ISSUES_URL}?title=${issueTitle}&body=${issueBody}&labels=${labels}`, '_blank');
    onClose();
  }, [type, title, generateIssueBody, onClose]);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setStepsToReproduce('');
    setExpectedBehavior('');
    setCategory('conversion');
    setSeverity('medium');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  if (!isOpen) return null;

  const sys = getSystemInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-800 rounded-xl shadow-2xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Send size={18} className="text-purple-400" />
            <span className="font-semibold text-white">Send Feedback</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Type Selector */}
          <div className="flex gap-2">
            <TypeButton
              active={type === 'bug'}
              onClick={() => setType('bug')}
              icon={<Bug size={18} />}
              label="Report Bug"
              color="red"
            />
            <TypeButton
              active={type === 'feature'}
              onClick={() => setType('feature')}
              icon={<Lightbulb size={18} />}
              label="Request Feature"
              color="yellow"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === 'bug' ? 'Brief description of the issue' : 'What feature would you like?'}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Bug-specific fields */}
          {type === 'bug' && (
            <div className="grid grid-cols-2 gap-3">
              {/* Category */}
              <div>
                <label className="block text-xs text-white/60 mb-1.5">Category</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as Category)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-purple-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className="block text-xs text-white/60 mb-1.5">Severity</label>
                <div className="relative">
                  <select
                    value={severity}
                    onChange={e => setSeverity(e.target.value as Severity)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-purple-500"
                  >
                    {SEVERITIES.map(sev => (
                      <option key={sev.value} value={sev.value}>
                        {sev.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={type === 'bug' ? 'Describe what happened...' : 'Describe the feature you want...'}
              rows={3}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Steps / Use Case */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5">
              {type === 'bug' ? 'Steps to Reproduce' : 'Use Case'}
            </label>
            <textarea
              value={stepsToReproduce}
              onChange={e => setStepsToReproduce(e.target.value)}
              placeholder={type === 'bug' ? '1. Go to...\n2. Click on...\n3. See error' : 'Why do you need this feature?'}
              rows={3}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Expected Behavior / Proposed Solution */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5">
              {type === 'bug' ? 'Expected Behavior' : 'Proposed Solution'}
            </label>
            <textarea
              value={expectedBehavior}
              onChange={e => setExpectedBehavior(e.target.value)}
              placeholder={type === 'bug' ? 'What should have happened?' : 'How should this feature work?'}
              rows={2}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* System Info Toggle */}
          <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/[0.07] transition-colors">
            <input
              type="checkbox"
              checked={includeSystemInfo}
              onChange={e => setIncludeSystemInfo(e.target.checked)}
              className="w-4 h-4 rounded bg-white/10 border-white/20 checked:bg-purple-500"
            />
            <div className="flex-1">
              <div className="text-sm text-white">Include System Information</div>
              <div className="text-xs text-white/40">
                OS, App version, GPU info — helps us fix issues faster
              </div>
            </div>
          </label>

          {/* System Info Preview */}
          {includeSystemInfo && (
            <div className="p-3 bg-black/20 rounded-lg text-xs text-white/50 space-y-1">
              <div className="flex items-center gap-2 text-white/70 mb-2">
                <Monitor size={12} />
                <span>System info that will be included:</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-5">
                <span>App Version: {APP_VERSION}</span>
                <span>OS: {sys.os}</span>
                <span>Platform: {sys.platform}</span>
                {gpuInfo && <span>GPU: {gpuInfo.name}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-white/10 bg-black/20 shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !description.trim()}
            className="px-6 py-2.5 bg-gradient-primary rounded-lg text-sm text-white font-medium flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExternalLink size={16} />
            Open on GitHub
          </button>
        </div>
      </div>
    </div>
  );
};

interface TypeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: 'red' | 'yellow';
}

const TypeButton: React.FC<TypeButtonProps> = ({ active, onClick, icon, label, color }) => {
  const colorClasses = {
    red: active 
      ? 'bg-red-500/20 border-red-500/50 text-red-400' 
      : 'bg-white/5 border-white/10 text-white/60 hover:bg-red-500/10 hover:border-red-500/30',
    yellow: active 
      ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' 
      : 'bg-white/5 border-white/10 text-white/60 hover:bg-yellow-500/10 hover:border-yellow-500/30',
  };

  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${colorClasses[color]}`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
};

export default React.memo(FeedbackModal);