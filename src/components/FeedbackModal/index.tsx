import { memo, useState, useCallback } from 'react';
import { X, Bug, Lightbulb, ExternalLink, Send, ChevronDown, Monitor } from 'lucide-react';
import { APP_CONFIG } from '@/config';
import { getSystemInfo } from '@/utils';
import type { GpuInfo, QueueStats } from '@/types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  gpuInfo?: GpuInfo;
  stats?: QueueStats;
}

type FeedbackType = 'bug' | 'feature';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type Category = 'conversion' | 'ui' | 'performance' | 'crash' | 'other';

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

function FeedbackModal({ isOpen, onClose, gpuInfo, stats }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('bug');
  const [category, setCategory] = useState<Category>('conversion');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [includeSystemInfo, setIncludeSystemInfo] = useState(true);

  const generateIssueBody = useCallback(() => {
    const sys = getSystemInfo();
    const lines: string[] = [];

    if (type === 'bug') {
      lines.push('## Bug Report\n');
      lines.push(`**Category:** ${CATEGORIES.find(c => c.value === category)?.label}`);
      lines.push(`**Severity:** ${SEVERITIES.find(s => s.value === severity)?.label}\n`);
      lines.push(`## Description\n${description || '_No description provided_'}\n`);
      lines.push(`## Steps to Reproduce\n${stepsToReproduce || '1. \n2. \n3. '}\n`);
      lines.push(`## Expected Behavior\n${expectedBehavior || '_No expected behavior provided_'}\n`);
    } else {
      lines.push('## Feature Request\n');
      lines.push(`## Description\n${description || '_No description provided_'}\n`);
      lines.push(`## Use Case\n${stepsToReproduce || '_Why do you need this feature?_'}\n`);
      lines.push(`## Proposed Solution\n${expectedBehavior || '_How do you think this should work?_'}\n`);
    }

    if (includeSystemInfo) {
      lines.push('## System Information');
      lines.push(`- **App Version:** ${APP_CONFIG.version}`);
      lines.push(`- **OS:** ${sys.os}`);
      lines.push(`- **Platform:** ${sys.platform}`);
      if (gpuInfo) {
        lines.push(`- **GPU:** ${gpuInfo.name} (${gpuInfo.vendor})`);
        lines.push(`- **GPU Available:** ${gpuInfo.available ? 'Yes' : 'No'}`);
      }
      if (stats) {
        lines.push(`- **Queue Stats:** ${stats.total} total, ${stats.completed} completed, ${stats.failed} failed`);
      }
    }

    return lines.join('\n');
  }, [type, category, severity, description, stepsToReproduce, expectedBehavior, includeSystemInfo, gpuInfo, stats]);

  const handleSubmit = useCallback(() => {
    const issueTitle = encodeURIComponent(
      type === 'bug' ? `[Bug] ${title || 'Bug Report'}` : `[Feature] ${title || 'Feature Request'}`
    );
    const issueBody = encodeURIComponent(generateIssueBody());
    const labels = type === 'bug' ? 'bug' : 'enhancement';
    window.open(`${APP_CONFIG.github.issues}?title=${issueTitle}&body=${issueBody}&labels=${labels}`, '_blank');
    handleClose();
  }, [type, title, generateIssueBody]);

  const handleClose = useCallback(() => {
    setTitle('');
    setDescription('');
    setStepsToReproduce('');
    setExpectedBehavior('');
    setCategory('conversion');
    setSeverity('medium');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const sys = getSystemInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-800 rounded-xl shadow-2xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Send size={18} className="text-purple-400" />
            <span className="font-semibold text-white">Send Feedback</span>
          </div>
          <button onClick={handleClose} className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex gap-2">
            <TypeButton active={type === 'bug'} onClick={() => setType('bug')} icon={<Bug size={18} />} label="Report Bug" color="red" />
            <TypeButton active={type === 'feature'} onClick={() => setType('feature')} icon={<Lightbulb size={18} />} label="Request Feature" color="yellow" />
          </div>

          <Field label="Title" required>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === 'bug' ? 'Brief description of the issue' : 'What feature would you like?'}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
          </Field>

          {type === 'bug' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select value={category} onChange={e => setCategory(e.target.value as Category)} options={CATEGORIES.map(c => ({ value: c.value, label: `${c.icon} ${c.label}` }))} />
              </Field>
              <Field label="Severity">
                <Select value={severity} onChange={e => setSeverity(e.target.value as Severity)} options={SEVERITIES.map(s => ({ value: s.value, label: s.label }))} />
              </Field>
            </div>
          )}

          <Field label="Description" required>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={type === 'bug' ? 'Describe what happened...' : 'Describe the feature you want...'}
              rows={3}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-purple-500"
            />
          </Field>

          <Field label={type === 'bug' ? 'Steps to Reproduce' : 'Use Case'}>
            <textarea
              value={stepsToReproduce}
              onChange={e => setStepsToReproduce(e.target.value)}
              placeholder={type === 'bug' ? '1. Go to...\n2. Click on...\n3. See error' : 'Why do you need this feature?'}
              rows={3}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-purple-500"
            />
          </Field>

          <Field label={type === 'bug' ? 'Expected Behavior' : 'Proposed Solution'}>
            <textarea
              value={expectedBehavior}
              onChange={e => setExpectedBehavior(e.target.value)}
              placeholder={type === 'bug' ? 'What should have happened?' : 'How should this feature work?'}
              rows={2}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-purple-500"
            />
          </Field>

          <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/[0.07] transition-colors">
            <input
              type="checkbox"
              checked={includeSystemInfo}
              onChange={e => setIncludeSystemInfo(e.target.checked)}
              className="w-4 h-4 rounded bg-white/10 border-white/20 checked:bg-purple-500"
            />
            <div className="flex-1">
              <div className="text-sm text-white">Include System Information</div>
              <div className="text-xs text-white/40">OS, App version, GPU info — helps us fix issues faster</div>
            </div>
          </label>

          {includeSystemInfo && (
            <div className="p-3 bg-black/20 rounded-lg text-xs text-white/50 space-y-1">
              <div className="flex items-center gap-2 text-white/70 mb-2">
                <Monitor size={12} />
                <span>System info that will be included:</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-5">
                <span>App Version: {APP_CONFIG.version}</span>
                <span>OS: {sys.os}</span>
                <span>Platform: {sys.platform}</span>
                {gpuInfo && <span>GPU: {gpuInfo.name}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-white/10 bg-black/20 shrink-0">
          <button onClick={handleClose} className="px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !description.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-sm text-white font-medium flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExternalLink size={16} /> Open on GitHub
          </button>
        </div>
      </div>
    </div>
  );
}

function TypeButton({ active, onClick, icon, label, color }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; color: 'red' | 'yellow' }) {
  const colorClasses = {
    red: active ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-red-500/10 hover:border-red-500/30',
    yellow: active ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-yellow-500/10 hover:border-yellow-500/30',
  };
  return (
    <button onClick={onClick} className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${colorClasses[color]}`}>
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-purple-500"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
    </div>
  );
}

export default memo(FeedbackModal);