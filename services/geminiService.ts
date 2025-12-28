
import { GoogleGenAI, Type } from "@google/genai";
import { Acordao } from "../types";

const getAIInstance = (apiKey: string) => {
  if (!apiKey || apiKey.length < 10) {
    throw new Error("API_KEY_NOT_SET");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateLegalAnswer = async (
  apiKey: string,
  question: string,
  context: Acordao[]
): Promise<string> => {
  try {
    const ai = getAIInstance(apiKey);
    const relevantContext = context.map(c => 
      `ID_REF: ${c.id}\nProcesso: ${c.processo}\nData: ${c.data}\nRelator: ${c.relator}\nSumário: ${c.sumario}\nExcerto: ${c.textoAnalise.substring(0, 1000)}...`
    ).join('\n---\n');

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analisa os acórdãos fornecidos e responde à questão jurídica de forma técnica e fundamentada.

CONTEXTO JURISPRUDENCIAL:
${relevantContext}

QUESTÃO DO UTILIZADOR: 
${question}`,
      config: {
        systemInstruction: "És um consultor jurídico sénior especializado em Direito Português. Responde de forma técnica, precisa e fundamentada.",
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    return response.text || "Não foi possível gerar uma resposta com base no contexto.";
  } catch (error: any) {
    if (error.message === "API_KEY_NOT_SET") return "Configure a sua chave de API no botão 'Configurar IA' no topo da aplicação.";
    console.error("Erro na consulta IA:", error);
    return "Erro no processamento. Verifique a validade da sua chave de API.";
  }
};

export const extractMetadataWithAI = async (apiKey: string, textContext: string): Promise<any> => {
  try {
    const ai = getAIInstance(apiKey);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analisa o texto do acórdão e extrai rigorosamente os metadados em JSON.
REGRAS:
1. SUMÁRIO: Texto integral do sumário jurisprudencial.
2. DATA: Data da decisão (DD-MM-AAAA).
3. MAGISTRADOS: Nome do Relator e nomes dos Adjuntos.
4. DESCRITORES: Identifica os 3 a 5 temas ou descritores jurídicos principais (tags) relevantes para o caso. **IMPORTANTE: Não deixes este campo vazio.**
5. Se um campo não for encontrado, usa "N/D".

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
    console.error("Erro na extração IA:", error);
    return null;
  }
};
