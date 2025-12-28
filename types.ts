

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
  /**
   * Interface representing the AI Studio environment controls.
   * Defined globally to match environment definitions and avoid type name collisions.
   */
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    pdfjsLib: any;
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
    /**
     * aistudio property is injected by the environment.
     * Fixed: removed 'readonly' and matching the global interface declaration 
     * to resolve modifier mismatch and type collision errors.
     */
    aistudio: AIStudio;
  }
}

// Exporting the type for explicit imports if needed by other components.
export type { AIStudio };
