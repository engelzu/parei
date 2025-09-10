
'use server';

import type { SheetRow } from '@/lib/types';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVAMAIp7RbVAzb3YGkIZq8Kr_HBEfFnx1iBa_981c4kb0bdmAJJAEhbHGZBPwwe1Hdpg/exec';

export async function saveDataToSheet(sheetId: string, headers: string[], allData: SheetRow[], updatedRows: SheetRow[]) {
  if (updatedRows.length === 0) {
    return { success: false, message: 'Nenhuma linha para atualizar.' };
  }
   if (!sheetId) {
    return { success: false, message: 'ID da Planilha não fornecido.' };
  }

  try {
    // Para salvamento de múltiplas linhas (botão Salvar)
    // Enviamos apenas as linhas que foram alteradas
    const values = updatedRows.map(row => {
      const rowData: { [key: string]: string } = { id: String(row.id) };
      headers.forEach(header => {
         if (header === 'AVANÇO') {
            rowData[header] = String(row[header] || '0').replace('%', '');
         }
      });
      return rowData;
    });

    const logData = updatedRows.map(row => ({
      'ID': row['id'],
      'AVANÇO': String(row['AVANÇO'] || '0').replace('%', ''),
    }));

    const payload = {
      action: 'saveData', // A Apps Script deve saber como lidar com 'saveData' para múltiplas linhas
      sheetId: sheetId,
      updates: JSON.stringify(values), // Enviando apenas as atualizações
      logData: JSON.stringify(logData)
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
        return { success: false, message: result.error || `Erro no script: ${JSON.stringify(result)}` };
      }
    }

    const errorText = await response.text();
    throw new Error(`Erro do servidor (${response.status}): ${errorText.substring(0, 500)}`);

  } catch (error: any) {
    console.error('Erro detalhado ao salvar na planilha:', error);
    return { success: false, message: error.message };
  }
}

export async function saveSingleRow(sheetId: string, row: SheetRow) {
  if (!row) {
    return { success: false, message: 'Nenhuma linha para salvar.' };
  }
   if (!sheetId) {
    return { success: false, message: 'ID da Planilha não fornecido.' };
  }

  try {
    const logData = [{
      'ID': row['id'],
      'AVANÇO': String(row['AVANÇO'] || '0').replace('%', ''),
    }];

    const payload = {
      action: 'updateRow',
      sheetId: sheetId,
      rowId: row.id,
      rowAdvance: String(row['AVANÇO'] || '0').replace('%', ''),
      logData: JSON.stringify(logData)
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
        return { success: true, message: result.message || 'Linha atualizada com sucesso!' };
      } else {
        console.error('Erro retornado pelo script (single row):', result);
        return { success: false, message: result.error || 'Erro retornado pelo script.' };
      }
    }
    
    const errorText = await response.text();
    console.error(`Erro do servidor (${response.status}) ao salvar linha única:`, errorText);
    throw new Error(`Erro do servidor (${response.status}): ${errorText.substring(0, 500)}`);

  } catch (error: any) {
    console.error('Erro detalhado ao salvar linha única:', error);
    return { success: false, message: `Falha na comunicação com o servidor: ${error.message}` };
  }
}
