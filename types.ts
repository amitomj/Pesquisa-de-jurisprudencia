


export interface Acordao {
  id: string;
  processo: string;
  relator: string;
  adjuntos: string[];
  data: string;
  sumario: string;
  descritores: string[];
  textoAnalise: string;
  textoCompleto: string;
  fileName: string;
  tipoDecisao: 'Acórdão' | 'Decisão Sumária';
}

export interface SearchFilters {
  processo: string;
  relator: string;
  adjunto: string;
  descritores: string[]; 
  dataInicio: string;
  dataFim: string;
  booleanAnd: string;
  booleanOr: string;
  booleanNot: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  sources?: Acordao[];
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

export interface SearchResult {
  id: string;
  name?: string;
  filters: SearchFilters;
  results: Acordao[];
  date: number;
}

declare global {
  // Interface representing the AI Studio environment controls.
  // Moved inside declare global to fix "Subsequent property declarations must have the same type" 
  // and resolve identity mismatches between local and global scope.
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    pdfjsLib: any;
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
    /**
     * aistudio property is injected by the environment.
     * Removed 'readonly' modifier to fix the "All declarations of 'aistudio' must have identical modifiers" error.
     */
    aistudio: AIStudio;
  }
}