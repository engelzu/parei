'use server';

import type { SheetRow } from '@/lib/types';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxbJhgsXa2ekMX9ECmcDTJimMecwM9_vhxQqUFFHhjHltFv7mA7GSMoL2sO1pE_inhsmw/exec';
const SHEET_ID = '1hs8LtsybSCLIsfO-4G-EtZpBrIzf339PeuhdjOU5UeI';

export async function saveDataToSheet(headers: string[], allData: SheetRow[]) {
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

    const payload = {
      action: 'saveData',
      sheetId: SHEET_ID,
      values: JSON.stringify(values),
      headers: JSON.stringify(headers)
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams(payload as any).toString(),
      cache: 'no-store',
    });

    // Se o status for 302 (redirecionamento) ou 200, geralmente significa sucesso no Apps Script.
    if (response.status === 302 || response.status === 200) {
        try {
            const result = await response.json();
             if (result.status === 'success') {
                return { success: true, message: result.message || 'Dados salvos com sucesso!' };
             } else {
                return { success: false, message: result.message || 'Erro retornado pelo script.' };
             }
        } catch (e) {
            // Se a resposta não for JSON, mas o status for OK, consideramos sucesso.
            // Isso acontece porque o Apps Script pode retornar HTML em um redirecionamento.
            return { success: true, message: 'Operação concluída com sucesso!' };
        }
    }
    
    // Se a resposta não for OK e não for um redirecionamento, tratamos como erro.
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
