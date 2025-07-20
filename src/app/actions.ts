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
      cache: 'no-store', // Adicionado para evitar cache
    });

    const textResponse = await response.text();
    let result;

    if (!response.ok) {
        // Se a resposta não for OK, tentamos interpretar a resposta como JSON de erro,
        // mas se falhar, usamos o texto da resposta como a mensagem de erro.
        try {
            result = JSON.parse(textResponse);
            throw new Error(result.message || result.error || `Erro do servidor: ${response.status}`);
        } catch (e) {
            // A resposta não era JSON, então usamos o texto bruto.
            // Isso é útil para capturar erros de HTML ou outras respostas não-JSON do Apps Script.
            throw new Error(`Erro do servidor (${response.status}): ${textResponse.substring(0, 500)}`);
        }
    }
    
    try {
      result = JSON.parse(textResponse);
    } catch (e) {
      // O script pode retornar uma resposta não-JSON ou HTML em caso de sucesso (devido a redirecionamentos).
      // Se a resposta foi 'ok' (status 200), consideramos sucesso.
      return { success: true, message: 'Dados salvos com sucesso!' };
    }

    if (result.status === 'success') {
      return { success: true, message: result.message || 'Dados salvos com sucesso!' };
    } else {
      // Se o JSON retornado indicar um erro.
      throw new Error(result.message || result.error || 'Erro desconhecido ao salvar os dados.');
    }
  } catch (error: any) {
    console.error('Erro detalhado ao salvar na planilha:', error);
    return { success: false, message: error.message };
  }
}
