
import React, { useState, useRef } from 'react';
import { Acordao } from '../types';
import { extractDataFromPdf } from '../services/pdfService';
import { extractMetadataWithAI, suggestDescriptorsWithAI } from '../services/geminiService';
import { FolderUp, CheckCircle, AlertCircle, RefreshCw, FilePlus, UserPlus, Tag, Bot, Users, ArrowRight, Loader2, Info, Square } from 'lucide-react';

interface Props {
  onDataLoaded: (data: Acordao[]) => void;
  existingDB: Acordao[];
  onSetRootHandle: (handle: FileSystemDirectoryHandle) => void;
  rootHandleName: string | null;
  onCacheFiles: (files: File[]) => void;
  onAddDescriptors: (category: 'social' | 'crime' | 'civil', list: string[]) => void;
  onAddJudges: (list: string[]) => void;
  onMergeJudges?: (main: string, others: string[]) => void;
  availableJudges?: string[];
  availableDescriptors?: string[]; 
}

const ProcessingModule: React.FC<Props> = ({ 
    onDataLoaded, existingDB, onSetRootHandle, rootHandleName, onCacheFiles,
    onAddDescriptors, onAddJudges, onMergeJudges, availableJudges = [], availableDescriptors = []
}) => {
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLegacyFallback, setShowLegacyFallback] = useState(false);
  
  // Ref para interrupção manual
  const stopRequested = useRef(false);

  // Management State
  const [judgeInput, setJudgeInput] = useState('');
  const [descriptorInput, setDescriptorInput] = useState('');
  const [descriptorCategory, setDescriptorCategory] = useState<'social' | 'crime' | 'civil'>('social');

  // Merge Judges State
  const [mergeMain, setMergeMain] = useState('');
  const [mergeSecondary, setMergeSecondary] = useState('');

  // Legacy input for fallback
  const legacyInputRef = useRef<HTMLInputElement>(null);

  const getFilesRecursively = async (handle: FileSystemDirectoryHandle): Promise<File[]> => {
    const files: File[] = [];
    for await (const entry of (handle as any).values()) {
      if (entry.kind === 'file') {
        if (entry.name.toLowerCase().endsWith('.pdf')) {
          files.push(await (entry as any).getFile());
        }
      } else if (entry.kind === 'directory') {
        files.push(...await getFilesRecursively(entry as any));
      }
    }
    return files;
  };

  const processFileList = async (files: File[]) => {
    setLogs(prev => [...prev, `${files.length} ficheiros PDF encontrados. Inicia análise...`]);
    stopRequested.current = false;

    const existingFileNames = new Set(existingDB.map(a => a.fileName));
    const newFiles = files.filter(f => !existingFileNames.has(f.name));

    if (newFiles.length === 0) {
      setLogs(prev => [...prev, 'Não foram encontrados novos acórdãos para adicionar.']);
      setProcessing(false);
      return;
    }

    setLogs(prev => [...prev, `A processar ${newFiles.length} novos ficheiros...`]);
    
    const newData: Acordao[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      if (stopRequested.current) {
        setLogs(prev => [...prev, '🛑 PROCESSAMENTO INTERROMPIDO PELO UTILIZADOR.']);
        break;
      }

      const file = newFiles[i];
      try {
        setLogs(prev => [...prev, `[${i + 1}/${newFiles.length}] A ler: ${file.name}...`]);
        await new Promise(resolve => setTimeout(resolve, 150));

        let data = await extractDataFromPdf(file);

        const isDataMissing = data.data === 'N/D' || data.relator === 'Desconhecido';
        const isSumarioMissing = data.sumario.includes('Sumário não identificado');

        if (isDataMissing || isSumarioMissing) {
            try {
                const textLen = data.textoCompleto.length;
                const context = textLen < 12000 
                    ? data.textoCompleto 
                    : data.textoCompleto.substring(0, 6000) + "\n...[CORTE]...\n" + data.textoCompleto.substring(textLen - 6000);

                const aiResult = await extractMetadataWithAI(context);
                if (aiResult) {
                    if (aiResult.data && aiResult.data !== 'N/D') data.data = aiResult.data;
                    if (aiResult.relator && aiResult.relator !== 'Desconhecido') data.relator = aiResult.relator;
                    if (aiResult.adjuntos && aiResult.adjuntos.length > 0) data.adjuntos = aiResult.adjuntos;
                    if (aiResult.sumario && aiResult.sumario.length > 50) data.sumario = aiResult.sumario;
                    setLogs(prev => [...prev, `✨ IA: Dados extraídos para ${file.name}`]);
                }
            } catch (aiError) {
                console.warn("AI metadata enrichment skipped/failed");
            }
        }

        newData.push(data);
      } catch (err) {
        setLogs(prev => [...prev, `❌ ERRO em ${file.name}: ${(err as Error).message}`]);
      }
    }

    setLogs(prev => [...prev, `Concluído: ${newData.length} acórdãos integrados.`]);
    onDataLoaded(newData);
    setProcessing(false);
  };

  const handleSelectFolder = async () => {
    if (!window.showDirectoryPicker) {
      setShowLegacyFallback(true);
      return;
    }
    try {
      setProcessing(true);
      const handle = await window.showDirectoryPicker();
      onSetRootHandle(handle); 
      setLogs(['A varrer diretórios...']);
      const allFiles: File[] = await getFilesRecursively(handle);
      await processFileList(allFiles);
    } catch (err: any) {
      setProcessing(false);
      if (err.name !== 'AbortError') setLogs(prev => [...prev, `Erro: ${err.message}`]);
    }
  };

  const handleLegacyFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setShowLegacyFallback(false);
    setProcessing(true);
    const files: File[] = (Array.from(e.target.files) as File[]).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    onCacheFiles(files);
    await processFileList(files);
    e.target.value = '';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
      
      {processing && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col items-center justify-center backdrop-blur-md">
           <div className="bg-white p-10 rounded-[40px] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center border-t-8 border-legal-600">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-legal-100 border-t-legal-600 rounded-full animate-spin"></div>
                <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-legal-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-legal-900 uppercase tracking-tight">Análise em Curso</h3>
                <p className="text-gray-400 text-xs font-bold mt-1 uppercase tracking-widest">A ler documentos e aplicar IA...</p>
              </div>
              
              <button 
                onClick={() => { stopRequested.current = true; }} 
                className="mt-4 flex items-center gap-2 bg-red-50 text-red-600 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-100 transition-all active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Interromper
              </button>
           </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
            <FolderUp className="w-32 h-32" />
        </div>
        <h2 className="text-2xl font-black text-legal-900 mb-6 flex items-center gap-3 tracking-tighter uppercase">
          <FolderUp className="w-7 h-7 text-legal-600" /> Biblioteca de Acórdãos
        </h2>
        
        {showLegacyFallback ? (
            <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-3xl mb-4">
                <div className="flex gap-4 items-start">
                    <div className="p-3 bg-amber-100 rounded-2xl"><Info className="w-6 h-6 text-amber-600" /></div>
                    <div className="flex-1">
                        <p className="text-sm text-amber-900 font-black uppercase tracking-tight">Modo de Seleção Manual</p>
                        <p className="text-xs text-amber-700/80 mt-1 font-bold">O browser não suporta acesso direto a pastas. Selecione os ficheiros PDF individualmente ou em grupo.</p>
                        <button onClick={() => legacyInputRef.current?.click()} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95">
                            Selecionar Ficheiros PDF
                        </button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <button onClick={handleSelectFolder} disabled={processing} className="bg-legal-900 hover:bg-black text-white px-8 py-4 rounded-[20px] flex items-center gap-3 disabled:opacity-50 transition-all shadow-2xl active:scale-95 group font-black text-xs uppercase tracking-widest">
                  {processing ? <RefreshCw className="animate-spin w-5 h-5"/> : <FilePlus className="w-5 h-5 group-hover:scale-110 transition-transform"/>}
                  {rootHandleName ? `Sincronizar: ${rootHandleName}` : 'Vincular Pasta de Acórdãos'}
                </button>
                {rootHandleName && <span className="text-[10px] text-green-600 font-black uppercase tracking-widest flex items-center gap-1.5 bg-green-50 px-4 py-2 rounded-full border border-green-100"><CheckCircle className="w-4 h-4"/> Ativa</span>}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-black uppercase tracking-widest">
                 <Info className="w-3 h-3"/> Todos os subdiretórios serão analisados recursivamente.
              </div>
            </div>
        )}
        <input type="file" ref={legacyInputRef} className="hidden" onChange={handleLegacyFileSelect} multiple {...({ webkitdirectory: "" } as any)} />
      </div>
      
      {logs.length > 0 && (
        <div className="bg-slate-900 text-slate-300 p-6 rounded-[2.5rem] font-mono text-[11px] h-64 overflow-y-auto shadow-2xl border border-slate-800 custom-scrollbar relative">
          <div className="sticky top-0 bg-slate-900 pb-3 border-b border-slate-800 mb-3 font-black text-white flex justify-between uppercase tracking-widest text-[9px]">
              <span className="flex items-center gap-2"><Bot className="w-3.5 h-3.5 text-blue-400"/> Consola de Operações</span>
              {processing && <span className="animate-pulse text-orange-400">Processando...</span>}
          </div>
          <div className="space-y-1">
             {logs.map((log, i) => (
                <div key={i} className={`flex gap-3 ${log.includes('ERRO') ? 'text-red-400' : log.includes('✨') ? 'text-blue-300' : ''}`}>
                    <span className="opacity-30">[{new Date().toLocaleTimeString()}]</span>
                    <span>{log}</span>
                </div>
             ))}
          </div>
        </div>
      )}

      {/* Gestão de Juízes e Identidades */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 col-span-1 md:col-span-2">
               <h3 className="text-sm font-black text-legal-900 mb-6 flex items-center gap-2 uppercase tracking-widest"><Users className="w-5 h-5 text-legal-600"/> Padronização de Magistrados</h3>
               <div className="flex flex-col md:flex-row gap-4 items-end bg-gray-50 p-6 rounded-3xl border border-gray-100">
                   <div className="flex-1 w-full">
                       <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block tracking-widest px-1">Nome no Documento</label>
                       <input list="judges-list" className="w-full p-3.5 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-legal-50" placeholder="Ex: J. Silva..." value={mergeSecondary} onChange={e => setMergeSecondary(e.target.value)} />
                   </div>
                   <div className="flex items-center justify-center mb-3">
                       <ArrowRight className="w-5 h-5 text-gray-300" />
                   </div>
                   <div className="flex-1 w-full">
                       <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block tracking-widest px-1">Nome Padronizado</label>
                       <input list="judges-list" className="w-full p-3.5 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-legal-50" placeholder="Ex: João Silva..." value={mergeMain} onChange={e => setMergeMain(e.target.value)} />
                   </div>
                   <button 
                     onClick={() => { if(onMergeJudges && mergeMain && mergeSecondary) { onMergeJudges(mergeMain, [mergeSecondary]); setMergeSecondary(''); } }} 
                     disabled={!mergeMain.trim() || !mergeSecondary.trim()} 
                     className="bg-legal-900 text-white px-8 py-3.5 rounded-2xl shadow-xl hover:bg-black disabled:opacity-30 font-black uppercase text-[10px] tracking-widest transition-all active:scale-95"
                   >
                       Unificar
                   </button>
               </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-sm font-black text-legal-900 mb-4 flex items-center gap-2 uppercase tracking-widest"><UserPlus className="w-5 h-5 text-legal-600"/> Adicionar Juízes</h3>
              <textarea className="w-full h-24 p-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-legal-50 mb-4 custom-scrollbar" placeholder="Um nome completo por linha..." value={judgeInput} onChange={e => setJudgeInput(e.target.value)}/>
              <div className="flex justify-end">
                <button onClick={() => { onAddJudges(judgeInput.split('\n').filter(x=>x.trim())); setJudgeInput(''); }} disabled={!judgeInput.trim()} className="bg-legal-100 text-legal-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-legal-200 transition-all active:scale-95">Gravar Lista</button>
              </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-sm font-black text-legal-900 mb-4 flex items-center gap-2 uppercase tracking-widest"><Tag className="w-5 h-5 text-legal-600"/> Categorias / Descritores</h3>
              <div className="flex gap-2 mb-4">
                  {(['social', 'crime', 'civil'] as const).map(cat => (
                      <button key={cat} onClick={() => setDescriptorCategory(cat)} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${descriptorCategory === cat ? 'bg-legal-900 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{cat}</button>
                  ))}
              </div>
              <textarea className="w-full h-24 p-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-legal-50 mb-4 custom-scrollbar" placeholder="Descritores jurídicos (um por linha)..." value={descriptorInput} onChange={e => setDescriptorInput(e.target.value)}/>
              <div className="flex justify-end">
                <button onClick={() => { onAddDescriptors(descriptorCategory, descriptorInput.split('\n').filter(x=>x.trim())); setDescriptorInput(''); }} disabled={!descriptorInput.trim()} className="bg-legal-100 text-legal-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-legal-200 transition-all active:scale-95">Gravar Descritores</button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ProcessingModule;
