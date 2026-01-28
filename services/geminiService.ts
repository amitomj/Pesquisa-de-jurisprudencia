
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

/**
 * Helper para obter a chave de API de forma resiliente em ambientes como Vercel/Browser.
 */
const getApiKey = (): string => {
  // Tenta ler do process.env (padrão) ou do objeto global (shim do Veritas)
  const key = process.env.API_KEY || (window as any).process?.env?.API_KEY || localStorage.getItem('gemini_api_key');
  return key || "";
};

const handleApiError = async (error: any) => {
  console.error("Erro Detalhado Gemini API:", error);
  const msg = error?.message || "";
  if (msg.includes("429") || msg.toLowerCase().includes("quota exceeded")) return "API_LIMIT_REACHED";
  if (msg.includes("API Key not found") || msg.includes("API_KEY_INVALID")) return "INVALID_KEY";
  return msg || "UNKNOWN_ERROR";
};

export const generateLegalAnswer = async (
  question: string,
  context: Acordao[]
): Promise<string> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return "ERRO: Chave de API não configurada. Por favor, insira a sua Gemini API Key nas configurações (ícone da engrenagem).";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const relevantContext = context.map(c => {
      const direito = c.fundamentacaoDireito || "[Fundamentação de Direito não segmentada separadamente]";
      return `### DOCUMENTO JURÍDICO
ID_REF: ${c.id}
Processo: ${c.processo}
Data: ${c.data}
Relator: ${c.relator}

SUMÁRIO:
${c.sumario}

FUNDAMENTAÇÃO JURÍDICA:
${direito.substring(0, 7500)}`;
    }).join('\n\n---\n\n');

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Atua como um Consultor Jurídico Sénior. Analisa os acórdãos fornecidos e elabora uma resposta estruturada sobre a questão colocada.

A TUA RESPOSTA DEVE SEGUIR ESTE MODELO:
1. ENQUADRAMENTO INICIAL
2. POSIÇÕES JURÍDICAS IDENTIFICADAS (Cita IDs no formato [ID_REF: uuid])
3. NÚCLEO CENTRAL DA DIVERGÊNCIA

CONTEXTO:
${relevantContext}

QUESTÃO DO UTILIZADOR: 
${question}`,
      config: {
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 8000 }
      }
    });

    return response.text || "Não foi possível gerar uma análise jurídica.";
  } catch (error: any) {
    const errType = await handleApiError(error);
    if (errType === "API_LIMIT_REACHED") return "AVISO: Limite de quota excedido.";
    if (errType === "INVALID_KEY") return "ERRO: Chave de API inválida ou não reconhecida.";
    return `Erro técnico na API: ${errType}`;
  }
};

export const extractMetadataWithAI = async (textContext: string, availableDescriptors: string[]): Promise<any> => {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extrai metadados do acórdão em formato JSON. 
Descritores permitidos: [${availableDescriptors.join(", ")}]

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
    console.error("Erro na extração AI:", error);
    return null; 
  }
};
