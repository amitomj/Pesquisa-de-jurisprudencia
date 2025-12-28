
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

const handleApiError = async (error: any) => {
  console.error("Erro Gemini API:", error);
  const msg = error?.message || "";
  
  if (msg.includes("429") || msg.toLowerCase().includes("quota exceeded") || msg.toLowerCase().includes("rate limit")) {
    return "API_LIMIT_REACHED";
  }
  return "ERROR";
};

export const generateLegalAnswer = async (
  question: string,
  context: Acordao[],
  apiKey: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const relevantContext = context.map(c => 
      `ID_REF: ${c.id}\nProcesso: ${c.processo}\nSumário: ${c.sumario}\nFUNDAMENTAÇÃO: ${c.textoAnalise.substring(0, 1500)}...`
    ).join('\n---\n');

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analisa os acórdãos e responde à questão.
      
REGRAS:
1. CITAÇÕES: Usa [ID_REF: uuid].
2. DIVERGÊNCIAS: Identifica contradições se existirem.

CONTEXTO:
${relevantContext}

QUESTÃO: 
${question}`,
      config: {
        systemInstruction: "És um consultor jurídico sénior. Responde de forma técnica e objetiva.",
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return response.text || "Sem resposta.";
  } catch (error: any) {
    const errType = await handleApiError(error);
    if (errType === "API_LIMIT_REACHED") return "AVISO: Limite de quota atingido na sua chave API.";
    return "Erro na IA. Verifique se a sua Chave API está correta e tem faturamento ativo.";
  }
};

export const extractMetadataWithAI = async (textContext: string, availableDescriptors: string[], apiKey: string): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extrai metadados em JSON. 
      DESCRITORES: Escolhe 3-5 desta lista: [${availableDescriptors.join(", ")}]
      
      TEXTO:
      ${textContext}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            data: { type: Type.STRING },
            relator: { type: Type.STRING },
            adjuntos: { type: Type.ARRAY, items: { type: Type.STRING } },
            sumario: { type: Type.STRING },
            descritores: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["data", "relator", "adjuntos", "sumario", "descritores"]
        }
      }
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) { 
    return null; 
  }
};

export const suggestDescriptorsWithAI = async (summary: string, availableDescriptors: string[], apiKey: string): Promise<string[]> => {
  try {
     const ai = new GoogleGenAI({ apiKey });
     const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Escolhe 6 descritores desta lista: [${availableDescriptors.join(", ")}] para o sumário: ${summary}`,
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
