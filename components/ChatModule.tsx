
import React, { useState, useMemo } from 'react';
import { Acordao, ChatSession, ChatMessage } from '../types';
import { generateLegalAnswer } from '../services/geminiService';
import { exportChatSession } from '../services/exportService';
import { Send, Bot, Trash2, Download, Eye, FileText, X, Library, Scale, Info, Key, ExternalLink } from 'lucide-react';
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

    const updatedSession = { ...session, messages: [...session.messages, userMsg] };
    setCurrentSession(updatedSession);
    setInput('');
    setLoading(true);

    try {
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

      const finalSession = { ...updatedSession, messages: [...updatedSession.messages, botMsg] };
      setCurrentSession(finalSession);
      onSaveSession(finalSession);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getCitedAcordaos = (content: string, allSources: Acordao[]): Acordao[] => {
    const matches = [...content.matchAll(/\(ref:\s*([a-f0-9-]{36})\)/g)];
    const refs = matches.map(m => m[1]);
    return allSources.filter(s => [...new Set(refs)].includes(s.id));
  };

  return (
    <div className="flex h-full bg-gray-50">
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b">
           <button onClick={startNewChat} className="w-full bg-legal-600 text-white py-2 rounded-lg font-bold shadow-sm">Nova Conversa</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <div key={s.id} onClick={() => setCurrentSession(s)} className={`p-3 rounded-lg cursor-pointer text-sm flex justify-between group transition-all ${currentSession?.id === s.id ? 'bg-legal-50 font-semibold' : 'hover:bg-gray-100 text-gray-600'}`}>
               <span className="truncate pr-2">{s.title}</span>
               <button onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }} className="opacity-0 group-hover:opacity-100 text-red-500"><Trash2 className="w-4 h-4"/></button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-gray-50">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth">
          {!currentSession ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 animate-in fade-in zoom-in duration-700">
                <div className="p-8 bg-white rounded-3xl shadow-xl mb-6 border border-gray-100"><Scale className="w-16 h-16 text-legal-100"/></div>
                <h3 className="text-xl font-bold text-gray-800">Consultoria Jurídica IA</h3>
             </div>
          ) : (
             currentSession.messages.map(msg => {
               const cited = msg.role === 'model' ? getCitedAcordaos(msg.content, msg.sources || []) : [];
               return (
                 <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4`}>
                   <div className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-6 shadow-md border ${msg.role === 'user' ? 'bg-legal-800 text-white' : 'bg-white border-gray-100'}`}>
                        {msg.role === 'model' && (
                            <div className="flex items-center justify-between mb-4 pb-2 border-b">
                                <span className="text-[10px] font-black uppercase text-legal-600">Assistente JurisAnalítica</span>
                                <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded-full">{msg.sources?.length} acórdãos analisados</span>
                            </div>
                        )}
                        <div className="prose prose-sm max-w-none text-gray-800">
                            {msg.role === 'model' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : <p className="whitespace-pre-wrap">{msg.content}</p>}
                        </div>
                        {cited.length > 0 && (
                            <div className="mt-6 pt-6 border-t">
                                <span className="text-xs font-black text-gray-900 uppercase">Fontes Citadas:</span>
                                <div className="grid grid-cols-1 gap-2 mt-3">
                                    {cited.map(src => (
                                        <div key={src.id} className="bg-white border border-gray-100 p-3 rounded-xl flex items-center justify-between shadow-sm">
                                            <div className="truncate flex-1 mr-4">
                                                <div className="text-[12px] font-black text-legal-900">{src.processo}</div>
                                                <div className="text-[10px] text-gray-500 truncate">{src.relator} • {src.data}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setSelectedAcordao(src)} className="p-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"><Eye className="w-4 h-4"/></button>
                                                <button onClick={() => onOpenPdf(src.fileName)} className="p-2 bg-legal-900 text-white rounded-lg hover:bg-black"><FileText className="w-4 h-4"/></button>
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
              <div className="bg-white border p-5 rounded-2xl flex items-center gap-4">
                <Bot className="w-5 h-5 text-legal-300 animate-spin"/>
                <span className="text-xs text-gray-600 font-bold">Analisando correntes jurisprudenciais...</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-white border-t flex gap-4 shadow-lg z-20">
          <div className="flex-1 relative">
            <input type="text" className="w-full border border-gray-200 bg-gray-50 rounded-2xl p-4 pr-14 focus:outline-none focus:ring-4 focus:ring-legal-100 transition-all shadow-inner text-sm font-medium" placeholder="Questão jurídica..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} disabled={loading} />
            <button onClick={handleSend} disabled={loading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 bg-legal-600 text-white p-2.5 rounded-xl shadow-lg active:scale-90 transition-all"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

       {selectedAcordao && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                  <Eye className="w-6 h-6 text-legal-700"/>
                  <div><h3 className="font-black">Sumário</h3><p className="text-[10px] text-legal-600 uppercase">{selectedAcordao.processo}</p></div>
              </div>
              <button onClick={() => setSelectedAcordao(null)} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full"><X className="w-6 h-6"/></button>
            </div>
            <div className="p-10 overflow-y-auto flex-1 bg-white font-serif text-lg leading-relaxed whitespace-pre-wrap">{selectedAcordao.sumario}</div>
            <div className="p-6 border-t flex justify-end gap-3 bg-gray-50">
               <button onClick={() => setSelectedAcordao(null)} className="px-8 py-3 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-2xl">Fechar</button>
               <button onClick={() => { onOpenPdf(selectedAcordao!.fileName); setSelectedAcordao(null); }} className="px-8 py-3 bg-legal-700 text-white text-sm font-bold rounded-2xl hover:bg-black shadow-xl">Ver PDF Integral</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatModule;
