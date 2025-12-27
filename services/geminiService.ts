
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

// Função interna para garantir que a chave existe antes de criar a instância
const getAIInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

// Função auxiliar para gerir erros de IA
const handleAIError = async (error: any) => {
  console.error("Gemini Error:", error);
  
  if (error.message === "API_KEY_MISSING") {
    alert("A chave de acesso não foi detetada. Por favor, clique no botão 'Alterar Chave API' no topo.");
    return null;
  }

  if (error.message?.includes("Requested entity was not found")) {
    alert("A sua API Key parece ser inválida ou expirou. Por favor, reconfigure a chave no topo.");
    if (window.aistudio) await window.aistudio.openSelectKey();
    throw new Error("Chave Inválida");
  }
  
  throw error;
};

export const generateLegalAnswer = async (
  question: string,
  context: Acordao[]
): Promise<string> => {
  try {
    const ai = getAIInstance();
    const relevantContext = context.map(c => 
      `ID_REF: ${c.id}\nProcesso: ${c.processo}\nData: ${c.data}\nRelator: ${c.relator}\nSumário: ${c.sumario}\nExcerto: ${c.textoAnalise.substring(0, 800)}...`
    ).join('\n---\n');

    const systemPrompt = `
      És um consultor jurídico sénior em Portugal. Analisa os acórdãos e identifica correntes jurisprudenciais.
      FORMATO DE CITAÇÃO: "[Relator], Proc. [Numero], [Data] (ref: [ID_REF])"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `CONTEXTO (${context.length} docs):\n${relevantContext}\n\nQUESTÃO: ${question}`,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return response.text || "Sem resposta.";
  } catch (error) {
    await handleAIError(error);
    return "Erro ao gerar resposta. Verifique a sua chave de API.";
  }
};

export const extractMetadataWithAI = async (textContext: string): Promise<any> => {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extrai JSON: data (DD-MM-AAAA), relator, adjuntos (array), sumario.\nTEXTO:\n${textContext}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            data: { type: Type.STRING },
            relator: { type: Type.STRING },
            adjuntos: { type: Type.ARRAY, items: { type: Type.STRING } },
            sumario: { type: Type.STRING }
          }
        }
      }
    });
    return response.text ? JSON.parse(response.text) : {};
  } catch (error) { 
    await handleAIError(error);
    return null; 
  }
};

export const suggestDescriptorsWithAI = async (summary: string, validDescriptors: string[]): Promise<string[]> => {
  try {
     const ai = getAIInstance();
     const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Escolhe descritores.\nSUMÁRIO: ${summary}\nLISTA: ${JSON.stringify(validDescriptors)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
     });
     return response.text ? JSON.parse(response.text) : [];
  } catch (error) { 
    await handleAIError(error);
    return []; 
  }
};
