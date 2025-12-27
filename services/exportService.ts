import { Acordao, ChatSession, SearchResult } from "../types";

// Helper to construct HTML for Word export
// Using HTML-to-Docx strategy for simplicity without heavy dependencies in browser
const exportToDoc = (filename: string, htmlContent: string) => {
  const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
    "xmlns:w='urn:schemas-microsoft-com:office:word' " +
    "xmlns='http://www.w3.org/TR/REC-html40'> " +
    "<head><meta charset='utf-8'><title>Export HTML to Word Document with JavaScript</title></head><body>";
  const footer = "</body></html>";
  const sourceHTML = header + htmlContent + footer;

  const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
  const fileDownload = document.createElement("a");
  document.body.appendChild(fileDownload);
  fileDownload.href = source;
  fileDownload.download = `${filename}.doc`;
  fileDownload.click();
  document.body.removeChild(fileDownload);
};

export const exportSearchResults = (result: SearchResult) => {
  let content = `<h1>Resultado da Pesquisa</h1>`;
  content += `<p><strong>Data da Pesquisa:</strong> ${new Date(result.date).toLocaleString()}</p>`;
  content += `<h3>Filtros Utilizados:</h3>`;
  content += `<ul>
    ${result.filters.processo ? `<li>Processo: ${result.filters.processo}</li>` : ''}
    ${result.filters.relator ? `<li>Relator: ${result.filters.relator}</li>` : ''}
    ${result.filters.adjunto ? `<li>Adjunto: ${result.filters.adjunto}</li>` : ''}
    ${result.filters.dataInicio ? `<li>Data Início: ${result.filters.dataInicio}</li>` : ''}
    ${result.filters.dataFim ? `<li>Data Fim: ${result.filters.dataFim}</li>` : ''}
    ${result.filters.booleanAnd ? `<li>AND: ${result.filters.booleanAnd}</li>` : ''}
    ${result.filters.booleanOr ? `<li>OR: ${result.filters.booleanOr}</li>` : ''}
    ${result.filters.booleanNot ? `<li>NOT: ${result.filters.booleanNot}</li>` : ''}
  </ul>`;

  content += `<h2>Acórdãos Encontrados (${result.results.length})</h2>`;
  
  result.results.forEach(acordao => {
    content += `<hr/>`;
    content += `<p><strong>Processo:</strong> ${acordao.processo}</p>`;
    content += `<p><strong>Relator:</strong> ${acordao.relator}</p>`;
    content += `<p><strong>Adjuntos:</strong> ${acordao.adjuntos.join(', ')}</p>`;
    content += `<p><strong>Data:</strong> ${acordao.data}</p>`;
    content += `<p><strong>Sumário:</strong><br/>${acordao.sumario.replace(/\n/g, '<br/>')}</p>`;
  });

  exportToDoc(`pesquisa_${new Date().getTime()}`, content);
};

export const exportChatSession = (session: ChatSession, allAcordaos: Acordao[]) => {
  let content = `<h1>Exportação de Chat Jurídico</h1>`;
  content += `<p><strong>Data:</strong> ${new Date(session.createdAt).toLocaleString()}</p>`;

  session.messages.forEach(msg => {
    content += `<hr/>`;
    content += `<h3>${msg.role === 'user' ? 'Pergunta' : 'Resposta'}</h3>`;
    // Basic markdown to HTML conversion for breaks and bold
    let formatted = msg.content
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    content += `<p>${formatted}</p>`;
  });

  exportToDoc(`chat_${session.id}`, content);
};