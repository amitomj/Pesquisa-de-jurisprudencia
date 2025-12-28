
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

const getAIInstance = () => {
  // Conforme as diretrizes, utiliza estritamente process.env.API_KEY
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_NOT_SET");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateLegalAnswer = async (
  question: string,
  context: Acordao[]
): Promise<string> => {
  try {
    const ai = getAIInstance();
    const relevantContext = context.map(c => 
      `ID_REF: ${c.id}\nProcesso: ${c.processo}\nData: ${c.data}\nRelator: ${c.relator}\nSumário: ${c.sumario}\nExcerto: ${c.textoAnalise.substring(0, 1000)}...`
    ).join('\n---\n');

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analisa os acórdãos e responde à questão. Se inconclusivo, avisa. Usa citações.

CONTEXTO:
${relevantContext}

QUESTÃO: 
${question}`,
      config: {
        systemInstruction: "És um consultor jurídico especializado em acórdãos portugueses. Resposta técnica e precisa.",
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return response.text || "Sem resposta.";
  } catch (error: any) {
    if (error.message === "API_KEY_NOT_SET") return "Configure a sua chave de API no botão superior para usar a IA.";
    console.error("Erro IA:", error);
    return "Falha na IA. Verifique a sua conexão ou chave.";
  }
};

export const extractMetadataWithAI = async (textContext: string): Promise<any> => {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extrai os metadados do acórdão em JSON.
REGRAS:
1. SUMÁRIO: Extrai o texto INTEGRAL. Não resumas.
2. DATA: DD-MM-AAAA.
3. MAGISTRADOS: Relator e Adjuntos completos.
4. "N/D" se em falta.

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
            sumario: { type: Type.STRING }
          },
          required: ["data", "relator", "adjuntos", "sumario"]
        }
      }
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) { 
    return null;
  }
};

export const suggestDescriptorsWithAI = async (summary: string, validDescriptors: string[]): Promise<string[]> => {
  try {
     const ai = getAIInstance();
     const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Escolha os 3 descritores mais relevantes.\nSUMÁRIO: ${summary}\nLISTA: ${JSON.stringify(validDescriptors)}`,
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
