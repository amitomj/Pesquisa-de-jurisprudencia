
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

/**
 * Cria uma nova instância do SDK Gemini garantindo que a chave mais recente é utilizada.
 * Lança erro específico se a chave não estiver configurada.
 */
const getAIInstance = () => {
  const apiKey = process.env.API_KEY;
  // Em certos ambientes, process.env.API_KEY pode vir como a string "undefined"
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Centraliza o tratamento de erros da API.
 * Não utiliza alert() aqui para evitar popups repetitivos em loops de processamento.
 */
const handleAIError = async (error: any) => {
  console.error("Gemini Service Error:", error);
  
  if (error.message === "API_KEY_MISSING") {
    throw new Error("Chave de API não configurada.");
  }

  if (error.message?.includes("Requested entity was not found")) {
    // Tenta abrir o seletor automaticamente se a chave for inválida
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
    }
    throw new Error("Chave de API inválida ou expirada.");
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
      Sempre que citas um acórdão, usa o formato: "[Relator], Proc. [Numero], [Data] (ref: [ID_REF])"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `CONTEXTO DE ACÓRDÃOS (${context.length} documentos):\n${relevantContext}\n\nPERGUNTA DO UTILIZADOR: ${question}`,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return response.text || "Não foi possível gerar uma resposta fundamentada.";
  } catch (error) {
    await handleAIError(error);
    return "Erro técnico na consulta. Por favor, verifique a sua ligação e chave de API.";
  }
};

export const extractMetadataWithAI = async (textContext: string): Promise<any> => {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analisa o texto e extrai os metadados em formato JSON estrito: data (formato DD-MM-AAAA), relator, adjuntos (lista de nomes), e sumario (se existir).\nTEXTO:\n${textContext}`,
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
    // Propaga o erro para o componente decidir se interrompe o lote
    await handleAIError(error);
    return null; 
  }
};

export const suggestDescriptorsWithAI = async (summary: string, validDescriptors: string[]): Promise<string[]> => {
  try {
     const ai = getAIInstance();
     const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Com base no sumário, escolhe os descritores mais adequados apenas da lista fornecida.\nSUMÁRIO: ${summary}\nLISTA PERMITIDA: ${JSON.stringify(validDescriptors)}`,
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
