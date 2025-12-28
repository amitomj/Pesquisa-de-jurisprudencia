
import { Acordao } from '../types';

const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();

const preserveStructuralText = (text: string): string => {
  return text
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
};

// Remove secções de impugnação da matéria de facto para isolar o Direito
const filterFactImpugnation = (text: string): string => {
  const impugnationMarkers = [
    /impugnação\s+da\s+matéria\s+de\s+facto/i,
    /recurso\s+da\s+matéria\s+de\s+facto/i,
    /da\s+impugnação\s+da\s+decisão\s+de\s+facto/i
  ];
  
  let cleaned = text;
  impugnationMarkers.forEach(marker => {
    const parts = cleaned.split(marker);
    if (parts.length > 1) {
      // Tenta encontrar o próximo título importante para retomar o texto
      const resumeMarkers = [/II\.\s*Fundamentação/i, /O\s+Direito/i, /Apreciando/i, /Decisão/i];
      let resumeIndex = -1;
      resumeMarkers.forEach(rm => {
        const found = parts[1].search(rm);
        if (found !== -1 && (resumeIndex === -1 || found < resumeIndex)) resumeIndex = found;
      });
      
      if (resumeIndex !== -1) {
        cleaned = parts[0] + "\n[SECÇÃO DE FACTOS REMOVIDA]\n" + parts[1].substring(resumeIndex);
      }
    }
  });
  return cleaned;
};

export const extractDataFromPdf = async (file: File): Promise<Acordao> => {
  const arrayBuffer = await file.arrayBuffer();
  // @ts-ignore
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  const numPages = pdf.numPages;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // @ts-ignore
    const strings = textContent.items.map((item: any) => item.str);
    fullText += strings.join(' ') + '\n';
  }

  const combinedSearchText = fullText;
  
  // Metadados Básicos
  let relator = 'Desconhecido';
  let data = 'N/D';
  let adjuntos: string[] = [];
  let tipoDecisao: 'Acórdão' | 'Decisão Sumária' = 'Acórdão';

  const signatureRegex = /Assinado em\s+(\d{2}-\d{2}-\d{4}),\s*por\s*[\n\s]*([^\n,]+)/gi;
  const matches = [...combinedSearchText.matchAll(signatureRegex)];
  if (matches.length > 0) {
    data = matches[0][1];
    relator = matches[0][2].trim();
    for (let i = 1; i < matches.length; i++) {
      const nome = matches[i][2].trim();
      if (nome !== relator && !adjuntos.includes(nome)) adjuntos.push(nome);
    }
  }

  const processMatch = combinedSearchText.match(/(\d+[\.\/]\d+[\.\/]?\d*[A-Z\-\.]+[A-Z0-9\-\.]*)/);
  const processo = processMatch ? processMatch[1] : 'N/D';

  // Segmentação Estrutural
  const relatorioMatch = combinedSearchText.match(/(?:I\.\s*|Relatório|RELATÓRIO)([\s\S]*?)(?=(?:II\.\s*|Fundamentação|Factos))/i);
  const factosProvadosMatch = combinedSearchText.match(/(?:Factos\s+Provados|Fundamentação\s+de\s+Facto)([\s\S]*?)(?=(?:Factos\s+não\s+Provados|III\.\s*|O\s+Direito|Fundamentação\s+de\s+Direito))/i);
  const factosNaoProvadosMatch = combinedSearchText.match(/(?:Factos\s+não\s+Provados)([\s\S]*?)(?=(?:III\.\s*|O\s+Direito|Fundamentação\s+de\s+Direito))/i);
  const direitoMatch = combinedSearchText.match(/(?:Fundamentação\s+de\s+Direito|O\s+Direito|III\.\s*Direito)([\s\S]*?)(?=(?:IV\.\s*|Decisão|Conclusão|$))/i);

  // Regra Sumário Literal (3+3 páginas)
  let sumario = '';
  const sumarioRegex = /(?:Sumário|SUMÁRIO)(?:\s+da\s+responsabilidade\s+do\s+relator)?[:\s\n]+([\s\S]*?)(?=(?:\n\s*I\s*[\)\.]|\n\s*1\s*[\)\.]|Decisão|DECISÃO|Acordam|ACORDAM|Relatório|Fundamentação|$))/i;
  const sumarioMatch = combinedSearchText.match(sumarioRegex);
  if (sumarioMatch) sumario = preserveStructuralText(sumarioMatch[1]);
  if (!sumario || sumario.length < 20) sumario = "Sumário não encontrado";

  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    processo: cleanText(processo),
    relator: cleanText(relator),
    adjuntos: adjuntos,
    data: cleanText(data),
    sumario: sumario,
    descritores: [],
    textoAnalise: combinedSearchText,
    textoCompleto: combinedSearchText,
    tipoDecisao,
    relatorio: relatorioMatch ? preserveStructuralText(relatorioMatch[1]) : '',
    factosProvados: factosProvadosMatch ? preserveStructuralText(factosProvadosMatch[1]) : '',
    factosNaoProvados: factosNaoProvadosMatch ? preserveStructuralText(factosNaoProvadosMatch[1]) : '',
    fundamentacaoDireito: direitoMatch ? filterFactImpugnation(preserveStructuralText(direitoMatch[1])) : ''
  };
};
