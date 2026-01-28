
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
  filePath: string; // Caminho relativo para distinguir ficheiros com nomes iguais em subpastas
  tipoDecisao: 'Acórdão' | 'Decisão Sumária';
  // Segmentação Estrutural
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
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    pdfjsLib: any;
    aistudio?: AIStudio;
  }
}
