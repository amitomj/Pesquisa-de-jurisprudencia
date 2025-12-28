
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

const handleApiError = async (error: any) => {
  console.error("Erro Gemini API:", error);
  const msg = error?.message || "";
  
  // Rules: If the request fails with an error message containing "Requested entity was not found.", 
  // reset the key selection state and prompt the user to select a key again via openSelectKey().
  if (msg.includes("Requested entity was not found")) {
      if (window.aistudio) {
          await window.aistudio.openSelectKey();
          return "RETRY";
      }
  }

  if (msg.includes("429") || msg.toLowerCase().includes("quota exceeded") || msg.toLowerCase().includes("rate limit")) {
    return "API_LIMIT_REACHED";
  }
  return "ERROR";
};

export const generateLegalAnswer = async (
  question: string,
  context: Acordao[]
): Promise<string> => {
  try {
    // Rules: Create a new GoogleGenAI instance right before making an API call 
    // to ensure it always uses the most up-to-date API key from the dialog.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const relevantContext = context.map(c => 
      `ID_REF: ${c.id}\nProcesso: ${c.processo}\nSumário: ${c.sumario}\nFUNDAMENTAÇÃO DE DIREITO: ${c.textoAnalise.substring(0, 8000)}...`
    ).join('\n---\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `És um assistente jurídico de alto nível. Analisa a FUNDAMENTAÇÃO DE DIREITO dos acórdãos fornecidos para responder à questão.

REGRAS CRÍTICAS:
1. FOCO NO DIREITO: Ignora questões de facto. Concentra-te na interpretação jurídica e normas aplicadas.
2. CITAÇÕES: Usa obrigatoriamente [ID_REF: uuid] ao referir uma tese.
3. CONFLITOS: Se os tribunais decidirem de forma diferente sobre o mesmo tema, destaca isso na secção "### ⚠️ DIVERGÊNCIA JURISPRUDENCIAL".

CONTEXTO SELECIONADO:
${relevantContext}

QUESTÃO DO UTILIZADOR: 
${question}`,
      config: {
        systemInstruction: "És um Consultor Jurídico Especializado. A tua missão é extrair a 'ratio decidendi' dos acórdãos, focando-te exclusivamente nos argumentos de direito e ignorando o relatório fáctico.",
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return response.text || "Sem resposta baseada no contexto.";
  } catch (error: any) {
    const errType = await handleApiError(error);
    if (errType === "RETRY") return "A chave de IA expirou ou é inválida. O seletor de chaves foi aberto automaticamente. Por favor, tente novamente após selecionar uma nova chave.";
    if (errType === "API_LIMIT_REACHED") return "AVISO: Limite de API atingido. Aguarde um momento.";
    return "Erro no processamento da IA. Verifique se ligou a sua Chave API pessoal no cabeçalho.";
  }
};

export const extractMetadataWithAI = async (textContext: string, availableDescriptors: string[]): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extrai metadados em JSON. 
      Foca-te em gerar um SUMÁRIO conciso mas juridicamente rico baseado na FUNDAMENTAÇÃO DE DIREITO fornecida.
      Escolhe 3-5 DESCRITORES desta lista: [${availableDescriptors.join(", ")}]
      
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

export const suggestDescriptorsWithAI = async (summary: string, availableDescriptors: string[]): Promise<string[]> => {
  try {
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Lista 6 descritores da lista abaixo para este sumário jurídico.
        LISTA: [${availableDescriptors.join(", ")}]
        SUMÁRIO: ${summary}`,
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
