
import { SpreadsheetManager } from '@/components/spreadsheet-manager';
import type { SheetRow, Project } from '@/lib/types';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVAMAIp7RbVAzb3YGkIZq8Kr_HBEfFnx1iBa_981c4kb0bdmAJJAEhbHGZBPwwe1Hdpg/exec';

// This is now only a fallback for the very first load or if no ID is provided.
// The primary project list is managed on the client in SpreadsheetManager.
const defaultProjects: Project[] = [
  { name: 'PAREI v1.1 - GESTOR DE PARADAS', id: '1hs8LtsybSCLIsfO-4G-EtZpBrIzf339PeuhdjOU5UeI' },
];

async function getSheetData(sheetId: string) {
  if (!sheetId) {
    return { headers: [], data: [], error: "ID da planilha não fornecido." };
  }
  try {
    const url = `${APPS_SCRIPT_URL}?action=getData&sheetId=${sheetId}`;
    // Use revalidation to avoid hitting the API too often.
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      throw new Error(`Erro de rede: ${response.status} - ${response.statusText}`);
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
    return { headers, data, error: null };
  } catch (error) {
    console.error('Erro ao buscar dados da planilha:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { headers: [], data: [], error: errorMessage };
  }
}

async function getLogData(sheetId: string) {
    if (!sheetId) return [];
    try {
        const url = `${APPS_SCRIPT_URL}?action=getLogData&sheetId=${sheetId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error(`Log fetch error: ${response.status} - ${response.statusText}`);
            return []; // Retorna vazio em caso de erro de rede, mas não quebra a página
        }
        
        const json = await response.json();
        
        if (json.error) {
            console.error('Log fetch error from script:', json.error);
            return []; // Retorna vazio se o script retornar erro
        }

        if (!Array.isArray(json.data) || json.data.length <= 1) {
            return []; // Não há dados de log para processar
        }

        const logHeaders = json.data[0];
        const logData = json.data.slice(1).map((row: any[]) => {
            const rowObj: { [key: string]: any } = {};
            row.forEach((cell, i) => {
                rowObj[logHeaders[i]] = cell;
            });
            return rowObj;
        });

        return logData;
    } catch (error) {
        console.error('Erro ao buscar dados de log:', error);
        return []; // Retorna um array vazio em caso de exceção
    }
}


export default async function Home({ searchParams }: { searchParams?: { [key: string]: string | undefined } }) {
  // The server now only cares about the sheetId from the URL, or the default one.
  // The full list of projects is managed on the client.
  const currentSheetId = searchParams?.sheetId || defaultProjects[0].id;
  
  const { headers, data, error } = await getSheetData(currentSheetId);
  const logData = await getLogData(currentSheetId);

  return (
    <main className="bg-transparent min-h-screen">
      <div className="w-full px-2 sm:px-4 py-8">
        <SpreadsheetManager 
          initialData={data} 
          initialHeaders={headers} 
          initialError={error}
          initialLogData={logData}
          currentSheetId={currentSheetId}
        />
      </div>
    </main>
  );
}
