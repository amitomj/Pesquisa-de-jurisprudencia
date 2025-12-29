
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
    
    const relevantContext = context.map(c => {
      const direito = c.fundamentacaoDireito || "[Fundamentação de Direito não segmentada separadamente]";
      return `### DOCUMENTO JURÍDICO
ID_REF: ${c.id}
Processo: ${c.processo}
Data: ${c.data}
Relator: ${c.relator}
Tribunal: ${c.fileName.toLowerCase().includes('trl') ? 'Relação de Lisboa' : c.fileName.toLowerCase().includes('trp') ? 'Relação do Porto' : c.fileName.toLowerCase().includes('trc') ? 'Relação de Coimbra' : c.fileName.toLowerCase().includes('trg') ? 'Relação de Guimarães' : c.fileName.toLowerCase().includes('tre') ? 'Relação de Évora' : 'Tribunal Superior'}

SUMÁRIO:
${c.sumario}

FUNDAMENTAÇÃO JURÍDICA:
${direito.substring(0, 7500)}`;
    }).join('\n\n---\n\n');

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Atua como um Consultor Jurídico Sénior. Analisa os acórdãos fornecidos e elabora uma resposta estruturada sobre a questão colocada.

IMPORTANTE: O utilizador pode referir-se a processos específicos (ex: 883/21.0T8VFR.P1). Verifica SEMPRE se algum dos documentos abaixo corresponde ao processo solicitado antes de dizer que não o encontras.

A TUA RESPOSTA DEVE SEGUIR ESTE MODELO RIGOROSO:

1. ENQUADRAMENTO INICIAL
- Descreve brevemente se existe consenso ou divisão na jurisprudência sobre o tema.
- Se o utilizador perguntou por um processo específico, identifica-o logo aqui.

2. POSIÇÕES JURÍDICAS IDENTIFICADAS (Usa numeração para cada corrente/tese)
Para cada posição:
- Define a tese (ex: "Posição favorável a...", "Posição restritiva que defende...").
- Explica o fundamento jurídico.
- CITA OS ACÓRDÃOS que sustentam esta posição indicando: Tribunal, Data, Processo e a ID_REF no formato [ID_REF: uuid].

3. NÚCLEO CENTRAL DA DIVERGÊNCIA
- Identifica o ponto exato onde os tribunais divergem.
- Menciona princípios interpretativos relevantes.

REGRAS:
- NUNCA menciones factos concretos dos casos (nomes de arguidos, locais, etc). Foca-te apenas no DIREITO.
- Usa IDs de referência [ID_REF: uuid] sempre que citar um acórdão.

CONTEXTO DOS ACÓRDÃOS DISPONÍVEIS:
${relevantContext}

QUESTÃO DO UTILIZADOR: 
${question}`,
      config: {
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 8000 }
      }
    });

    return response.text || "Não foi possível gerar uma análise jurídica baseada nos documentos fornecidos.";
  } catch (error: any) {
    const errType = await handleApiError(error);
    if (errType === "API_LIMIT_REACHED") return "AVISO: Limite de quota da API excedido.";
    return "Erro técnico na geração da resposta jurídica.";
  }
};

export const extractMetadataWithAI = async (textContext: string, availableDescriptors: string[], apiKey: string): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Atua como um extrator de texto literal de acórdãos judiciais. 

REGRAS CRÍTICAS PARA O SUMÁRIO:
1. NÃO RESUMAS: O sumário deve ser EXTRAÍDO LITERALMENTE (letra a letra) do texto fornecido.
2. CONTINUIDADE: Se o sumário estiver dividido por quebras de página, junta o texto de forma contínua.
3. LIMPEZA ABSOLUTA: Remove/Ignora explicitamente quaisquer números de página (ex: "1/10"), moradas, contactos ou nomes de tribunais que apareçam no meio do texto por causa das quebras de página.
4. SE NÃO EXISTIR: Se não encontrares um sumário explícito e literal, devolve OBRIGATORIAMENTE a frase: "Sumário não encontrado".

DESCRITORES:
Escolhe 3-5 descritores da lista oficial que melhor se adequem ao tema: [${availableDescriptors.join(", ")}]

TEXTO DO DOCUMENTO (Segmentos):
${textContext}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            data: { type: Type.STRING },
            relator: { type: Type.STRING },
            adjuntos: { type: Type.ARRAY, items: { type: Type.STRING } },
            sumario: { type: Type.STRING, description: "O sumário literal limpo de lixo de layout." },
            descritores: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["data", "relator", "adjuntos", "sumario", "descritores"]
        }
      }
    });
    return response.text ? JSON.parse(response.text) : null;
  } catch (error) { return null; }
};
