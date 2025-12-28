

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

// Interface representing the AI Studio environment controls.
// Defined outside declare global to allow standard export and resolve "Cannot export 'AIStudio'" error.
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    pdfjsLib: any;
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
    /**
     * aistudio property is injected by the environment.
     * Added 'readonly' back to match the mandatory modifiers of the ambient environment declaration.
     */
    readonly aistudio: AIStudio;
  }
}
