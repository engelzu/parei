import { SpreadsheetManager } from '@/components/spreadsheet-manager';
import type { SheetRow } from '@/lib/types';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxbJhgsXa2ekMX9ECmcDTJimMecwM9_vhxQqUFFHhjHltFv7mA7GSMoL2sO1pE_inhsmw/exec';
const SHEET_ID = '1hs8LtsybSCLIsfO-4G-EtZpBrIzf339PeuhdjOU5UeI';

async function getSheetData() {
  try {
    const url = `${APPS_SCRIPT_URL}?action=getData&sheetId=${SHEET_ID}`;
    // Use a short revalidation time to keep data fresh
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


export default async function Home() {
  const { headers, data, error } = await getSheetData();

  return (
    <main className="bg-transparent min-h-screen">
      <div className="w-full px-2 sm:px-4 py-8">
        <SpreadsheetManager initialData={data} initialHeaders={headers} initialError={error} />
      </div>
    </main>
  );
}
