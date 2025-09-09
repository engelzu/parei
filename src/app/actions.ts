
'use server';

import type { SheetRow } from '@/lib/types';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxbJhgsXa2ekMX9ECmcDTJimMecwM9_vhxQqUFFHhjHltFv7mA7GSMoL2sO1pE_inhsmw/exec';
const SHEET_ID = '1hs8LtsybSCLIsfO-4G-EtZpBrIzf339PeuhdjOU5UeI';

export async function saveDataToSheet(headers: string[], allData: SheetRow[], updatedRows: SheetRow[]) {
  if (allData.length === 0 || headers.length === 0) {
    return { success: false, message: 'Nenhum dado para salvar.' };
  }
  
  try {
    const values = allData.map(row => 
      headers.map(header => {
        let value = header === 'AVANÇO' 
          ? String(row[header] || '0').replace('%', '') 
          : row[header] || '';
        return String(value).trim();
      })
    );

    // Prepare only the data needed for the log
    const logData = updatedRows.map(row => ({
      'ID': row['id'],
      'AVANÇO': String(row['AVANÇO'] || '0').replace('%', ''),
    }));

    const payload = {
      action: 'saveData',
      sheetId: SHEET_ID,
      values: JSON.stringify(values),
      headers: JSON.stringify(headers),
      logData: JSON.stringify(logData) // Send log data to the script
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (response.ok) {
        const result = await response.json();
         if (result.status === 'success') {
            return { success: true, message: result.message || 'Dados salvos com sucesso!' };
         } else {
            return { success: false, message: result.error || 'Erro retornado pelo script.' };
         }
    }
    
    const errorText = await response.text();
    try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || errorJson.error || `Erro do servidor: ${response.status}`);
    } catch (e) {
        throw new Error(`Erro do servidor (${response.status}): ${errorText.substring(0, 500)}`);
    }

  } catch (error: any) {
    console.error('Erro detalhado ao salvar na planilha:', error);
    return { success: false, message: error.message };
  }
}
