import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

export const generateLegalAnswer = async (
  question: string,
  context: Acordao[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prepare context - limit to avoid token limits
  const relevantContext = context.map(c => 
    `ID_REF: ${c.id}\nProcesso: ${c.processo}\nData: ${c.data}\nRelator: ${c.relator}\nSumário: ${c.sumario}\nExcerto Análise: ${c.textoAnalise.substring(0, 1000)}...`
  ).join('\n---\n');

  const systemPrompt = `
    És um assistente jurídico de elite em Portugal. O teu objetivo é analisar acórdãos e responder a questões jurídicas.
    
    ESTRUTURA DA RESPOSTA:
    Se houver divergência (Acórdão Fundamento vs Acórdão Recorrido ou correntes distintas):
    1. Apresenta a "Posição A", os seus argumentos e cita até 5 acórdãos (os mais recentes).
    2. Apresenta a "Posição B", os seus argumentos e cita até 5 acórdãos (os mais recentes).
    3. Se houver mais de 5 acórdãos para uma posição, escolhe apenas os 5 mais relevantes/recentes.

    FORMATO DE CITAÇÃO OBRIGATÓRIO:
    Sempre que citares um acórdão, deves usar exatamente este formato no fim da linha:
    "[Relator], Proc. [Numero], [Data] (ref: [ID_REF])"
    Exemplo: "Nuno de Oliveira, Proc. 123/22.4, 12-01-2024 (ref: 550e8400-e29b-41d4-a716-446655440000)"

    REGRAS:
    - Usa apenas a informação do contexto.
    - Se não houver divergência, responde diretamente mas mantém o formato de citação com a (ref: ID).
    - Não listes acórdãos que não uses na fundamentação.
  `;

  const prompt = `
    CONTEXTO DOS ACÓRDÃOS ANALISADOS (${context.length} documentos):
    ${relevantContext}

    PERGUNTA:
    ${question}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
      }
    });

    return response.text || "Não foi possível gerar uma resposta.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Erro ao comunicar com a IA.");
  }
};

export const extractMetadataWithAI = async (textContext: string): Promise<{
  data?: string;
  relator?: string;
  adjuntos?: string[];
  sumario?: string;
}> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Extrai JSON: data (DD-MM-AAAA), relator, adjuntos (array), sumario.\nTEXTO:\n${textContext}`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
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
  const prompt = `Escolhe da lista os descritores para o sumário. Retorna array JSON. Se incerto, prefixa com *.\nSUMÁRIO: ${summary}\nLISTA: ${JSON.stringify(validDescriptors)}`;
  try {
     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
     });
     return response.text ? JSON.parse(response.text) : [];
  } catch (error) { return []; }
};