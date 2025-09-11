
'use client';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project, SheetRow } from '@/lib/types';

const DB_NAME = 'PAREI-DB';
const DB_VERSION = 1;
const STORE_SHEET_DATA = 'sheetData';
const STORE_PROJECTS = 'projects';
const STORE_HEADERS = 'headers';
const STORE_LOG_DATA = 'logData';
const STORE_UPDATES_QUEUE = 'updatesQueue';


interface PareiDB extends DBSchema {
  [STORE_SHEET_DATA]: {
    key: string; // sheetId
    value: SheetRow[];
  };
  [STORE_HEADERS]: {
    key: string; // sheetId
    value: string[];
  };
   [STORE_LOG_DATA]: {
    key: string; // sheetId
    value: any[];
  };
  [STORE_PROJECTS]: {
    key: 'all-projects';
    value: Project[];
  };
   [STORE_UPDATES_QUEUE]: {
    key: number; // Auto-incrementing key
    value: {
      sheetId: string;
      row: SheetRow;
      timestamp: number;
    };
    indexes: { 'by-sheetId': string };
  };
}

let dbPromise: Promise<IDBPDatabase<PareiDB>> | null = null;

const getDb = () => {
    if (typeof window === 'undefined') {
        return null;
    }
    if (!dbPromise) {
        dbPromise = openDB<PareiDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_SHEET_DATA)) {
                    db.createObjectStore(STORE_SHEET_DATA);
                }
                if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
                    db.createObjectStore(STORE_PROJECTS);
                }
                if (!db.objectStoreNames.contains(STORE_HEADERS)) {
                    db.createObjectStore(STORE_HEADERS);
                }
                if (!db.objectStoreNames.contains(STORE_LOG_DATA)) {
                    db.createObjectStore(STORE_LOG_DATA);
                }
                if (!db.objectStoreNames.contains(STORE_UPDATES_QUEUE)) {
                    const store = db.createObjectStore(STORE_UPDATES_QUEUE, { autoIncrement: true, keyPath: 'id' });
                    store.createIndex('by-sheetId', 'sheetId');
                }
            },
        });
    }
    return dbPromise;
}


// --- Funções de Dados da Planilha ---
export async function saveSheetData(sheetId: string, data: SheetRow[]) {
  if (!sheetId) return;
  const db = getDb();
  if (!db) return;
  await (await db).put(STORE_SHEET_DATA, data, sheetId);
}

export async function getSheetData(sheetId: string): Promise<SheetRow[] | undefined> {
   if (!sheetId) return undefined;
   const db = getDb();
   if (!db) return undefined;
   return await (await db).get(STORE_SHEET_DATA, sheetId);
}

// --- Funções de Cabeçalhos ---
export async function saveHeaders(sheetId: string, headers: string[]) {
    if (!sheetId) return;
    const db = getDb();
    if (!db) return;
    await (await db).put(STORE_HEADERS, headers, sheetId);
}

export async function getHeaders(sheetId: string): Promise<string[] | undefined> {
    if (!sheetId) return undefined;
    const db = getDb();
    if (!db) return undefined;
    return await (await db).get(STORE_HEADERS, sheetId);
}

// --- Funções de Log ---
export async function saveLogData(sheetId: string, logData: any[]) {
    if (!sheetId) return;
    const db = getDb();
    if (!db) return;
    await (await db).put(STORE_LOG_DATA, logData, sheetId);
}

export async function getLogData(sheetId: string): Promise<any[] | undefined> {
    if (!sheetId) return undefined;
    const db = getDb();
    if (!db) return undefined;
    return await (await db).get(STORE_LOG_DATA, sheetId);
}


// --- Funções de Projetos ---
export async function saveProjects(projects: Project[]) {
    const db = getDb();
    if (!db) return;
    await (await db).put(STORE_PROJECTS, projects, 'all-projects');
}

export async function getProjects(): Promise<Project[] | undefined> {
    const db = getDb();
    if (!db) return undefined;
    return await (await db).get(STORE_PROJECTS, 'all-projects');
}

// --- Funções para a Fila de Atualização (Offline) ---

export async function addRowToUpdateQueue(sheetId: string, row: SheetRow) {
  const db = getDb();
  if (!db) return;
  await (await db).add(STORE_UPDATES_QUEUE, { sheetId, row, timestamp: Date.now() });
}

export async function getQueuedUpdates(): Promise<{ key: number, value: { sheetId: string, row: SheetRow } }[] | undefined> {
    const db = getDb();
    if (!db) return undefined;
    const tx = (await db).transaction(STORE_UPDATES_QUEUE, 'readonly');
    const store = tx.objectStore(STORE_UPDATES_QUEUE);
    const updates: { key: number, value: { sheetId: string, row: SheetRow } }[] = [];
    
    let cursor = await store.openCursor();
    while (cursor) {
        updates.push({ key: cursor.primaryKey, value: cursor.value });
        cursor = await cursor.continue();
    }
    
    await tx.done;
    return updates;
}


export async function removeQueuedUpdate(key: number) {
  const db = getDb();
  if (!db) return;
  await (await db).delete(STORE_UPDATES_QUEUE, key);
}

export async function clearUpdateQueue() {
    const db = getDb();
    if (!db) return;
    const tx = (await db).transaction(STORE_UPDATES_QUEUE, 'readwrite');
    await tx.store.clear();
    await tx.done;
}

