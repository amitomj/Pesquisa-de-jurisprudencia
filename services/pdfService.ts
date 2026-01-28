
import { Acordao } from '../types';

const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();

const preserveStructuralText = (text: string): string => {
  return text.trim();
};

/**
 * Remove ruído típico de acórdãos portugueses (cabeçalhos, rodapés, contactos, URLs)
 */
const cleanLegalPageText = (text: string): string => {
  const lines = text.split('\n');
  const noisyPatterns = [
    /^\s*\d+\s*\/\s*\d+\s*$/i,                  // 1/10
    /^\s*pág(?:ina)?\.?\s*\d+.*$/i,             // Pág. 1
    /^\s*acórdão\s+do\s+tribunal.*$/i,           // Repetitivos
    /^\s*processo\s+n\.?º\s+.*$/i,               // Cabeçalhos de processo
    /^\s*www\..*?\.(?:pt|com|gov).*$/i,          // URLs
    /^\s*rua\s+.*?\d+.*$/i,                      // Moradas no rodapé
    /^\s*(?:tel|fax|e-mail|email)[:\s].*$/i,     // Contactos
    /^\s*mod\.\s+\d+.*$/i,                       // Códigos de formulário
    /^\s*assinado\s+eletronicamente.*$/i,        // Assinaturas digitais de rodapé
    /^[\d\s]*$/                                  // Linhas só com números ou espaços
  ];

  const cleanedLines = lines.filter((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (noisyPatterns.some(p => p.test(trimmed))) return false;
    if (/^\s*\[?\d+\]?\s+[A-Z]/.test(trimmed) && index > lines.length - 5) return false;
    return true;
  });

  return cleanedLines.join('\n');
};

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
  
  const numPages = pdf.numPages;
  const pagesText: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // @ts-ignore
    const strings = textContent.items.map((item: any) => item.str);
    const pageRawText = strings.join('\n');
    pagesText.push(cleanLegalPageText(pageRawText));
  }

  const fullText = pagesText.join('\n');
  const firstThree = pagesText.slice(0, 3).join('\n');
  const lastThree = pagesText.slice(Math.max(0, numPages - 3)).join('\n');
  const contextForSummary = `[INÍCIO DO DOCUMENTO]\n${firstThree}\n\n[FIM DO DOCUMENTO]\n${lastThree}`;

  let relator = 'Desconhecido';
  let data = 'N/D';
  let adjuntos: string[] = [];
  let tipoDecisao: 'Acórdão' | 'Decisão Sumária' = 'Acórdão';

  const signatureRegex = /Assinado em\s+(\d{2}-\d{2}-\d{4}),\s*por\s*([^\n,]+)/gi;
  const matches = [...fullText.matchAll(signatureRegex)];
  if (matches.length > 0) {
    data = matches[0][1];
    relator = matches[0][2].trim();
    for (let i = 1; i < matches.length; i++) {
      const nome = matches[i][2].trim();
      if (nome !== relator && !adjuntos.includes(nome)) adjuntos.push(nome);
    }
  }

  const processMatch = fullText.match(/(\d+[\.\/]\d+[\.\/]?\d*[A-Z\-\.]+[A-Z0-9\-\.]*)/);
  const processo = processMatch ? processMatch[1] : 'N/D';

  const relatorioMatch = fullText.match(/(?:I\.\s*|Relatório|RELATÓRIO)([\s\S]*?)(?=(?:II\.\s*|Fundamentação|Factos))/i);
  const factosProvadosMatch = fullText.match(/(?:Factos\s+Provados|Fundamentação\s+de\s+Facto)([\s\S]*?)(?=(?:Factos\s+não\s+Provados|III\.\s*|O\s+Direito|Fundamentação\s+de\s+Direito))/i);
  const factosNaoProvadosMatch = fullText.match(/(?:Factos\s+não\s+Provados)([\s\S]*?)(?=(?:III\.\s*|O\s+Direito|Fundamentação\s+de\s+Direito))/i);
  const direitoMatch = fullText.match(/(?:Fundamentação\s+de\s+Direito|O\s+Direito|III\.\s*Direito)([\s\S]*?)(?=(?:IV\.\s*|Decisão|Conclusão|$))/i);

  let sumario = 'Sumário não encontrado';
  const sumarioRegex = /(?:Sumário|SUMÁRIO)(?:\s+da\s+responsabilidade\s+do\s+relator)?[:\s\n]+([\s\S]*?)(?=(?:\n\s*[I1]\s*[\)\.]|Decisão|DECISÃO|Acordam|ACORDAM|Relatório|Fundamentação|Custas|Dispositivo|$))/i;
  
  const sumarioMatch = contextForSummary.match(sumarioRegex);
  if (sumarioMatch && sumarioMatch[1].trim().length > 10) {
    sumario = sumarioMatch[1].trim().replace(/\n{3,}/g, '\n\n');
  }

  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    filePath: file.webkitRelativePath || file.name, // Importante para anti-duplicação
    processo: cleanText(processo),
    relator: cleanText(relator),
    adjuntos: adjuntos,
    data: cleanText(data),
    sumario: sumario,
    descritores: [],
    textoAnalise: contextForSummary,
    textoCompleto: fullText,
    tipoDecisao,
    relatorio: relatorioMatch ? preserveStructuralText(relatorioMatch[1]) : '',
    factosProvados: factosProvadosMatch ? preserveStructuralText(factosProvadosMatch[1]) : '',
    factosNaoProvados: factosNaoProvadosMatch ? preserveStructuralText(factosNaoProvadosMatch[1]) : '',
    fundamentacaoDireito: direitoMatch ? filterFactImpugnation(preserveStructuralText(direitoMatch[1])) : ''
  };
};
