import React, { useState, useMemo } from 'react';
import { Acordao, ChatSession, ChatMessage } from '../types';
import { generateLegalAnswer } from '../services/geminiService';
import { exportChatSession } from '../services/exportService';
import { Send, Bot, Trash2, Download, Eye, FileText, X, Library, Scale } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  db: Acordao[];
  sessions: ChatSession[];
  onSaveSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  onOpenPdf: (fileName: string) => void;
}

const ChatModule: React.FC<Props> = ({ db, sessions, onSaveSession, onDeleteSession, onOpenPdf }) => {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAcordao, setSelectedAcordao] = useState<Acordao | null>(null);

  const startNewChat = () => {
    setCurrentSession({
      id: crypto.randomUUID(),
      title: 'Nova Conversa',
      messages: [],
      createdAt: Date.now()
    });
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!currentSession) startNewChat();

    const session = currentSession || {
      id: crypto.randomUUID(),
      title: input.substring(0, 30) + '...',
      messages: [],
      createdAt: Date.now()
    };

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    const updatedSession = {
      ...session,
      messages: [...session.messages, userMsg]
    };

    setCurrentSession(updatedSession);
    setInput('');
    setLoading(true);

    try {
      // Retrieval: Busca por relevância simples
      const keywords = input.toLowerCase().split(' ').filter(w => w.length > 3);
      const relevantContext = db.filter(d => {
        const text = (d.sumario + ' ' + d.textoAnalise + ' ' + (d.descritores?.join(' ') || '')).toLowerCase();
        return keywords.some(k => text.includes(k));
      }).slice(0, 40); 

      const answer = await generateLegalAnswer(input, relevantContext);
      
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        content: answer,
        timestamp: Date.now(),
        sources: relevantContext 
      };

      const finalSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, botMsg]
      };

      setCurrentSession(finalSession);
      onSaveSession(finalSession);
    } catch (error) {
      alert("Erro no assistente: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Identifica acórdãos citados no texto para criar os cartões de fonte
  const getCitedAcordaos = (content: string, allSources: Acordao[]): Acordao[] => {
    // Procura por (ref: UUID)
    const matches = [...content.matchAll(/\(ref:\s*([a-f0-9-]{36})\)/g)];
    const refs = matches.map(m => m[1]);
    const uniqueRefs = [...new Set(refs)];
    return allSources.filter(s => uniqueRefs.includes(s.id));
  };

  const renderMarkdown = (content: string) => (
      <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed font-sans prose-headings:text-legal-800 prose-strong:text-legal-900">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
  );

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar History */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b">
           <button onClick={startNewChat} className="w-full bg-legal-600 text-white py-2 rounded-lg shadow-sm hover:bg-legal-700 font-bold transition-all active:scale-95 flex items-center justify-center gap-2">
             <Plus className="w-4 h-4"/> Nova Conversa
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <div key={s.id} 
                 onClick={() => setCurrentSession(s)}
                 className={`p-3 rounded-lg cursor-pointer text-sm flex justify-between group transition-all ${currentSession?.id === s.id ? 'bg-legal-50 border-legal-200 border text-legal-900 font-semibold' : 'hover:bg-gray-100 text-gray-600'}`}>
               <span className="truncate pr-2">{s.title}</span>
               <button onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }} className="text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all"><Trash2 className="w-4 h-4"/></button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 px-4 text-center">
                <Library className="w-8 h-8 opacity-20 mb-2"/>
                <p className="text-[10px] uppercase tracking-widest font-bold">Sem histórico</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-gray-50">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 scroll-smooth">
          {!currentSession ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 animate-in fade-in zoom-in duration-700">
                <div className="p-8 bg-white rounded-3xl shadow-xl mb-6 border border-gray-100">
                    <Scale className="w-16 h-16 text-legal-100"/>
                </div>
                <h3 className="text-xl font-bold text-gray-800 tracking-tight">Consultoria Jurídica IA</h3>
                <p className="max-w-md text-center text-sm mt-3 leading-relaxed text-gray-500">
                    O assistente analisará a sua base de dados local para encontrar tendências jurisprudenciais e divergências.
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                    {["Qual a tendência sobre assédio moral?", "Há divergência quanto ao cálculo de indemnização?", "Resumo dos acórdãos de 2024", "Jurisprudência sobre teletrabalho"].map((suggestion, i) => (
                        <button key={i} onClick={() => setInput(suggestion)} className="p-3 text-xs bg-white border border-gray-200 rounded-xl hover:border-legal-400 text-gray-600 transition-all text-left truncate">
                            {suggestion}
                        </button>
                    ))}
                </div>
             </div>
          ) : (
             currentSession.messages.map(msg => {
               const cited = msg.role === 'model' ? getCitedAcordaos(msg.content, msg.sources || []) : [];
               
               return (
                 <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                   <div className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-6 shadow-md border ${msg.role === 'user' ? 'bg-legal-800 text-white border-legal-900 ml-12' : 'bg-white border-gray-100 mr-12'}`}>
                        {msg.role === 'model' && (
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-50">
                                <div className="flex items-center gap-2">
                                    <div className="bg-legal-100 p-1.5 rounded-lg"><Bot className="w-4 h-4 text-legal-700"/></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-legal-600">Assistente JurisAnalítica</span>
                                </div>
                                <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                                    {msg.sources ? `${msg.sources.length} documentos analisados` : 'Analítico'}
                                </span>
                            </div>
                        )}

                        <div className="chat-content">
                            {msg.role === 'model' ? renderMarkdown(msg.content) : <p className="whitespace-pre-wrap font-medium">{msg.content}</p>}
                        </div>

                        {cited.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1.5 h-4 bg-legal-500 rounded-full"></div>
                                    <span className="text-xs font-black text-gray-900 uppercase tracking-tighter">Fontes Citadas na Resposta</span>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {cited.map(src => (
                                        <div key={src.id} className="group bg-white hover:bg-legal-50/30 border border-gray-100 hover:border-legal-200 p-3 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[12px] font-black text-legal-900 mb-0.5">{src.processo}</div>
                                                <div className="text-[10px] text-gray-500 flex items-center gap-2 font-medium">
                                                    <span className="truncate max-w-[150px]">{src.relator}</span>
                                                    <span className="text-gray-300">•</span>
                                                    <span>{src.data}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0">
                                                <button 
                                                    onClick={() => setSelectedAcordao(src)} 
                                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-200 text-blue-700 text-[11px] font-bold rounded-lg transition-all shadow-sm"
                                                >
                                                    <Eye className="w-3.5 h-3.5"/> Sumário
                                                </button>
                                                <button 
                                                    onClick={() => onOpenPdf(src.fileName)} 
                                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-legal-900 text-white text-[11px] font-bold rounded-lg hover:bg-black transition-all shadow-sm"
                                                >
                                                    <FileText className="w-3.5 h-3.5"/> PDF
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                   </div>
                 </div>
               );
             })
          )}
          {loading && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-white border border-gray-100 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
                <div className="w-8 h-8 bg-legal-50 rounded-lg flex items-center justify-center">
                    <Bot className="w-5 h-5 text-legal-300 animate-spin"/>
                </div>
                <div>
                    <span className="text-xs text-gray-600 font-bold block">IA JurisAnalítica está a processar</span>
                    <span className="text-[10px] text-gray-400">Cruzando correntes jurisprudenciais...</span>
                </div>
              </div>
            </div>
          )}
          <div className="h-4"></div>
        </div>

        <div className="p-6 bg-white border-t border-gray-200 flex gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.02)] z-20">
          {currentSession && (
             <button onClick={() => exportChatSession(currentSession, db)} title="Exportar para Word" className="text-gray-400 hover:text-legal-700 p-3.5 border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all flex-shrink-0">
                <Download className="w-5 h-5" />
             </button>
          )}
          <div className="flex-1 relative group">
            <input 
                type="text" 
                className="w-full border border-gray-200 bg-gray-50 rounded-2xl p-4 pr-14 focus:outline-none focus:ring-4 focus:ring-legal-100 focus:bg-white focus:border-legal-500 transition-all shadow-inner text-sm font-medium" 
                placeholder="Questão jurídica (ex: divergências no cálculo de diuturnidades)..." 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSend()} 
                disabled={loading} 
            />
            <button 
                onClick={handleSend} 
                disabled={loading || !input.trim()} 
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-legal-600 text-white p-2.5 rounded-xl hover:bg-legal-800 disabled:opacity-30 transition-all shadow-lg active:scale-90"
            >
                <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

       {/* Modal de Sumário */}
       {selectedAcordao && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-400">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-legal-100 rounded-xl"><Eye className="w-6 h-6 text-legal-700"/></div>
                  <div>
                    <h3 className="font-black text-gray-900 tracking-tight">Sumário do Acórdão</h3>
                    <p className="text-[10px] text-legal-600 font-black uppercase tracking-widest">{selectedAcordao.processo} • {selectedAcordao.data}</p>
                  </div>
              </div>
              <button onClick={() => setSelectedAcordao(null)} className="p-2.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-all"><X className="w-6 h-6"/></button>
            </div>
            <div className="p-10 overflow-y-auto flex-1 bg-white custom-scrollbar">
              <div className="prose prose-sm max-w-none font-serif text-gray-800 leading-[1.8] whitespace-pre-wrap text-lg">
                {selectedAcordao.sumario}
              </div>
            </div>
            <div className="p-6 border-t flex flex-col sm:flex-row justify-end gap-3 bg-gray-50/50">
               <button onClick={() => setSelectedAcordao(null)} className="px-8 py-3 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-2xl transition-all">Fechar</button>
               <button onClick={() => { onOpenPdf(selectedAcordao!.fileName); setSelectedAcordao(null); }} className="px-8 py-3 bg-legal-700 text-white text-sm font-bold rounded-2xl hover:bg-black flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95">
                  <FileText className="w-5 h-5"/> Ver Acórdão Integral (PDF)
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Plus = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);

export default ChatModule;