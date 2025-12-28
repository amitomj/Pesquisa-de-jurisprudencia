
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

// @google/genai guidelines: Use process.env.API_KEY directly and do not manage keys in UI/localStorage.
const getAIInstance = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const handleAIError = async (error: any) => {
  console.error("Gemini Service Error Detail:", error);
  // Guidelines: API key handling is external. 
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
    return "Erro no processamento da consulta. Tente novamente em instantes.";
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
    return []; 
  }
};
