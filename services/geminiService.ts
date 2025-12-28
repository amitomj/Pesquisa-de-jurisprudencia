
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

/**
 * Helper to handle specific API errors like Rate Limit (429) or Missing Entity
 */
const handleApiError = async (error: any) => {
  console.error("Erro Gemini API:", error);
  const msg = error?.message || "";
  
  // Rules: If requested entity was not found, reset key via dialog
  if (msg.includes("Requested entity was not found")) {
      const aistudio = window.aistudio || (window.parent as any)?.aistudio;
      if (aistudio) {
          await aistudio.openSelectKey();
          return "RETRY";
      }
  }

  if (msg.includes("429") || msg.toLowerCase().includes("quota exceeded") || msg.toLowerCase().includes("rate limit")) {
    return "API_LIMIT_REACHED";
  }
  return "ERROR";
};

/**
 * Generates a grounded legal answer based on the provided court decisions.
 */
export const generateLegalAnswer = async (
  question: string,
  context: Acordao[]
): Promise<string> => {
  try {
    // Create new instance to use updated key from dialog
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const relevantContext = context.map(c => 
      `ID_REF: ${c.id}\nProcesso: ${c.processo}\nTipo: ${c.tipoDecisao}\nData: ${c.data}\nRelator: ${c.relator}\nSumário: ${c.sumario}\nExcerto: ${c.textoAnalise.substring(0, 1500)}...`
    ).join('\n---\n');

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analisa os acórdãos fornecidos e responde à questão jurídica.

REGRAS DE OURO:
1. REFERÊNCIAS: Sempre que citar uma posição, use o formato [ID_REF: uuid].
2. DIVERGÊNCIAS: Identifique explicitamente se existem decisões contraditórias entre os acórdãos. Se houver, crie a secção "### ⚠️ CONFLITO JURISPRUDENCIAL" detalhando quem defende o quê.
3. ESTILO: Resposta técnica e fundamentada exclusivamente nos acórdãos fornecidos.

CONTEXTO JURISPRUDENCIAL:
${relevantContext}

QUESTÃO: 
${question}`,
      config: {
        systemInstruction: "És um consultor jurídico sénior especializado em identificar nuances e contradições jurisprudenciais. Mantém um tom formal e objetivo.",
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return response.text || "Sem resposta baseada no contexto.";
  } catch (error: any) {
    const errType = await handleApiError(error);
    if (errType === "RETRY") return "A chave de faturamento expirou ou é inválida. O diálogo de seleção foi reaberto. Tente novamente após selecionar uma chave válida.";
    if (errType === "API_LIMIT_REACHED") return "AVISO: Atingiu o limite de utilização da API (Quota Excedida). Por favor, aguarde alguns instantes.";
    return "Erro no processamento da IA. Certifique-se de que ligou o seu faturamento individual no menu superior.";
  }
};

/**
 * Extracts metadata and suggests descriptors focusing STRICTLY on the app's vocabulary.
 */
export const extractMetadataWithAI = async (textContext: string, availableDescriptors: string[]): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extrai metadados em JSON. 
      SUMÁRIO: Texto integral se disponível. 
      DATA: DD-MM-AAAA. 
      DESCRITORES: Escolhe APENAS entre 3 a 5 tags da seguinte lista oficial:
      [${availableDescriptors.join(", ")}]
      
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
    const errType = await handleApiError(error);
    if (errType === "API_LIMIT_REACHED") return "API_LIMIT_REACHED";
    return null; 
  }
};

/**
 * Suggests descriptors restricted to the provided list.
 */
export const suggestDescriptorsWithAI = async (summary: string, availableDescriptors: string[]): Promise<string[]> => {
  try {
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analisa o sumário e escolhe os 6 descritores mais adequados da lista fornecida abaixo. 
        NÃO inventes termos novos. Usa APENAS os termos da lista.
        
        LISTA DE DESCRITORES OFICIAIS:
        [${availableDescriptors.join(", ")}]
        
        SUMÁRIO:\n${summary}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
     });
     return response.text ? JSON.parse(response.text) : [];
  } catch (error) { 
    await handleApiError(error);
    return []; 
  }
};
