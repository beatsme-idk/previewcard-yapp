// Step types
export type Step = {
  id: string;
  title: string;
  description: string;
};

// File upload types
export type ImageFile = {
  name: 'inner' | 'outer' | 'overlay';
  file: File | null;
  preview: string | null; // Base64 data URL or null
};

// Preview types
export type PreviewData = {
  baseUrl: string;
  files: {
    inner: string | null;
    outer: string | null;
    overlay: string | null;
  };
};

// ENS Record types
export type ENSRecord = {
  tokenSymbols?: string[];
  og?: {
    baseUrl: string;
  };
  [key: string]: any;
};

// Folder path type
export type FolderPath = {
  username: string;
  repo: string;
  folder: string;
};
