
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
 * Tenta extrair o sumário baseando-se em marcadores específicos
 * Procura nas primeiras 2 páginas e últimas 4 páginas.
 */
const extractTargetedSummary = (pages: string[]): string => {
  const numPages = pages.length;
  // Focar nas primeiras 2 e últimas 4
  const targetPages = [];
  for (let i = 0; i < Math.min(2, numPages); i++) targetPages.push(pages[i]);
  for (let i = Math.max(0, numPages - 4); i < numPages; i++) {
    if (!targetPages.includes(pages[i])) targetPages.push(pages[i]);
  }

  const combinedText = targetPages.join('\n');

  // Marcadores fornecidos pelo utilizador + variações comuns
  const sumarioMarkers = [
    /sumário:?/i,
    /Sumário/i,
    /segue\s+sumário\s+da\s+responsabilidade\s+da\s+relatora/i,
    /Sumário\s+\(art\.\s*663º,\s*nº\s*7,\s*do\s*CPC\):?/i,
    /Sumário\s+\(\s*elaborado\s+pela\s+relatora\s+nos\s+termos\s+do\s+nº7\s+do\s+art\.\s*663º\s+do\s+C\.P\.Civil\)/i,
    /Sumário\s+da\s+responsabilidade\s+do\s+relator/i
  ];

  for (const marker of sumarioMarkers) {
    const match = combinedText.match(marker);
    if (match && match.index !== undefined) {
      // Extrai até encontrar um marcador de fim de secção ou o fim do bloco
      const start = match.index + match[0].length;
      const sub = combinedText.substring(start);
      const endMatch = sub.match(/\n\s*(DECISÃO|ACORDAM|RELATÓRIO|FUNDAMENTAÇÃO|I\.|1\.)/i);
      const end = endMatch ? endMatch.index : 3000; // Limite de segurança
      const candidate = sub.substring(0, end).trim();
      if (candidate.length > 50) return cleanRunningText(candidate);
    }
  }

  return "";
};

const extractLegalReasoning = (fullText: string): string => {
  const startMarkers = [
    /FUNDAMENTAÇÃO\s+DE\s+DIREITO/i,
    /O\s+DIREITO/i,
    /DO\s+DIREITO/i,
    /APRECIAÇÃO\s+JURÍDICA/i,
    /MÉRITO\s+DO\s+RECURSO/i,
    /APRECIAÇÃO\s+DO\s+RECURSO/i
  ];

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

  if (startIndex === -1) startIndex = Math.floor(fullText.length * 0.4);

  let endIndex = fullText.length;
  for (const marker of endMarkers) {
    const match = fullText.substring(startIndex).match(marker);
    if (match && match.index !== undefined) {
      endIndex = startIndex + match.index;
      break;
    }
  }

  return fullText.substring(startIndex, endIndex).trim();
};

export const extractDataFromPdf = async (file: File): Promise<Acordao> => {
  const arrayBuffer = await file.arrayBuffer();
  // @ts-ignore
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const pagesText: string[] = [];
  let fullRawText = '';
  const numPages = pdf.numPages;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // @ts-ignore
    const strings = textContent.items.map((item: any) => item.str);
    const pageStr = strings.join(' ');
    pagesText.push(pageStr);
    fullRawText += pageStr + '\n';
  }

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

  // Tentativa focada de extração de sumário
  let sumario = extractTargetedSummary(pagesText);

  // Fallback para o método antigo se falhar
  if (!sumario) {
      const sumarioMatch = fullRawText.match(/Sumário:?\s*([\s\S]*?)(?=(Decisão|DECISÃO|Acordam|ACORDAM|Relatório|Fundamentação|Custas|Notas:|Bibliografia|$))/i);
      if (sumarioMatch && sumarioMatch[1]) {
          sumario = cleanRunningText(sumarioMatch[1]).substring(0, 5000);
      }
  }

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
    textoAnalise: cleanRunningText(fundamentacao),
    textoCompleto: fullRawText,
    tipoDecisao
  };
};
