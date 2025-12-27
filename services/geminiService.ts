
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

// Função auxiliar para gerir erros de chave
const handleAIError = async (error: any) => {
  console.error("Gemini Error:", error);
  if (error.message?.includes("Requested entity was not found")) {
    alert("A sua API Key parece ser inválida ou expirou. Por favor, selecione-a novamente.");
    if (window.aistudio) await window.aistudio.openSelectKey();
    throw new Error("API Key inválida. Por favor, tente novamente após reconfigurar.");
  }
  throw error;
};

export const generateLegalAnswer = async (
  question: string,
  context: Acordao[]
): Promise<string> => {
  // Cria nova instância para garantir uso da chave atualizada no process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const relevantContext = context.map(c => 
    `ID_REF: ${c.id}\nProcesso: ${c.processo}\nData: ${c.data}\nRelator: ${c.relator}\nSumário: ${c.sumario}\nExcerto: ${c.textoAnalise.substring(0, 800)}...`
  ).join('\n---\n');

  const systemPrompt = `
    És um consultor jurídico sénior em Portugal. Analisa os acórdãos e identifica correntes jurisprudenciais.
    
    1. SE HOUVER DIVERGÊNCIA:
       - Identifica "Posição A" e "Posição B", citando até 5 acórdãos para cada (os mais recentes).
    2. SE NÃO HOUVER DIVERGÊNCIA:
       - Responde de forma fundamentada citando os mais relevantes.

    FORMATO DE CITAÇÃO: "[Relator], Proc. [Numero], [Data] (ref: [ID_REF])"
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Modelo superior para análise complexa
      contents: `CONTEXTO (${context.length} docs):\n${relevantContext}\n\nQUESTÃO: ${question}`,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 } // Ativa raciocínio detalhado
      }
    });

    return response.text || "Sem resposta.";
  } catch (error) {
    return handleAIError(error);
  }
};

export const extractMetadataWithAI = async (textContext: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
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
  } catch (error) { return {}; }
};

export const suggestDescriptorsWithAI = async (summary: string, validDescriptors: string[]): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
     const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Escolhe descritores.\nSUMÁRIO: ${summary}\nLISTA: ${JSON.stringify(validDescriptors)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
     });
     return response.text ? JSON.parse(response.text) : [];
  } catch (error) { return []; }
};
