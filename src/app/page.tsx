
import { SpreadsheetManager } from '@/components/spreadsheet-manager';
import type { Project } from '@/lib/types';

// O componente do servidor agora é muito mais simples.
// Ele apenas renderiza o gerenciador de planilhas e passa o ID da planilha da URL,
// deixando toda a lógica de busca de dados (online/offline) para o cliente.

const defaultProjects: Project[] = [
  { name: 'PAREI v1.1 - GESTOR DE PARADAS', id: '1hs8LtsybSCLIsfO-4G-EtZpBrIzf339PeuhdjOU5UeI' },
];

// O Apps Script URL pode ser necessário no cliente, então o mantemos acessível
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVAMAIp7RbVAzb3YGkIZq8Kr_HBEfFnx1iBa_981c4kb0bdmAJJAEhbHGZBPwwe1Hdpg/exec';

async function getSheetDataFromServer(sheetId: string) {
  if (!sheetId) {
    return { headers: [], data: [], error: "ID da planilha não fornecido." };
  }
  try {
    const url = `${APPS_SCRIPT_URL}?action=getData&sheetId=${sheetId}`;
    const response = await fetch(url, { next: { revalidate: 5 } }); // Alterado para revalidação curta
    if (!response.ok) {
       const errorText = await response.text();
       console.error(`Erro de rede ao buscar dados: ${response.status} - ${errorText}`);
       throw new Error(`Erro de rede: ${response.status}. Verifique a conexão e o ID da planilha.`);
    }
    const json = await response.json();
    if (json.error) {
      throw new Error(json.error);
    }
    if (!Array.isArray(json.data) || json.data.length === 0) {
      throw new Error('Nenhum dado retornado da planilha. Verifique se a planilha está vazia ou se o ID está correto.');
    }
    const headers: string[] = json.data[0];
    const idColumnIndex = headers.indexOf('ID');

    if (idColumnIndex === -1) {
        throw new Error('A coluna "ID" não foi encontrada na planilha. Ela é essencial para o funcionamento do aplicativo.');
    }
      
    const data = json.data.slice(1).map((row: any[], index: number) => {
      const rowObj: { [key: string]: any } = {};
      // Usa o valor da coluna 'ID' como o id da linha. Se estiver vazio, usa o número da linha como fallback.
      const rowId = row[idColumnIndex] ? Number(row[idColumnIndex]) : index + 1;
      rowObj['id'] = rowId;

      row.forEach((cell, i) => {
        rowObj[headers[i]] = cell ?? '';
      });
      return rowObj;
    });

    return { headers, data, error: null };
  } catch (error) {
    console.error('Erro no fetch do servidor:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    // Retornamos o erro para que o cliente possa tentar o modo offline
    return { headers: [], data: [], error: errorMessage };
  }
}

async function getLogDataFromServer(sheetId: string) {
    if (!sheetId) return { data: [], error: "ID da planilha não fornecido." };
    try {
        const url = `${APPS_SCRIPT_URL}?action=getLogData&sheetId=${sheetId}`;
        const response = await fetch(url, { next: { revalidate: 5 } }); // Alterado para revalidação curta
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Erro de rede ao buscar log: ${response.status} - ${errorText}`);
            throw new Error(`Erro de rede ao buscar log: ${response.status}`);
        }
        const json = await response.json();
        if (json.error) {
            console.error('Erro do script ao buscar log:', json.error);
            throw new Error(json.error);
        }
        if (!Array.isArray(json.data)) {
            return { data: [], error: null };
        }
        const logHeaders = json.data[0];
        const logData = json.data.slice(1).map((row: any[]) => {
            const rowObj: { [key: string]: any } = {};
            row.forEach((cell, i) => {
                rowObj[logHeaders[i]] = cell;
            });
            return rowObj;
        });
        
        return { data: logData, error: null };
    } catch (error) {
        console.error('Erro no fetch do log:', error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return { data: [], error: errorMessage };
    }
}


export default async function Home({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const currentSheetId = typeof searchParams?.sheetId === 'string' ? searchParams.sheetId : defaultProjects[0].id;
  
  // O servidor agora apenas tenta buscar os dados da rede.
  // A lógica de fallback para offline será tratada no cliente.
  const serverResult = await getSheetDataFromServer(currentSheetId);
  const logResult = await getLogDataFromServer(currentSheetId);

  // Não precisamos mais salvar no IndexedDB aqui, isso será feito no cliente.

  return (
    <main className="bg-transparent min-h-screen">
      <div className="w-full px-2 sm:px-4 py-8">
        <SpreadsheetManager 
          initialData={serverResult.data} 
          initialHeaders={serverResult.headers} 
          initialError={serverResult.error}
          initialLogData={logResult.data}
          initialLogDataError={logResult.error}
          currentSheetId={currentSheetId}
        />
      </div>
    </main>
  );
}
