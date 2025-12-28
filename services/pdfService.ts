
import { Acordao } from '../types';

const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();

const removeHeader = (text: string): string => {
  const headerPattern = /Porto\s*-\s*Tribunal da Relação\s*Secção Social\s*Campo Mártires da Pátria\s*4099-012 Porto\s*Telef:.*?Mail:.*?tribunais\.org\.pt/gis;
  return text.replace(headerPattern, '');
};

const cleanSummaryContent = (text: string): string => {
  const embeddedHeaderRegex = /Processo:\s*[\w\.\/]+\s*Referência:\s*\d+.*?Mail:\s*[\w\.\@]+\s*(Apelações em processo comum e especial\s*\(\d{4}\)|.*?tribunais\.org\.pt)/gis;
  text = text.replace(embeddedHeaderRegex, ' ');
  const footerCutoffRegex = /(\s+|['"]\s*|\s+[ivx\d]+\.?\s*)https?:\/\//i;
  const match = text.match(footerCutoffRegex);
  if (match && match.index) {
      text = text.substring(0, match.index);
  }
  const endMarkers = [/Bibliografia\s*$/i, /Notas:\s*$/i, /Decisão\s*$/i];
  endMarkers.forEach(marker => { text = text.replace(marker, ''); });
  return text;
};

const cleanRunningText = (fullText: string): string => {
  let cleaned = fullText.replace(/Processo n\.º\s*.*?\n/gi, ''); 
  cleaned = cleaned.replace(/-\s*\n\s*/g, '');
  cleaned = cleaned.replace(/([^.;:!?])\s*\n\s*/g, '$1 ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  return cleaned.trim();
};

export const extractDataFromPdf = async (file: File): Promise<Acordao> => {
  const arrayBuffer = await file.arrayBuffer();
  // @ts-ignore
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullRawText = '';
  let summarySearchText = '';
  const numPages = pdf.numPages;

  // Extração seletiva: Primeiras 3 e últimas 3 páginas
  for (let i = 1; i <= numPages; i++) {
    const isFirstPages = i <= 3;
    const isLastPages = i > numPages - 3;

    if (isFirstPages || isLastPages) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // @ts-ignore
      const strings = textContent.items.map((item: any) => item.str);
      const pageText = strings.join(' \n '); 
      summarySearchText += pageText + '\n\n';
      fullRawText += pageText + '\n\n';
    } else {
        // Apenas para manter o rasto do texto completo se necessário, 
        // mas aqui focamos na regra de negócio das extremidades
    }
  }

  summarySearchText = removeHeader(summarySearchText);
  
  let relator = 'Desconhecido';
  let data = 'N/D';
  let adjuntos: string[] = [];
  let tipoDecisao: 'Acórdão' | 'Decisão Sumária' = 'Acórdão';

  // Deteção rigorosa de Decisão Sumária (sempre nas primeiras páginas)
  const summaryDecisionKeywords = [/Decisão\s+Sumária/i, /Decisao\s+Sumaria/i];
  if (summaryDecisionKeywords.some(regex => regex.test(summarySearchText.substring(0, 3000)))) {
    tipoDecisao = 'Decisão Sumária';
  }

  // --- ESTRATÉGIA: Topo e Assinaturas (presentes no summarySearchText) ---
  const signatureRegex = /Assinado em\s+(\d{2}-\d{2}-\d{4}),\s*por\s*[\n\s]*([^\n,]+)/gi;
  const matches = [...summarySearchText.matchAll(signatureRegex)];

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

  const processMatch = summarySearchText.match(/(\d+[\.\/]\d+[\.\/]?\d*[A-Z\-\.]+[A-Z0-9\-\.]*)/);
  const processo = processMatch ? processMatch[1] : 'N/D';

  let sumario = '';
  // Pesquisa de Sumário apenas no summarySearchText (1-3 e últimas 3)
  const sumarioMatch = summarySearchText.match(/Sumário:?\s*([\s\S]*?)(?=(Decisão|DECISÃO|Acordam|ACORDAM|Relatório|Fundamentação|Custas|Notas:|Bibliografia|$))/i);
  
  if (sumarioMatch && sumarioMatch[1]) {
      sumario = sumarioMatch[1];
      if (sumario.length > 5000) sumario = sumario.substring(0, 5000);
      sumario = cleanSummaryContent(sumario);
  }
  
  sumario = cleanRunningText(sumario).trim();
  if (sumario.length < 10) {
      sumario = "Sumário não identificado nas extremidades do documento (Regra 3+3).";
  }

  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    processo: cleanText(processo),
    relator: cleanText(relator),
    adjuntos: adjuntos,
    data: cleanText(data),
    sumario: sumario,
    descritores: [],
    textoAnalise: cleanRunningText(summarySearchText),
    textoCompleto: fullRawText,
    tipoDecisao
  };
};
