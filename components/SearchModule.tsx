import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Acordao, SearchFilters, SearchResult } from '../types';
import { Search, Filter, Eye, FileText, Download, Trash2, X, Edit2, RotateCcw, CheckCircle, ChevronLeft, ChevronRight, AlertTriangle, Save, MousePointerClick, Highlighter, Tag, Plus, Settings, AlignLeft, File as FileIcon, ZoomIn, ZoomOut, Wand2, Loader2 } from 'lucide-react';
import { exportSearchResults } from '../services/exportService';
import { suggestDescriptorsWithAI } from '../services/geminiService';

// ... (keep PdfViewer and helper functions exactly as they are)
const parseDate = (dateStr: string): number => {
  const parts = dateStr.split(/[-/.]/);
  if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  return 0;
};
const levenshtein = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
    }
  }
  return matrix[b.length][a.length];
};
const fuzzyMatch = (text: string, term: string): boolean => {
  if (!term) return true;
  if (!text) return false;
  const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const nText = normalize(text);
  const nTerm = normalize(term);
  if (nText.includes(nTerm)) return true;
  const cleanSeparators = (str: string) => str.replace(/[-/.\s]/g, "");
  if (cleanSeparators(nText).includes(cleanSeparators(nTerm))) return true;
  if (nTerm.length > 3) {
      const threshold = nTerm.length > 6 ? 2 : 1;
      const words = nText.split(/[\s,.;]+/);
      for (const word of words) {
          if (Math.abs(word.length - nTerm.length) > threshold) continue;
          if (levenshtein(word, nTerm) <= threshold) return true;
      }
  }
  return false;
};

// PdfViewer Component
const PdfViewer: React.FC<{ data: ArrayBuffer | null }> = ({ data }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [pageNum, setPageNum] = useState(1);
    const [scale, setScale] = useState(1.2);
    const [error, setError] = useState<string | null>(null);
    const [inputPage, setInputPage] = useState('1');
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        if (!data) return;
        const loadPdf = async () => {
            try {
                // @ts-ignore
                const loadingTask = window.pdfjsLib.getDocument({ data });
                const doc = await loadingTask.promise;
                setPdfDoc(doc);
                setPageNum(1);
                setInputPage('1');
                setError(null);
            } catch (err: any) {
                console.error("Error loading PDF", err);
                setError("Erro ao carregar PDF. Tente o modo de texto.");
            }
        };
        loadPdf();
    }, [data]);

    useEffect(() => {
        if (!pdfDoc) return;
        renderPage(pageNum);
        setInputPage(String(pageNum));
    }, [pdfDoc, pageNum, scale]);

    const renderPage = async (num: number) => {
        try {
            const page = await pdfDoc.getPage(num);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            if (!canvas) return;
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            if (renderTaskRef.current) {
                try { await renderTaskRef.current.cancel(); } catch (e) {}
            }
            const renderContext = { canvasContext: context, viewport: viewport };
            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;
            await renderTask.promise;
            renderTaskRef.current = null;
        } catch (err: any) {
            if (err?.name !== 'RenderingCancelledException') console.error(err);
        }
    };

    const handlePageSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const p = parseInt(inputPage);
        if (p >= 1 && p <= (pdfDoc?.numPages || 1)) setPageNum(p);
        else setInputPage(String(pageNum));
    };

    if (error) return <div className="p-4 text-red-500 text-sm flex items-center justify-center h-full">{error}</div>;
    if (!data) return <div className="p-4 text-gray-400 flex items-center justify-center h-full">A carregar documento...</div>;

    return (
        <div className="flex flex-col h-full bg-gray-200">
            <div className="bg-gray-700 text-white p-2 flex justify-between items-center shadow-md flex-shrink-0 z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} className="p-1 hover:bg-gray-600 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
                    <form onSubmit={handlePageSubmit} className="flex items-center gap-1">
                        <input type="text" className="w-10 text-center text-xs bg-gray-600 border border-gray-500 rounded text-white px-1 py-0.5" value={inputPage} onChange={(e) => setInputPage(e.target.value)} onBlur={() => setInputPage(String(pageNum))}/>
                        <span className="text-xs font-mono">/ {pdfDoc?.numPages || '-'}</span>
                    </form>
                    <button onClick={() => setPageNum(p => Math.min(pdfDoc?.numPages || 1, p + 1))} disabled={!pdfDoc || pageNum >= pdfDoc.numPages} className="p-1 hover:bg-gray-600 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-1 hover:bg-gray-600 rounded" title="Reduzir Zoom"><ZoomOut className="w-4 h-4"/></button>
                    <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-1 hover:bg-gray-600 rounded" title="Aumentar Zoom"><ZoomIn className="w-4 h-4"/></button>
                </div>
            </div>
            <div className="flex-1 overflow-auto flex justify-center p-4 bg-gray-300 relative">
                 <canvas ref={canvasRef} className="shadow-lg bg-white" />
            </div>
        </div>
    );
};

interface Props {
  db: Acordao[];
  onSaveSearch: (result: SearchResult) => void;
  savedSearches: SearchResult[];
  onDeleteSearch: (id: string) => void;
  onUpdateSearchName: (id: string, name: string) => void;
  onOpenPdf: (fileName: string) => void;
  onGetPdfData: (fileName: string) => Promise<ArrayBuffer | null>;
  onUpdateAcordao: (item: Acordao) => void;
  availableDescriptors: string[];
  availableJudges: string[];
  onAddDescriptors: (tags: string[]) => void;
}

const ITEMS_PER_PAGE = 20;

const SearchModule: React.FC<Props> = ({ 
    db, onSaveSearch, savedSearches, onDeleteSearch, onUpdateSearchName, 
    onOpenPdf, onGetPdfData, onUpdateAcordao, availableDescriptors, availableJudges, onAddDescriptors 
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    processo: '', relator: '', adjunto: '', descritor: '', dataInicio: '', dataFim: '', booleanAnd: '', booleanOr: '', booleanNot: ''
  });
  const [showBoolean, setShowBoolean] = useState(false);
  const [results, setResults] = useState<Acordao[]>([]);
  
  // Correction Mode State
  const [correctionMode, setCorrectionMode] = useState<Acordao | null>(null);
  const [correctionForm, setCorrectionForm] = useState<Acordao | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [viewMode, setViewMode] = useState<'pdf' | 'text'>('pdf'); 
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Summary View Mode State
  const [summaryView, setSummaryView] = useState<Acordao | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [descriptorInput, setDescriptorInput] = useState('');

  // Initial Sort
  useEffect(() => {
    const sorted = [...db].sort((a, b) => parseDate(b.data) - parseDate(a.data));
    setResults(sorted);
  }, [db]);

  useEffect(() => {
     if (correctionMode) {
         setViewMode('pdf');
         setPdfData(null);
         onGetPdfData(correctionMode.fileName).then(buffer => setPdfData(buffer));
     }
  }, [correctionMode]);

  const handleSearch = () => {
    const filtered = db.filter(item => {
      if (filters.processo && !fuzzyMatch(item.processo, filters.processo)) return false;
      if (filters.relator && !fuzzyMatch(item.relator, filters.relator)) return false;
      if (filters.adjunto && !item.adjuntos.some(a => fuzzyMatch(a, filters.adjunto))) return false;
      if (filters.descritor && item.descritores && !item.descritores.some(d => fuzzyMatch(d, filters.descritor))) return false;
      if (filters.dataInicio || filters.dataFim) {
        const itemDate = parseDate(item.data);
        if (itemDate === 0) return false; 
        if (filters.dataInicio && itemDate < parseDate(filters.dataInicio)) return false;
        if (filters.dataFim && itemDate > parseDate(filters.dataFim)) return false;
      }
      const content = (item.sumario + ' ' + item.textoAnalise);
      if (filters.booleanAnd && !filters.booleanAnd.split(' ').filter(Boolean).every(t => fuzzyMatch(content, t))) return false;
      if (filters.booleanNot && filters.booleanNot.split(' ').filter(Boolean).some(t => fuzzyMatch(content, t))) return false;
      if (filters.booleanOr && !filters.booleanOr.split(' ').filter(Boolean).some(t => fuzzyMatch(content, t))) return false;
      return true;
    });
    filtered.sort((a, b) => parseDate(b.data) - parseDate(a.data));
    setResults(filtered);
    setCurrentPage(1);
    onSaveSearch({ id: crypto.randomUUID(), name: `Pesquisa ${savedSearches.length + 1}`, filters: { ...filters }, results: filtered, date: Date.now() });
  };

  const openCorrection = (item: Acordao) => {
    setCorrectionMode(item);
    setCorrectionForm({...item, descritores: item.descritores || []});
  };

  const saveCorrection = () => {
    if (correctionForm) {
      // Remove asterisk from any descriptors before saving
      const cleanedDescriptors = correctionForm.descritores.map(d => d.startsWith('*') ? d.substring(1) : d);
      const cleanedForm = { ...correctionForm, descritores: cleanedDescriptors };
      
      onUpdateAcordao(cleanedForm);
      setResults(prev => prev.map(r => r.id === cleanedForm.id ? cleanedForm : r));
      setCorrectionMode(null);
      setCorrectionForm(null);
      setPdfData(null);
    }
  };

  const getClipboardAndSet = async (field: 'relator' | 'data' | 'sumario' | 'adjuntos') => {
    if (!correctionForm) return;
    try {
        const text = await navigator.clipboard.readText();
        if (!text) return alert("Clipboard vazio.");
        const selection = text.trim();
        if (field === 'adjuntos') {
            setCorrectionForm({ ...correctionForm, adjuntos: [...correctionForm.adjuntos, selection] });
        } else {
            setCorrectionForm({ ...correctionForm, [field]: selection });
        }
    } catch (err) { alert("Erro ao ler Clipboard."); }
  };

  const addDescriptorToForm = (desc: string) => {
     if (!correctionForm) return;
     // remove * if manually added
     const clean = desc.startsWith('*') ? desc.substring(1) : desc;
     if (!correctionForm.descritores.includes(clean)) {
        setCorrectionForm({ ...correctionForm, descritores: [...correctionForm.descritores, clean] });
     }
     setDescriptorInput('');
  };

  const confirmDescriptor = (index: number) => {
      if (!correctionForm) return;
      const desc = correctionForm.descritores[index];
      if (desc.startsWith('*')) {
          const newDescs = [...correctionForm.descritores];
          newDescs[index] = desc.substring(1);
          setCorrectionForm({...correctionForm, descritores: newDescs});
      }
  };

  const handleMagicWand = async () => {
      if (!correctionForm || !availableDescriptors.length) return;
      setIsSuggesting(true);
      try {
          const suggestions = await suggestDescriptorsWithAI(correctionForm.sumario, availableDescriptors);
          if (suggestions.length > 0) {
              // Add only new ones
              const current = new Set(correctionForm.descritores);
              const toAdd = suggestions.filter(s => !current.has(s) && !current.has(s.replace('*', '')));
              setCorrectionForm({
                  ...correctionForm,
                  descritores: [...correctionForm.descritores, ...toAdd]
              });
          } else {
              alert("A IA não encontrou descritores correspondentes na lista oficial para este sumário.");
          }
      } catch (e) {
          alert("Erro ao obter sugestões.");
      } finally {
          setIsSuggesting(false);
      }
  };

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const displayedResults = results.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="flex h-full gap-6 p-6 relative">
      <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-hidden">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 overflow-y-auto max-h-[60%]">
          <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-legal-800">Pesquisa</h3></div>
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-gray-500 uppercase">Processo</label><input type="text" className="w-full p-2 border rounded text-sm" value={filters.processo} onChange={e => setFilters({...filters, processo: e.target.value})} /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase">Relator</label><input type="text" list="judges-list" className="w-full p-2 border rounded text-sm" value={filters.relator} onChange={e => setFilters({...filters, relator: e.target.value})} /><datalist id="judges-list">{availableJudges.map((r, i) => <option key={i} value={r} />)}</datalist></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase">Adjunto</label><input type="text" list="adjuntos-list" className="w-full p-2 border rounded text-sm" value={filters.adjunto} onChange={e => setFilters({...filters, adjunto: e.target.value})} /><datalist id="adjuntos-list">{availableJudges.map((r, i) => <option key={i} value={r} />)}</datalist></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase">Descritor</label><input type="text" list="descritores-search-list" className="w-full p-2 border rounded text-sm" value={filters.descritor} onChange={e => setFilters({...filters, descritor: e.target.value})} /><datalist id="descritores-search-list">{availableDescriptors.map((r, i) => <option key={i} value={r} />)}</datalist></div>
            <div className="grid grid-cols-2 gap-2"><input type="text" className="w-full p-2 border rounded text-sm" placeholder="Data Início" value={filters.dataInicio} onChange={e => setFilters({...filters, dataInicio: e.target.value})} /><input type="text" className="w-full p-2 border rounded text-sm" placeholder="Data Fim" value={filters.dataFim} onChange={e => setFilters({...filters, dataFim: e.target.value})} /></div>
          </div>
          <button onClick={() => setShowBoolean(!showBoolean)} className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-medium text-legal-600 bg-legal-50 py-2 rounded border border-legal-200 hover:bg-legal-100"><Filter className="w-4 h-4" /> Filtros Booleanos</button>
          {showBoolean && (<div className="mt-4 space-y-3 bg-gray-50 p-3 rounded text-sm"><input type="text" className="w-full p-2 border rounded" placeholder="AND" value={filters.booleanAnd} onChange={e => setFilters({...filters, booleanAnd: e.target.value})} /><input type="text" className="w-full p-2 border rounded" placeholder="OR" value={filters.booleanOr} onChange={e => setFilters({...filters, booleanOr: e.target.value})} /><input type="text" className="w-full p-2 border rounded" placeholder="NOT" value={filters.booleanNot} onChange={e => setFilters({...filters, booleanNot: e.target.value})} /></div>)}
          <button onClick={handleSearch} className="mt-6 w-full bg-legal-700 text-white py-2 rounded-lg hover:bg-legal-800 font-medium">Pesquisar</button>
        </div>
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
             <div className="flex flex-col gap-2">
                <button onClick={() => { const f = db.filter(i => !i.sumario || i.sumario.length < 20); setResults(f); setCurrentPage(1); }} className="text-left text-xs bg-white border border-orange-200 p-2 rounded text-orange-800 hover:bg-orange-100">Acórdãos sem Sumário</button>
                <button onClick={() => { const f = db.filter(i => i.relator === 'Desconhecido' || i.data === 'N/D'); setResults(f); setCurrentPage(1); }} className="text-left text-xs bg-white border border-orange-200 p-2 rounded text-orange-800 hover:bg-orange-100">Dados em Falta</button>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {displayedResults.map(item => (
              <div key={item.id} className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:border-legal-300">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="inline-block bg-legal-100 text-legal-800 text-xs px-2 py-1 rounded font-bold mr-2">{item.processo}</span>
                    <span className="text-sm text-gray-500">{item.data}</span>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => setSummaryView(item)} className="text-blue-600 bg-blue-50 text-sm flex items-center gap-1 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100" title="Ver Sumário"><Eye className="w-4 h-4" /></button>
                     <button onClick={() => openCorrection(item)} className="text-orange-600 bg-orange-50 text-sm flex items-center gap-1 border border-orange-200 px-2 py-1 rounded hover:bg-orange-100"><Edit2 className="w-4 h-4" /> Corrigir</button>
                     <button onClick={() => onOpenPdf(item.fileName)} className="text-green-700 bg-green-50 text-sm flex items-center gap-1 border border-green-200 px-2 py-1 rounded hover:bg-green-100"><FileText className="w-4 h-4" /> PDF</button>
                  </div>
                </div>
                <div className="text-sm"><strong>Relator:</strong> {item.relator}</div>
                <div className="text-sm mb-2 text-gray-600"><strong>Adjuntos:</strong> {item.adjuntos.join(', ')}</div>
                <p className="text-sm text-gray-700 line-clamp-2 italic bg-gray-50 p-2 rounded">{item.sumario}</p>
              </div>
            ))}
        </div>
        {/* Pagination Controls could go here */}
      </div>

      {/* Summary View Modal */}
      {summaryView && (
          <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                      <div>
                          <h3 className="font-bold text-lg text-legal-900">Sumário</h3>
                          <div className="text-sm text-gray-500">{summaryView.processo} | {summaryView.data}</div>
                      </div>
                      <button onClick={() => setSummaryView(null)} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1 text-base leading-relaxed text-gray-800 whitespace-pre-wrap font-serif">
                      {summaryView.sumario}
                  </div>
                  <div className="p-4 border-t flex justify-end gap-3 bg-gray-50 rounded-b-xl">
                       <button onClick={() => setSummaryView(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">Fechar</button>
                       <button onClick={() => onOpenPdf(summaryView.fileName)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"><FileText className="w-4 h-4"/> Ver Documento Original</button>
                  </div>
              </div>
          </div>
      )}

      {/* Correction Modal */}
      {correctionMode && correctionForm && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-6">
          <div className="bg-white w-[90%] md:w-[70%] h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
            <div className="bg-legal-900 text-white p-4 flex justify-between items-center shadow-md flex-shrink-0">
                <h2 className="text-xl font-bold flex items-center gap-2"><Edit2 className="w-5 h-5"/> Corrigir: {correctionMode.processo}</h2>
                <div className="flex gap-3">
                    <button onClick={() => setCorrectionMode(null)} className="text-gray-300 hover:text-white px-4">Cancelar</button>
                    <button onClick={saveCorrection} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold flex items-center gap-2"><Save className="w-4 h-4"/> Guardar</button>
                </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
                <div className="w-[35%] min-w-[350px] bg-gray-50 p-6 border-r overflow-y-auto space-y-6 flex-shrink-0 shadow-[4px_0_10px_rgba(0,0,0,0.1)] z-10">
                    <div>
                        <div className="flex justify-between mb-1"><label className="font-bold text-gray-700">Data</label><button onClick={() => getClipboardAndSet('data')} className="text-xs text-blue-600 flex items-center gap-1"><MousePointerClick className="w-3 h-3"/> Colar</button></div>
                        <input type="text" className="w-full p-2 border rounded" value={correctionForm.data} onChange={e => setCorrectionForm({...correctionForm, data: e.target.value})} />
                    </div>
                    <div>
                        <div className="flex justify-between mb-1"><label className="font-bold text-gray-700">Relator</label><button onClick={() => getClipboardAndSet('relator')} className="text-xs text-blue-600 flex items-center gap-1"><MousePointerClick className="w-3 h-3"/> Colar</button></div>
                        <input type="text" list="correction-judges" className="w-full p-2 border rounded" value={correctionForm.relator} onChange={e => setCorrectionForm({...correctionForm, relator: e.target.value})} />
                        <datalist id="correction-judges">{availableJudges.map((j, i) => <option key={i} value={j}/>)}</datalist>
                    </div>
                    <div>
                         <div className="flex justify-between mb-1"><label className="font-bold text-gray-700">Adjuntos</label><button onClick={() => getClipboardAndSet('adjuntos')} className="text-xs text-blue-600 flex items-center gap-1"><MousePointerClick className="w-3 h-3"/> Colar</button></div>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {correctionForm.adjuntos.map((adj, i) => (
                                <span key={i} className="bg-white border px-2 py-1 rounded text-sm flex items-center gap-1">{adj}<button onClick={() => setCorrectionForm({...correctionForm, adjuntos: correctionForm.adjuntos.filter((_, idx) => idx !== i)})} className="text-red-500 hover:text-red-700"><X className="w-3 h-3"/></button></span>
                            ))}
                        </div>
                        <input type="text" list="correction-judges" className="w-full p-2 border rounded" placeholder="Adicionar + Enter" onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { setCorrectionForm({...correctionForm, adjuntos: [...correctionForm.adjuntos, e.currentTarget.value.trim()]}); e.currentTarget.value = ''; }}} />
                    </div>
                     <div>
                        <div className="flex justify-between mb-1 items-center">
                            <label className="font-bold text-gray-700">Descritores</label>
                            <button onClick={handleMagicWand} disabled={isSuggesting} title="Sugerir descritores com IA" className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-purple-200 transition-colors">
                                {isSuggesting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3"/>}
                                IA
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {correctionForm.descritores.map((desc, i) => {
                                const isProvisional = desc.startsWith('*');
                                return (
                                    <span 
                                        key={i} 
                                        onClick={() => isProvisional && confirmDescriptor(i)}
                                        className={`${isProvisional ? 'bg-yellow-100 text-yellow-800 border-yellow-300 cursor-pointer hover:bg-yellow-200' : 'bg-blue-50 border-blue-200 text-blue-800'} border px-2 py-1 rounded text-sm flex items-center gap-1 transition-colors`}
                                        title={isProvisional ? "Clique para confirmar" : ""}
                                    >
                                        {desc}
                                        <button onClick={(e) => { e.stopPropagation(); setCorrectionForm({...correctionForm, descritores: correctionForm.descritores.filter((_, idx) => idx !== i)}); }} className="text-red-500 hover:text-red-700 ml-1"><X className="w-3 h-3"/></button>
                                    </span>
                                );
                            })}
                        </div>
                        <div className="flex gap-1">
                            <input type="text" list="correction-descriptors" className="w-full p-2 border rounded" placeholder="Pesquisar..." value={descriptorInput} onChange={e => setDescriptorInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && descriptorInput.trim()) addDescriptorToForm(descriptorInput.trim()); }} />
                            <datalist id="correction-descriptors">{availableDescriptors.map((r, i) => <option key={i} value={r} />)}</datalist>
                             <button onClick={() => { if (descriptorInput.trim()) addDescriptorToForm(descriptorInput.trim()); }} className="bg-blue-600 text-white px-3 rounded hover:bg-blue-700"><Plus className="w-4 h-4"/></button>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col">
                        <div className="flex justify-between mb-1"><label className="font-bold text-gray-700">Sumário</label><button onClick={() => getClipboardAndSet('sumario')} className="text-xs text-blue-600 flex items-center gap-1"><MousePointerClick className="w-3 h-3"/> Colar</button></div>
                        <textarea className="w-full h-64 p-2 border rounded font-mono text-sm" value={correctionForm.sumario} onChange={e => setCorrectionForm({...correctionForm, sumario: e.target.value})}/>
                    </div>
                </div>
                <div className="flex-1 bg-gray-200 p-0 relative flex flex-col min-w-0">
                    <div className="bg-white p-2 flex justify-between items-center border-b flex-shrink-0">
                        <div className="flex bg-gray-100 rounded shadow-sm overflow-hidden border">
                            <button onClick={() => setViewMode('pdf')} className={`px-3 py-1 text-xs font-medium ${viewMode === 'pdf' ? 'bg-legal-600 text-white' : 'text-gray-600'}`}>PDF Nativo</button>
                            <button onClick={() => setViewMode('text')} className={`px-3 py-1 text-xs font-medium ${viewMode === 'text' ? 'bg-legal-600 text-white' : 'text-gray-600'}`}>Texto Puro</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        {viewMode === 'pdf' ? (<PdfViewer data={pdfData} />) : (<div className="w-full h-full overflow-auto p-6 bg-white"><pre className="whitespace-pre-wrap font-mono text-xs text-gray-800 leading-relaxed">{correctionMode.textoCompleto}</pre></div>)}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchModule;