import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

export const generateLegalAnswer = async (
  question: string,
  context: Acordao[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prepara o contexto, limitando para evitar exceder tokens, mas mantendo o ID vital para o UI
  const relevantContext = context.map(c => 
    `ID_REF: ${c.id}\nProcesso: ${c.processo}\nData: ${c.data}\nRelator: ${c.relator}\nSumário: ${c.sumario}\nExcerto: ${c.textoAnalise.substring(0, 800)}...`
  ).join('\n---\n');

  const systemPrompt = `
    És um consultor jurídico sénior em Portugal, especializado em análise de jurisprudência.
    
    ESTRUTURA DA RESPOSTA:
    Analisa os acórdãos fornecidos e verifica se existe uma corrente jurisprudencial uniforme ou se há divergência.

    1. SE HOUVER DIVERGÊNCIA (Correntes Opostas):
       - Identifica a "Posição A" (ex: Corrente Majoritária ou Acórdão Fundamento). Expõe os fundamentos e cita NO MÁXIMO 5 acórdãos que a sustentam.
       - Identifica a "Posição B" (ex: Corrente Minoritária ou Acórdão Recorrido). Expõe os fundamentos e cita NO MÁXIMO 5 acórdãos que a sustentam.
       - Se houver mais de 5 documentos para uma posição, escolhe os 5 mais recentes ou relevantes.

    2. SE NÃO HOUVER DIVERGÊNCIA:
       - Responde de forma direta e fundamentada, citando os acórdãos mais relevantes (limite total de 10 citações).

    REGRA DE CITAÇÃO (CRÍTICA):
    Para cada acórdão citado, deves obrigatoriamente incluir a referência no final da frase no seguinte formato:
    "Texto do fundamento... [Relator], Proc. [Numero], [Data] (ref: [ID_REF])"
    
    Exemplo: "...conforme decidido por Antunes Ferreira, Proc. 44/22, 10-05-2023 (ref: 550e8400-e29b-41d4-a716-446655440000)"

    IMPORTANTE:
    - Não inventes acórdãos. Usa apenas os fornecidos no contexto.
    - O número total de acórdãos analisados será exibido pelo sistema, por isso não precisas de os listar no fim.
    - Sê técnico, preciso e utiliza terminologia jurídica portuguesa.
  `;

  const prompt = `
    CONTEXTO DE ACÓRDÃOS DISPONÍVEIS (${context.length} documentos):
    ${relevantContext}

    QUESTÃO DO UTILIZADOR:
    ${question}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1, // Temperatura baixa para maior fidelidade jurídica
      }
    });

    return response.text || "Não foi possível obter uma análise para esta questão.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Falha na comunicação com o assistente jurídico local.");
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