
export interface Acordao {
  id: string;
  processo: string;
  relator: string;
  adjuntos: string[];
  data: string;
  sumario: string;
  descritores: string[]; // List of legal tags/descriptors
  textoAnalise: string; // The extracted legal analysis
  textoCompleto: string; // Full extracted text for reference
  fileName: string;
}

export interface SearchFilters {
  processo: string;
  relator: string;
  adjunto: string;
  descritor: string; // New filter field
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
  sources?: Acordao[]; // References for the answer
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
  name?: string; // User defined name for the search
  filters: SearchFilters;
  results: Acordao[];
  date: number;
}

// Global window extension for PDF.js and File System API
declare global {
  interface Window {
    pdfjsLib: any;
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
  }
}
