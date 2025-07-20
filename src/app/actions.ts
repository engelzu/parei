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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload as any).toString(),
      redirect: 'follow',
    });

    const textResponse = await response.text();
    let result;

    try {
      result = JSON.parse(textResponse);
    } catch (e) {
      if (response.ok) {
        // The script might return a non-JSON success message or an HTML page on success.
        return { success: true, message: 'Dados salvos com sucesso!' };
      }
      throw new Error(`Resposta inválida do servidor: ${textResponse.substring(0, 500)}`);
    }

    if (result.status === 'success') {
      return { success: true, message: result.message || 'Dados salvos com sucesso!' };
    } else {
      throw new Error(result.message || 'Erro desconhecido ao salvar os dados.');
    }
  } catch (error: any) {
    console.error('Erro detalhado ao salvar na planilha:', error);
    return { success: false, message: error.message };
  }
}
