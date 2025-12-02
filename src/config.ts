/**
 * Application configuration
 * Single source of truth for app-wide constants
 */

export const APP_CONFIG = {
  name: 'MuXolotl-Converter',
  version: '1.0.2',
  
  github: {
    repo: 'https://github.com/MuXolotl/MuXolotl-Converter',
    issues: 'https://github.com/MuXolotl/MuXolotl-Converter/issues/new',
  },
  
  limits: {
    maxQueueSize: 50,
    maxParallelConversions: 4,
    queuePersistenceDays: 7,
    autosaveDebounceMs: 2000,
    validationDebounceMs: 300,
    progressThrottleMs: 100,
  },
  
  storage: {
    keys: {
      queue: 'muxolotl_queue',
      outputFolder: 'muxolotl_output_folder',
    },
    version: 1,
  },
} as const;

export type AppConfig = typeof APP_CONFIG;