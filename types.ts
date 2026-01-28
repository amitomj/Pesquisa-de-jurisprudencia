
export interface Acordao {
  id: string;
  processo: string;
  relator: string;
  adjuntos: string[];
  data: string;
  sumario: string;
  descritores: string[];
  textoAnalise: string; // Primeiras e últimas páginas para IA
  fileName: string;
  filePath: string; 
  tipoDecisao: 'Acórdão' | 'Decisão Sumária';
  // Segmentação Estrutural (Textos menores e limpos)
  relatorio: string;
  factosProvados: string;
  factosNaoProvados: string;
  fundamentacaoDireito: string;
}

export interface SearchFilters {
  processo: string;
  relator: string;
  adjunto: string;
  descritor: string;
  dataInicio: string;
  dataFim: string;
  booleanAnd: string;
  booleanOr: string;
  booleanNot: string;
}

// SearchResult interface added to match usage in exportService.ts
export interface SearchResult {
  date: string | number | Date;
  filters: SearchFilters;
  results: Acordao[];
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

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    pdfjsLib: any;
    aistudio?: AIStudio;
  }
}
