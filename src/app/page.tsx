
import { SpreadsheetManager } from '@/components/spreadsheet-manager';
import type { SheetRow, Project } from '@/lib/types';
import { getSheetData as getLocalSheetData, getHeaders as getLocalHeaders, getLogData as getLocalLogData, saveSheetData, saveHeaders, saveLogData } from '@/lib/db';


const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVAMAIp7RbVAzb3YGkIZq8Kr_HBEfFnx1iBa_981c4kb0bdmAJJAEhbHGZBPwwe1Hdpg/exec';

// This is now only a fallback for the very first load or if no ID is provided.
// The primary project list is managed on the client in SpreadsheetManager.
const defaultProjects: Project[] = [
  { name: 'PAREI v1.1 - GESTOR DE PARADAS', id: '1hs8LtsybSCLIsfO-4G-EtZpBrIzf339PeuhdjOU5UeI' },
];

async function getSheetDataFromServer(sheetId: string) {
  if (!sheetId) {
    return { headers: [], data: [], error: "ID da planilha não fornecido." };
  }
  try {
    const url = `${APPS_SCRIPT_URL}?action=getData&sheetId=${sheetId}`;
    const response = await fetch(url, { next: { revalidate: 60 } }); // Revalida a cada 60s
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
    const data: SheetRow[] = json.data.slice(1).map((row: any[], index: number) => {
      const rowObj: { [key: string]: any } = { id: index + 1 };
      row.forEach((cell, i) => {
        rowObj[headers[i]] = cell ?? '';
      });
      return rowObj;
    });

    // Salva no IndexedDB após o fetch bem-sucedido
    await saveHeaders(sheetId, headers);
    await saveSheetData(sheetId, data);
    
    return { headers, data, error: null };
  } catch (error) {
    console.error('Erro no fetch do servidor, tentando fallback para offline:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { headers: [], data: [], error: errorMessage, isOnline: false };
  }
}

async function getLogDataFromServer(sheetId: string) {
    if (!sheetId) return [];
    try {
        const url = `${APPS_SCRIPT_URL}?action=getLogData&sheetId=${sheetId}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            console.error(`Erro de rede ao buscar log: ${response.status}`);
            return null; // Indica falha no fetch
        }
        const json = await response.json();
        if (json.error) {
            console.error('Erro do script ao buscar log:', json.error);
            return null;
        }
        if (!Array.isArray(json.data) || json.data.length <= 1) {
            return [];
        }
        const logHeaders = json.data[0];
        const logData = json.data.slice(1).map((row: any[]) => {
            const rowObj: { [key: string]: any } = {};
            row.forEach((cell, i) => {
                rowObj[logHeaders[i]] = cell;
            });
            return rowObj;
        });
        
        await saveLogData(sheetId, logData);
        return logData;
    } catch (error) {
        console.error('Erro no fetch do log, tentando fallback para offline:', error);
        return null; // Indica falha no fetch
    }
}


export default async function Home({ searchParams }: { searchParams?: { [key: string]: string | undefined } }) {
  const currentSheetId = searchParams?.sheetId || defaultProjects[0].id;
  let headers: string[] = [];
  let data: SheetRow[] = [];
  let logData: any[] = [];
  let error: string | null = null;
  let isOnline = true;

  // 1. Tenta buscar dados do servidor
  const serverResult = await getSheetDataFromServer(currentSheetId);
  if (serverResult.data.length > 0) {
      headers = serverResult.headers;
      data = serverResult.data;
      error = serverResult.error;
  } else {
      isOnline = false;
      error = serverResult.error; // Mantém o erro do servidor
      // 2. Se falhar, tenta carregar do IndexedDB
      console.log(`Buscando dados offline para ${currentSheetId}...`);
      const localHeaders = await getLocalHeaders(currentSheetId);
      const localData = await getLocalSheetData(currentSheetId);

      if (localData && localHeaders) {
          headers = localHeaders;
          data = localData;
          error = null; // Limpa o erro, pois carregou dados offline
          console.log("Dados carregados do modo offline com sucesso.");
      } else {
           console.log("Nenhum dado offline encontrado.");
           if (!error) error = "Falha ao buscar dados e nenhum dado offline disponível.";
      }
  }

  // Lógica para buscar LogData
  const serverLogData = await getLogDataFromServer(currentSheetId);
  if (serverLogData !== null) {
      logData = serverLogData;
  } else {
      isOnline = false;
      console.log(`Buscando log offline para ${currentSheetId}...`);
      const localLog = await getLocalLogData(currentSheetId);
      if (localLog) {
          logData = localLog;
           console.log("Log carregado do modo offline com sucesso.");
      } else {
          console.log("Nenhum log offline encontrado.");
      }
  }


  return (
    <main className="bg-transparent min-h-screen">
      <div className="w-full px-2 sm:px-4 py-8">
        <SpreadsheetManager 
          initialData={data} 
          initialHeaders={headers} 
          initialError={error}
          initialLogData={logData}
          currentSheetId={currentSheetId}
          isOnline={isOnline}
        />
      </div>
    </main>
  );
}
