
import { Acordao } from '../types';

const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();

const cleanRunningText = (fullText: string): string => {
  let cleaned = fullText.replace(/Processo n\.º\s*.*?\n/gi, ''); 
  cleaned = cleaned.replace(/-\s*\n\s*/g, '');
  cleaned = cleaned.replace(/([^.;:!?])\s*\n\s*/g, '$1 ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  return cleaned.trim();
};

/**
 * Tenta extrair especificamente a secção de Fundamentação de Direito
 * Ignora o Relatório, os Factos e a Impugnação da Matéria de Facto.
 */
const extractLegalReasoning = (fullText: string): string => {
  // 1. Encontrar o início da fundamentação de direito
  const startMarkers = [
    /FUNDAMENTAÇÃO\s+DE\s+DIREITO/i,
    /O\s+DIREITO/i,
    /DO\s+DIREITO/i,
    /APRECIAÇÃO\s+JURÍDICA/i,
    /MÉRITO\s+DO\s+RECURSO/i,
    /APRECIAÇÃO\s+DO\s+RECURSO/i
  ];

  // 2. Encontrar o fim (Decisão)
  const endMarkers = [
    /\n\s*DECISÃO\s*\n/i,
    /\n\s*DISPOSITIVO\s*\n/i,
    /\n\s*ACORDAM\s*\n/i,
    /\n\s*CUSTAS\s*\n/i,
    /Em\s+face\s+do\s+exposto/i
  ];

  let startIndex = -1;
  for (const marker of startMarkers) {
    const match = fullText.match(marker);
    if (match && match.index !== undefined) {
      startIndex = match.index;
      break;
    }
  }

  // Se não encontrar início claro, pega a partir de 40% do texto (heurística)
  if (startIndex === -1) startIndex = Math.floor(fullText.length * 0.4);

  let endIndex = fullText.length;
  for (const marker of endMarkers) {
    const match = fullText.substring(startIndex).match(marker);
    if (match && match.index !== undefined) {
      endIndex = startIndex + match.index;
      break;
    }
  }

  let reasoning = fullText.substring(startIndex, endIndex);

  // 3. Remover secções de Impugnação de Factos que por vezes estão dentro ou logo antes
  const factImpugnationMarkers = [
    /da\s+impugnação\s+da\s+matéria\s+de\s+facto/gi,
    /recurso\s+da\s+matéria\s+de\s+facto/gi,
    /factos\s+provados/gi,
    /factos\s+não\s+provados/gi
  ];

  // Se o bloco extraído começar com análise de factos, tentamos saltar esse sub-bloco
  factImpugnationMarkers.forEach(marker => {
     const match = reasoning.match(marker);
     if (match && match.index !== undefined && match.index < reasoning.length * 0.3) {
        // Se encontrar menção a factos no início da fundamentação, 
        // procuramos o próximo marcador de "Direito" dentro do bloco
        const subRight = reasoning.substring(match.index + 50).search(/Direito|Mérito/i);
        if (subRight !== -1) {
            reasoning = reasoning.substring(match.index + 50 + subRight);
        }
     }
  });

  return reasoning.trim();
};

export const extractDataFromPdf = async (file: File): Promise<Acordao> => {
  const arrayBuffer = await file.arrayBuffer();
  // @ts-ignore
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullRawText = '';
  const numPages = pdf.numPages;

  // Extraímos agora TODAS as páginas para análise profunda
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // @ts-ignore
    const strings = textContent.items.map((item: any) => item.str);
    fullRawText += strings.join(' ') + '\n';
  }

  // Metadados continuam a ser procurados no topo/fim (usando os primeiros 4000 caracteres e últimos 4000)
  const headerText = fullRawText.substring(0, 8000);
  const footerText = fullRawText.substring(fullRawText.length - 8000);
  const metaSearchText = headerText + '\n' + footerText;

  let relator = 'Desconhecido';
  let data = 'N/D';
  let adjuntos: string[] = [];
  let tipoDecisao: 'Acórdão' | 'Decisão Sumária' = 'Acórdão';

  if (/Decisão\s+Sumária/i.test(headerText)) {
    tipoDecisao = 'Decisão Sumária';
  }

  const signatureRegex = /Assinado em\s+(\d{2}-\d{2}-\d{4}),\s*por\s*[\n\s]*([^\n,]+)/gi;
  const matches = [...metaSearchText.matchAll(signatureRegex)];

  if (matches.length > 0) {
    data = matches[0][1];
    relator = matches[0][2].trim();
    if (tipoDecisao === 'Acórdão') {
        for (let i = 1; i < matches.length; i++) {
          const nome = matches[i][2].trim();
          if (nome !== relator && !adjuntos.includes(nome)) adjuntos.push(nome);
        }
    }
  }

  const processMatch = headerText.match(/(\d+[\.\/]\d+[\.\/]?\d*[A-Z\-\.]+[A-Z0-9\-\.]*)/);
  const processo = processMatch ? processMatch[1] : 'N/D';

  let sumario = '';
  const sumarioMatch = fullRawText.match(/Sumário:?\s*([\s\S]*?)(?=(Decisão|DECISÃO|Acordam|ACORDAM|Relatório|Fundamentação|Custas|Notas:|Bibliografia|$))/i);
  if (sumarioMatch && sumarioMatch[1]) {
      sumario = cleanRunningText(sumarioMatch[1]).substring(0, 5000);
  }

  // O "Texto de Análise" agora é focado exclusivamente no Direito
  const fundamentacao = extractLegalReasoning(fullRawText);

  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    processo: cleanText(processo),
    relator: cleanText(relator),
    adjuntos: adjuntos,
    data: cleanText(data),
    sumario: sumario || "Sumário não identificado automaticamente.",
    descritores: [],
    textoAnalise: cleanRunningText(fundamentacao), // Aqui reside o Direito purificado
    textoCompleto: fullRawText,
    tipoDecisao
  };
};
