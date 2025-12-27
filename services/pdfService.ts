import { Acordao } from '../types';

// Helper to clean generic text
const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();

// Helper to remove specific header at the start of the document
const removeHeader = (text: string): string => {
  const headerPattern = /Porto\s*-\s*Tribunal da Relação\s*Secção Social\s*Campo Mártires da Pátria\s*4099-012 Porto\s*Telef:.*?Mail:.*?tribunais\.org\.pt/gis;
  return text.replace(headerPattern, '');
};

// Advanced Summary Cleaner based on user examples
const cleanSummaryContent = (text: string): string => {
  // 1. Remove Embedded Headers (Page breaks inside summary)
  // Matches: "Processo: ... Referência: ... [Address/Contacts] ... (2013)"
  // This handles the example: "Processo: 810/22... Apelações em processo comum e especial (2013)"
  const embeddedHeaderRegex = /Processo:\s*[\w\.\/]+\s*Referência:\s*\d+.*?Mail:\s*[\w\.\@]+\s*(Apelações em processo comum e especial\s*\(\d{4}\)|.*?tribunais\.org\.pt)/gis;
  text = text.replace(embeddedHeaderRegex, ' ');

  // 2. Remove End-of-doc footnotes/URLs
  // Strategy: Find the first occurrence of a URL pattern that looks like a footnote/citation
  // Examples: "i https://...", "1 https://...", "' https://..."
  
  // This regex looks for a URL, optionally preceded by:
  // - A newline or space
  // - A quote (single or double)
  // - A roman numeral (i, ii, v) or number followed by space or dot
  const footerCutoffRegex = /(\s+|['"]\s*|\s+[ivx\d]+\.?\s*)https?:\/\//i;
  
  const match = text.match(footerCutoffRegex);
  if (match && match.index) {
      // If found, assume everything from this point onwards is garbage/notes
      text = text.substring(0, match.index);
  }

  // 3. Remove standalone specific phrases that act as delimiters
  const endMarkers = [
      /Bibliografia\s*$/i, 
      /Notas:\s*$/i,
      /Decisão\s*$/i // Sometimes "Decisão" is caught at the very end
  ];

  endMarkers.forEach(marker => {
      text = text.replace(marker, '');
  });

  return text;
};

// Helper to reconstruct running text from PDF lines
const cleanRunningText = (fullText: string): string => {
  // 1. Remove obvious page numbers or headers
  let cleaned = fullText.replace(/Processo n\.º\s*.*?\n/gi, ''); 
  
  // 2. Fix broken words at end of lines
  cleaned = cleaned.replace(/-\s*\n\s*/g, '');

  // 3. Join lines that shouldn't be broken
  cleaned = cleaned.replace(/([^.;:!?])\s*\n\s*/g, '$1 ');

  // 4. Normalize multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  return cleaned.trim();
};

export const extractDataFromPdf = async (file: File): Promise<Acordao> => {
  const arrayBuffer = await file.arrayBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullRawText = '';
  const pageTexts: string[] = [];

  // Extract text from all pages
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Join with spaces to preserve flow, but double newline for paragraphs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strings = textContent.items.map((item: any) => item.str);
    const pageText = strings.join(' \n '); 
    pageTexts.push(pageText);
    fullRawText += pageText + '\n\n';
  }

  // Remove the specific header requested by user before processing
  fullRawText = removeHeader(fullRawText);

  // Re-split pages logic (conceptually) or just use full text for signatures
  const firstPage = removeHeader(pageTexts[0] || '');
  
  let relator = 'Desconhecido';
  let data = 'N/D';
  let adjuntos: string[] = [];

  // --- STRATEGY 1: Header Signatures (First Page) ---
  const signatureRegex = /Assinado em\s+(\d{2}-\d{2}-\d{4}),\s*por\s*[\n\s]*([^\n,]+)/gi;
  const matches = [...firstPage.matchAll(signatureRegex)];

  if (matches.length > 0) {
    // First match is Relator
    data = matches[0][1];
    relator = matches[0][2].trim();

    // Subsequent matches are Adjuntos
    for (let i = 1; i < matches.length; i++) {
      const nome = matches[i][2].trim();
      if (nome !== relator && !adjuntos.includes(nome)) {
        adjuntos.push(nome);
      }
    }
  }

  // Deduplicate and clean
  adjuntos = adjuntos.map(cleanText).filter(n => n !== relator);
  adjuntos = [...new Set(adjuntos)];

  // --- Process Number ---
  const processMatch = firstPage.match(/(\d+[\.\/]\d+[\.\/]?\d*[A-Z\-\.]+[A-Z0-9\-\.]*)/);
  const processo = processMatch ? processMatch[1] : 'N/D';

  // --- Summary ---
  let sumario = '';
  // Enhanced regex to stop before common sections or end notes like "Bibliografia" or "Notas"
  const sumarioMatch = fullRawText.match(/Sumário:?\s*([\s\S]*?)(?=(Decisão|DECISÃO|Acordam|ACORDAM|Relatório|Fundamentação|Custas|Notas:|Bibliografia|$))/i);
  
  if (sumarioMatch && sumarioMatch[1]) {
      // Capture rough summary
      sumario = sumarioMatch[1];
      
      // Limit absurdly long captures before cleaning to save performance
      if (sumario.length > 5000) {
          sumario = sumario.substring(0, 5000);
      }
      
      // Apply advanced cleaning (remove embedded headers, cut footnotes)
      sumario = cleanSummaryContent(sumario);
  }
  
  sumario = cleanRunningText(sumario).trim();
  
  // Cleanup common footer noise that might get caught
  sumario = sumario.replace(/\d+\s*\/\s*\d+$/g, ''); 
  
  if (sumario.length === 0) sumario = "Sumário não identificado automaticamente.";

  // --- Legal Analysis ---
  let textoAnalise = '';
  const lawMarkers = [/Fundamentação de Direito/i, /Do Direito/i, /O Direito/i, /Apreciação do mérito/i];
  
  let startIndex = -1;
  for (const marker of lawMarkers) {
      startIndex = fullRawText.search(marker);
      if (startIndex !== -1) break;
  }

  if (startIndex !== -1) {
      textoAnalise = fullRawText.substring(startIndex);
  } else {
     textoAnalise = fullRawText;
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
    textoAnalise: cleanRunningText(textoAnalise),
    textoCompleto: fullRawText
  };
};