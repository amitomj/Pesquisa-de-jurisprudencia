
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

const getAIInstance = () => {
  // Prioridade 1: Chave manual guardada no navegador pelo utilizador
  const localKey = localStorage.getItem("GEMINI_API_KEY");
  // Prioridade 2: Chave injetada pelo ambiente (se existir)
  const apiKey = localKey || process.env.API_KEY;

  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

const handleAIError = async (error: any) => {
  console.error("Gemini Service Error:", error);
  
  if (error.message === "API_KEY_MISSING") {
    throw new Error("CHAVE_EM_FALTA");
  }

  // Se a chave for inválida, removemos do localStorage para forçar nova entrada
  if (error.message?.includes("API key not valid") || error.message?.includes("Requested entity was not found")) {
    localStorage.removeItem("GEMINI_API_KEY");
    throw new Error("CHAVE_INVALIDA");
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

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analisa os acórdãos e responde à questão.\nCONTEXTO:\n${relevantContext}\n\nQUESTÃO: ${question}`,
      config: {
        systemInstruction: "És um consultor jurídico português. Usa citações precisas. Se não tiveres dados suficientes, informa o utilizador.",
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return response.text || "Sem resposta disponível.";
  } catch (error) {
    await handleAIError(error);
    return "Erro no processamento da consulta. Verifique a sua ligação ou a validade da chave API.";
  }
};

export const extractMetadataWithAI = async (textContext: string): Promise<any> => {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extrai metadados em JSON: data, relator, adjuntos, sumario.\nTEXTO:\n${textContext}`,
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
    return response.text ? JSON.parse(response.text) : null;
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
        contents: `Escolhe os 3 descritores mais adequados da lista fornecida.\nSUMÁRIO: ${summary}\nLISTA: ${JSON.stringify(validDescriptors)}`,
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
