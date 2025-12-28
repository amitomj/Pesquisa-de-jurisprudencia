
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

const handleApiError = async (error: any) => {
  console.error("Erro Gemini API:", error);
  const msg = error?.message || "";
  if (msg.includes("429") || msg.toLowerCase().includes("quota exceeded")) return "API_LIMIT_REACHED";
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
      `ID_REF: ${c.id}\nProcesso: ${c.processo}\nSumário: ${c.sumario}\nFUNDAMENTAÇÃO DE DIREITO (Isolada):\n${(c.fundamentacaoDireito || c.textoCompleto).substring(0, 4000)}`
    ).join('\n---\n');

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `És um consultor jurídico sénior. Analisa os fundamentos de direito dos acórdãos fornecidos e responde à questão técnica.
      
REGRAS:
1. FOCO NO DIREITO: Ignora a matéria de facto, foca-te na interpretação jurídica.
2. CITAÇÕES: Usa [ID_REF: uuid] para fundamentar.
3. CONTRADIÇÕES: Identifica se há divergências de entendimento jurídico.

CONTEXTO:
${relevantContext}

QUESTÃO: 
${question}`,
      config: {
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return response.text || "Sem resposta.";
  } catch (error: any) {
    const errType = await handleApiError(error);
    if (errType === "API_LIMIT_REACHED") return "AVISO: Limite de quota atingido.";
    return "Erro na IA. Verifique a sua chave.";
  }
};

export const extractMetadataWithAI = async (textContext: string, availableDescriptors: string[], apiKey: string): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Atua como um extrator de texto literal. 

REGRAS CRÍTICAS PARA O SUMÁRIO:
1. NÃO RESUMAS: O sumário deve ser EXTRAÍDO LITERALMENTE (letra a letra) do texto fornecido.
2. LOCALIZAÇÃO: Procura por marcadores como "Sumário:", "Sumário da responsabilidade do relator:" ou equivalentes.
3. SE NÃO EXISTIR: Se não encontrares um sumário explícito e literal, devolve OBRIGATORIAMENTE a frase: "Sumário não encontrado".
4. É PROIBIDO criar um sumário novo baseado no resto do documento.

DESCRITORES:
Escolhe 3-5 descritores da lista oficial que melhor se adequem ao tema: [${availableDescriptors.join(", ")}]

TEXTO DO DOCUMENTO (Segmentos do Início e Fim):
${textContext}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            data: { type: Type.STRING },
            relator: { type: Type.STRING },
            adjuntos: { type: Type.ARRAY, items: { type: Type.STRING } },
            sumario: { type: Type.STRING, description: "O sumário literal extraído ou 'Sumário não encontrado'." },
            descritores: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["data", "relator", "adjuntos", "sumario", "descritores"]
        }
      }
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) { return null; }
};
