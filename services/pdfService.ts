
import { Acordao } from '../types';

const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();

const cleanLegalPageText = (text: string): string => {
  const lines = text.split('\n');
  const noisyPatterns = [
    /^\s*\d+\s*\/\s*\d+\s*$/i,
    /^\s*pág(?:ina)?\.?\s*\d+.*$/i,
    /^\s*acórdão\s+do\s+tribunal.*$/i,
    /^\s*processo\s+n\.?º\s+.*$/i,
    /^\s*www\..*?\.(?:pt|com|gov).*$/i,
    /^\s*rua\s+.*?\d+.*$/i,
    /^\s*(?:tel|fax|e-mail|email)[:\s].*$/i,
    /^\s*mod\.\s+\d+.*$/i,
    /^\s*assinado\s+eletronicamente.*$/i,
    /^[\d\s]*$/
  ];

  return lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    return !noisyPatterns.some(p => p.test(trimmed));
  }).join('\n');
};

const filterFactImpugnation = (text: string): string => {
  const marker = /impugnação\s+da\s+matéria\s+de\s+facto/i;
  const parts = text.split(marker);
  if (parts.length > 1) {
    const resumeMarker = /II\.\s*Fundamentação|O\s+Direito|Apreciando/i;
    const resumeIndex = parts[1].search(resumeMarker);
    if (resumeIndex !== -1) {
      return parts[0] + "\n[...]\n" + parts[1].substring(resumeIndex);
    }
  }
  return text;
};

export const extractDataFromPdf = async (file: File): Promise<Acordao> => {
  const arrayBuffer = await file.arrayBuffer();
  // @ts-ignore
  const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  const numPages = pdf.numPages;
  const pagesText: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // @ts-ignore
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    pagesText.push(cleanLegalPageText(pageText));
    // Importante: Não guardar referências pesadas à página
  }

  const fullTextTemp = pagesText.join('\n');
  const contextForSummary = `[INÍCIO]\n${pagesText.slice(0, 3).join('\n')}\n[FIM]\n${pagesText.slice(-3).join('\n')}`;

  let relator = 'Desconhecido';
  let data = 'N/D';
  let adjuntos: string[] = [];

  const signatureRegex = /Assinado em\s+(\d{2}-\d{2}-\d{4}),\s*por\s*([^\n,]+)/gi;
  const matches = [...fullTextTemp.matchAll(signatureRegex)];
  if (matches.length > 0) {
    data = matches[0][1];
    relator = matches[0][2].trim();
    for (let i = 1; i < matches.length; i++) {
      const nome = matches[i][2].trim();
      if (nome !== relator && !adjuntos.includes(nome)) adjuntos.push(nome);
    }
  }

  const procMatch = fullTextTemp.match(/(\d+[\.\/]\d+[\.\/]?\d*[A-Z\-\.]+[A-Z0-9\-\.]*)/);
  const processo = procMatch ? procMatch[1] : 'N/D';

  const relatorioMatch = fullTextTemp.match(/(?:I\.\s*|Relatório)([\s\S]*?)(?=(?:II\.\s*|Fundamentação|Factos))/i);
  const factosMatch = fullTextTemp.match(/(?:Factos\s+Provados|Fundamentação\s+de\s+Facto)([\s\S]*?)(?=(?:III\.\s*|O\s+Direito))/i);
  const direitoMatch = fullTextTemp.match(/(?:O\s+Direito|III\.\s*Direito)([\s\S]*?)(?=(?:IV\.\s*|Decisão|$))/i);

  let sumario = 'Sumário não encontrado';
  const sumarioRegex = /(?:Sumário|SUMÁRIO)[:\s\n]+([\s\S]*?)(?=(?:\n\s*[I1]\s*[\)\.]|Decisão|Acordam|Relatório|$))/i;
  const sMatch = contextForSummary.match(sumarioRegex);
  if (sMatch && sMatch[1].trim().length > 10) sumario = sMatch[1].trim();

  // Libertar memória do PDF.js explicitamente
  await pdf.destroy();

  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    filePath: file.webkitRelativePath || file.name,
    processo: cleanText(processo),
    relator: cleanText(relator),
    adjuntos: adjuntos,
    data: cleanText(data),
    sumario: sumario,
    descritores: [],
    textoAnalise: contextForSummary,
    tipoDecisao: 'Acórdão',
    relatorio: relatorioMatch ? cleanText(relatorioMatch[1]).substring(0, 5000) : '',
    factosProvados: factosMatch ? cleanText(factosMatch[1]).substring(0, 5000) : '',
    factosNaoProvados: '',
    fundamentacaoDireito: direitoMatch ? filterFactImpugnation(cleanText(direitoMatch[1])).substring(0, 10000) : ''
  };
};
