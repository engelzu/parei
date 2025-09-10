
'use client';

import { useState, useMemo, useEffect, useTransition, type FC, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as XLSX from 'xlsx';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogTrigger,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { useToast } from "@/hooks/use-toast";
import { saveDataToSheet, saveSingleRow } from '@/app/actions';
import type { SheetRow, Project } from '@/lib/types';
import {
  RotateCw,
  Filter,
  Save,
  Loader2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Search,
  Columns,
  BarChart,
  Download,
  Eraser,
  X,
  LineChart as LineChartIcon,
  TableIcon,
  AreaChart,
  History,
  PlusCircle,
  FileSpreadsheet,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressChart, type ChartData } from '@/components/progress-chart';
import { PlannedRealizedChart, type LineChartData } from '@/components/line-chart';
import { AreaProgressChart, type AreaProgressChartData } from '@/components/area-progress-chart';
import { DailyProgressChart, type DailyProgressChartData } from '@/components/daily-progress-chart';
import { getProjects, saveProjects, getSheetData, getHeaders, getLogData, saveSheetData, saveHeaders, saveLogData, addRowToUpdateQueue, getQueuedUpdates, removeQueuedUpdate } from '@/lib/db';


interface SpreadsheetManagerProps {
  initialData: SheetRow[];
  initialHeaders: string[];
  initialError: string | null;
  initialLogData: any[];
  initialLogDataError: string | null;
  currentSheetId: string;
}

const ROWS_PER_PAGE = 15;
const COLUMN_VISIBILITY_KEY = 'parei-column-visibility';
const PROJECTS_STORAGE_KEY = 'parei-projects-list';

const defaultProjects: Project[] = [
  { name: 'PAREI v1.1 - GESTOR DE PARADAS', id: '1hs8LtsybSCLIsfO-4G-EtZpBrIzf339PeuhdjOU5UeI' },
];

const projectSchema = z.object({
  name: z.string().min(3, { message: "O nome do projeto deve ter pelo menos 3 caracteres." }),
  id: z.string().min(20, { message: "O ID da planilha parece inválido. Verifique o link." }),
});

function excelSerialToDate(serial: number) {
    if (typeof serial !== 'number' || isNaN(serial)) {
        return null;
    }
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const isoDate = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
    if (isNaN(isoDate.getTime())) {
        return null;
    }
    return isoDate;
}

function parseDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    
    if (typeof value === 'number') {
        return excelSerialToDate(value);
    }
    
    if (typeof value === 'string') {
        const parts = value.split('/');
        if (parts.length === 3) {
            const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
            if (!isNaN(date.getTime())) return date;
        }
        // Try parsing ISO string
        const isoDate = new Date(value);
        if (!isNaN(isoDate.getTime())) return isoDate;
    }

    return null;
}

const reorderHeaders = (headers: string[]): string[] => {
    let newHeaders = [...headers];

    if (!newHeaders.includes('STATUS')) newHeaders.push('STATUS');
    if (!newHeaders.includes('PREVISTO')) newHeaders.push('PREVISTO');
    if (!newHeaders.includes('DESVIO')) newHeaders.push('DESVIO');
    if (!newHeaders.includes('ID')) newHeaders.push('ID');
    
    const columnsToMove = ['ID', 'AVANÇO', 'STATUS', 'ORDEM', 'PREVISTO', 'DESVIO'];
    newHeaders = newHeaders.filter(h => !columnsToMove.includes(h));

    newHeaders.unshift('ID', 'AVANÇO', 'STATUS', 'ORDEM');
    
    const terminoPrevistoIndex = newHeaders.indexOf('TÉRMINO PREVISTO');
    if(terminoPrevistoIndex !== -1) {
        newHeaders.splice(terminoPrevistoIndex + 1, 0, 'PREVISTO', 'DESVIO');
    } else {
        newHeaders.push('PREVISTO', 'DESVIO');
    }

    return Array.from(new Set(newHeaders));
};

function formatDateValue(value: any): string {
    const date = parseDate(value);
    if (date) {
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }
    return String(value || '-');
}


export const SpreadsheetManager: FC<SpreadsheetManagerProps> = ({
  initialData,
  initialHeaders,
  initialError,
  initialLogData,
  initialLogDataError,
  currentSheetId,
}) => {
  const [allData, setAllData] = useState<SheetRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [logData, setLogData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(initialError);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({
    'ÁREA': [],
    'RESPONSÁVEL': [],
    'ATUALIZADOR 1(EMAIL)': [],
  });
  const [resumoFilter, setResumoFilter] = useState<'all' | 'sim' | 'não'>('all');
  const [caminhoCriticoFilter, setCaminhoCriticoFilter] = useState<'all' | 'sim' | 'não'>('all');
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isSaving, startSaving] = useTransition();
  const [isMobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<'table' | 'bar-chart' | 'line-chart' | 'area-progress-chart' | 'daily-log-chart'>('table');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [updatedRows, setUpdatedRows] = useState<SheetRow[]>([]);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const router = useRouter();

  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [isAddProjectDialogOpen, setAddProjectDialogOpen] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  
  const [onlineStatus, setOnlineStatus] = useState(true);

  // --- SINCRONIZAÇÃO OFFLINE ---
  const processUpdateQueue = useCallback(async () => {
    if (!navigator.onLine) return;

    const queuedUpdates = await getQueuedUpdates();
    if (!queuedUpdates || queuedUpdates.length === 0) return;

    toast({
      title: 'Sincronizando alterações...',
      description: `Enviando ${queuedUpdates.length} alterações feitas offline.`,
    });

    let successCount = 0;
    for (const update of queuedUpdates) {
      // Apenas sincroniza updates do projeto atual
      if (update.value.sheetId === currentSheetId) {
        const result = await saveSingleRow(update.value.sheetId, update.value.row);
        if (result.success) {
          await removeQueuedUpdate(update.key);
          successCount++;
        }
      }
    }
    
    if (successCount > 0) {
      toast({
        title: 'Sincronização Concluída!',
        description: `${successCount} alterações foram salvas na planilha. Atualizando dados.`,
      });
      // Recarrega a página para garantir que todos os dados estão consistentes
      window.location.reload();
    }
  }, [currentSheetId, toast]);

  useEffect(() => {
    const handleOnline = () => {
      setOnlineStatus(true);
      toast({
        title: 'Você está online!',
        description: 'Conexão com a internet restabelecida.',
      });
      processUpdateQueue();
    };

    const handleOffline = () => {
      setOnlineStatus(false);
      toast({
        title: 'Você está offline!',
        description: 'As alterações serão salvas localmente e sincronizadas depois.',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Sincroniza ao carregar a página, caso haja algo na fila de uma sessão anterior
    if (navigator.onLine) {
        handleOnline();
    } else {
        handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processUpdateQueue, toast]);
  // --- FIM DA SINCRONIZAÇÃO OFFLINE ---


  useEffect(() => {
    async function loadInitialData() {
      setIsLoadingProject(true);
      setError(null);

      // 1. Tenta usar dados do servidor
      if (initialData && initialData.length > 0) {
        setOnlineStatus(true);
        setHeaders(reorderHeaders(initialHeaders));
        setAllData(initialData);
        // Save to IndexedDB on successful fetch
        await saveHeaders(currentSheetId, initialHeaders);
        await saveSheetData(currentSheetId, initialData);
      } else {
        setOnlineStatus(false);
        // 2. Se falhar, tenta carregar do IndexedDB
        console.log(`Buscando dados offline para ${currentSheetId}...`);
        const localHeaders = await getHeaders(currentSheetId);
        const localData = await getSheetData(currentSheetId);

        if (localData && localHeaders) {
          setHeaders(reorderHeaders(localHeaders));
          setAllData(localData);
          toast({
            title: "Modo Offline",
            description: "Exibindo os últimos dados salvos.",
            variant: "default",
            duration: 5000,
          });
        } else {
          setError(initialError || "Falha ao buscar dados e nenhum dado offline disponível.");
          setHeaders([]);
          setAllData([]);
        }
      }

      // Lógica para LogData
      if (initialLogData && initialLogData.length > 0) {
        setLogData(initialLogData);
        await saveLogData(currentSheetId, initialLogData);
      } else {
        const localLog = await getLogData(currentSheetId);
        if (localLog) {
          setLogData(localLog);
        } else {
          setLogData([]);
          if(initialLogDataError) console.error("Erro ao carregar log do servidor e nenhum log offline encontrado.");
        }
      }
      
      setIsLoadingProject(false);
    }
    loadInitialData();
  }, [currentSheetId, initialData, initialHeaders, initialError, initialLogData, initialLogDataError, toast]);
  

  useEffect(() => {
    if (currentSheetId) {
        const currentProjectExists = availableProjects.some(p => p.id === currentSheetId);
        if (!isLoadingProject && currentProjectExists) {
             setIsLoadingProject(false);
        }
    }
  }, [currentSheetId, availableProjects, isLoadingProject]);

  const currentProject = useMemo(() => {
    return availableProjects.find(p => p.id === currentSheetId) || null;
  }, [availableProjects, currentSheetId]);


  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      id: "",
    },
  });

  useEffect(() => {
    const loadProjects = async () => {
        let projects = await getProjects();
        if (!projects || projects.length === 0) {
            try {
                const storedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
                if (storedProjects) {
                    projects = JSON.parse(storedProjects);
                }
            } catch (e) {
                console.error("Failed to parse projects from localStorage", e);
            }
        }
        
        if (!projects || projects.length === 0) {
            projects = defaultProjects;
        }

        setAvailableProjects(projects);
        await saveProjects(projects); 
    };

    loadProjects();
  }, []);

  const handleAddProject = async (values: z.infer<typeof projectSchema>) => {
    const newProject: Project = { name: values.name, id: values.id };
    const updatedProjects = [...availableProjects, newProject];
    setAvailableProjects(updatedProjects);
    await saveProjects(updatedProjects);
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updatedProjects));
    toast({
      title: "Projeto Adicionado!",
      description: `O projeto "${newProject.name}" foi salvo.`,
    });
    form.reset();
    setAddProjectDialogOpen(false);
    handleProjectChange(newProject.id);
  };

  const handleProjectChange = (projectId: string) => {
      if (projectId === currentSheetId) return;
      setIsLoadingProject(true);
      router.push(`/?sheetId=${encodeURIComponent(projectId)}`);
  };

   useEffect(() => {
        setAllData(initialData);
        setSearchTerm('');
        setActiveFilters({ 'ÁREA': [], 'RESPONSÁVEL': [], 'ATUALIZADOR 1(EMAIL)': [] });
        setResumoFilter('all');
        setCaminhoCriticoFilter('all');
        setCurrentPage(1);
        setUpdatedRows([]);
    }, [initialData]);

  
  useEffect(() => {
    setLastUpdated(new Date().toLocaleString('pt-BR'));
  }, [allData]);

  useEffect(() => {
    const savedVisibility = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    const initialVisibility: Record<string, boolean> = {};
    if (savedVisibility && headers.length > 0) {
        try {
            const parsedVisibility = JSON.parse(savedVisibility);
            headers.forEach(header => {
                initialVisibility[header] = parsedVisibility[header] ?? !header.toLowerCase().startsWith('curva');
            });
        } catch (e) {
            headers.forEach(header => {
                initialVisibility[header] = !header.toLowerCase().startsWith('curva');
            });
        }
    } else if (headers.length > 0) {
        headers.forEach(header => {
            initialVisibility[header] = !header.toLowerCase().startsWith('curva');
        });
    }
    setColumnVisibility(initialVisibility);
  }, [headers]);

  useEffect(() => {
    if (Object.keys(columnVisibility).length > 0) {
      localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);

  const visibleHeaders = useMemo(() => {
    return headers.filter(header => columnVisibility[header]);
  }, [headers, columnVisibility]);

  const filterOptions = useMemo(() => {
    const options: Record<string, string[]> = {
      'ÁREA': [],
      'RESPONSÁVEL': [],
      'ATUALIZADOR 1(EMAIL)': [],
    };
    if (allData.length > 0) {
      const area = new Set<string>();
      const responsavel = new Set<string>();
      const atualizador1 = new Set<string>();
      allData.forEach(row => {
        if (row['ÁREA']) area.add(String(row['ÁREA']));
        if (row['RESPONSÁVEL']) responsavel.add(String(row['RESPONSÁVEL']));
        if (row['ATUALIZADOR 1(EMAIL)']) atualizador1.add(String(row['ATUALIZADOR 1(EMAIL)']));
      });
      options['ÁREA'] = Array.from(area).sort();
      options['RESPONSÁVEL'] = Array.from(responsavel).sort();
      options['ATUALIZADOR 1(EMAIL)'] = Array.from(atualizador1).sort();
    }
    return options;
  }, [allData]);

  const processedData = useMemo(() => {
    let dataToProcess = JSON.parse(JSON.stringify(allData));
    const orderGroups: Record<string, SheetRow[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    dataToProcess.forEach((row: SheetRow) => {
      const startDate = parseDate(row['INÍCIO DA LINHA DE BASE']);
      const endDate = parseDate(row['TÉRMINO DA LINHA DE BASE']);
      
      let previsto = 0;
      if (startDate && endDate && String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não') {
        if (today.getTime() >= endDate.getTime()) {
          previsto = 100;
        } else if (today.getTime() < startDate.getTime()){
          previsto = 0;
        } else {
            const totalDuration = endDate.getTime() - startDate.getTime();
            if (totalDuration > 0) {
                const elapsedDuration = today.getTime() - startDate.getTime();
                previsto = Math.max(0, Math.min(100, (elapsedDuration / totalDuration) * 100));
            } else if (today.getTime() >= startDate.getTime()) {
                previsto = 100;
            }
        }

        row['PREVISTO'] = `${Math.round(previsto)}%`;
        
        const avanco = parseFloat(String(row['AVANÇO'] || '0').replace('%', ''));
        const desvio = avanco - previsto;
        row['DESVIO'] = `${Math.round(desvio)}%`;

      } else {
        row['PREVISTO'] = '-';
        row['DESVIO'] = '-';
      }

      const avancoNum = parseFloat(String(row['AVANÇO'] || '0').replace('%', ''));
      if (isFinite(avancoNum)) {
        if (avancoNum === 100) {
          row['STATUS'] = 'CON';
        } else if (avancoNum > 0) {
          row['STATUS'] = 'AND';
        } else {
          row['STATUS'] = 'NI';
        }
      } else {
        row['STATUS'] = 'NI';
      }

      const order = String(row['ORDEM'] || '');
      if (order) {
          if (!orderGroups[order]) {
              orderGroups[order] = [];
          }
          orderGroups[order].push(row);
      }
    });

    Object.values(orderGroups).forEach(group => {
        const summaryRow = group.find(r => String(r['RESUMO(SIM/NÃO)']).toLowerCase() === 'sim');
        const childRows = group.filter(r => String(r['RESUMO(SIM/NÃO)']).toLowerCase() === 'não');

        if (summaryRow && childRows.length > 0) {
            const totalAdvance = childRows.reduce((sum, child) => {
                const advance = parseFloat(String(child['AVANÇO'] || '0').replace('%', '')) || 0;
                return sum + advance;
            }, 0);
            
            const averageAdvance = Math.round(totalAdvance / childRows.length);
            summaryRow['AVANÇO'] = `${averageAdvance}%`;

            const summaryRowIndex = dataToProcess.findIndex((r: SheetRow) => r.id === summaryRow.id);
            if (summaryRowIndex !== -1) {
                dataToProcess[summaryRowIndex] = summaryRow;
            }
        }
    });
    
    return dataToProcess;
  }, [allData]);

  const filteredData = useMemo(() => {
    let data = [...processedData];
    if (searchTerm) {
      data = data.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    data = data.filter(row => {
      if (activeFilters['ÁREA'].length > 0 && !activeFilters['ÁREA'].includes(String(row['ÁREA']))) return false;
      if (activeFilters['RESPONSÁVEL'].length > 0 && !activeFilters['RESPONSÁVEL'].includes(String(row['RESPONSÁVEL']))) return false;
      if (activeFilters['ATUALIZADOR 1(EMAIL)'].length > 0 && !activeFilters['ATUALIZADOR 1(EMAIL)'].includes(String(row['ATUALIZADOR 1(EMAIL)']))) return false;
      return true;
    });

    if (resumoFilter !== 'all') {
      data = data.filter(row => String(row['RESUMO(SIM/NÃO)']).toLowerCase() === resumoFilter);
    }

    if (caminhoCriticoFilter !== 'all') {
      data = data.filter(row => String(row['CAMINHO CRÍTICO(SIM/NÃO)']).toLowerCase() === caminhoCriticoFilter);
    }

    return data;
  }, [processedData, searchTerm, activeFilters, resumoFilter, caminhoCriticoFilter]);
  
  const progressByUpdater = useMemo(() => {
    const selectedUpdater = activeFilters['ATUALIZADOR 1(EMAIL)']?.[0];
    if (!selectedUpdater || selectedUpdater === 'all') return null;

    const updaterTasks = processedData.filter(
      (row) =>
        String(row['ATUALIZADOR 1(EMAIL)']) === selectedUpdater &&
        String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não'
    );
    
    if (updaterTasks.length === 0) return 0;

    const totalAdvance = updaterTasks.reduce((sum, task) => {
      const advance = parseFloat(String(task['AVANÇO'] || '0').replace('%', ''));
      return sum + (isNaN(advance) ? 0 : advance);
    }, 0);

    return Math.round(totalAdvance / updaterTasks.length);
  }, [activeFilters, processedData]);

 const barChartData = useMemo<ChartData[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dataByArea: Record<string, { 'CONCLUÍDO': number, 'EM ANDAMENTO': number, 'NÃO INICIADO': number, 'ATRASADA': number }> = {};

    filteredData.forEach(row => {
        const area = String(row['ÁREA'] || 'N/A');
        if (String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não') {
            if (!dataByArea[area]) {
                dataByArea[area] = { 'CONCLUÍDO': 0, 'EM ANDAMENTO': 0, 'NÃO INICIADO': 0, 'ATRASADA': 0 };
            }

            const avancoNum = parseFloat(String(row['AVANÇO'] || '0').replace('%', ''));
            const startDate = parseDate(row['INÍCIO DA LINHA DE BASE']);
            
            let isDelayed = false;
            if (avancoNum < 100 && startDate && startDate.getTime() < today.getTime()) {
                const previsto = parseFloat(String(row['PREVISTO'] || '0').replace('%',''));
                if(isFinite(previsto) && avancoNum < previsto) {
                    isDelayed = true;
                }
            }

            if (avancoNum === 100) {
                dataByArea[area]['CONCLUÍDO']++;
            } else if (avancoNum > 0) {
                dataByArea[area]['EM ANDAMENTO']++;
                if (isDelayed) {
                    dataByArea[area]['ATRASADA']++;
                }
            } else { 
                dataByArea[area]['NÃO INICIADO']++;
                if (isDelayed) {
                   dataByArea[area]['ATRASADA']++;
                }
            }
        }
    });

    return Object.keys(dataByArea)
      .map(area => ({ area, ...dataByArea[area] }))
      .sort((a, b) => a.area.localeCompare(b.area));
  }, [filteredData]);


  const lineChartDataByArea = useMemo<Record<string, LineChartData[]>>(() => {
    const dataByArea: Record<string, { 
        totalRealizado: number; 
        totalPrevisto: number; 
        count: number;
        endDate: Date | null;
    }> = {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredData.forEach(row => {
        const area = String(row['ÁREA'] || 'N/A');
        if (String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não') {
            const realizado = parseInt(String(row['AVANÇO'] || '0').replace('%', ''), 10);
            const previsto = parseInt(String(row['PREVISTO'] || '0').replace('%', ''), 10);
            const endDate = parseDate(row['TÉRMINO DA LINHA DE BASE']);

            if (!dataByArea[area]) {
                dataByArea[area] = { totalRealizado: 0, totalPrevisto: 0, count: 0, endDate: null };
            }

            if (!isNaN(realizado)) dataByArea[area].totalRealizado += realizado;
            if (!isNaN(previsto)) dataByArea[area].totalPrevisto += previsto;
            if(!isNaN(realizado) || !isNaN(previsto)) dataByArea[area].count++;
            if (endDate && (!dataByArea[area].endDate || endDate > dataByArea[area].endDate!)) {
                dataByArea[area].endDate = endDate;
            }
        }
    });
    
    const chartData: Record<string, LineChartData[]> = {};
    for (const area in dataByArea) {
      const areaData = dataByArea[area];
      const realizado = areaData.count > 0 ? Math.round(areaData.totalRealizado / areaData.count) : 0;
      const previsto = areaData.count > 0 ? Math.round(areaData.totalPrevisto / areaData.count) : 0;
      const gap = realizado - previsto;

      let diasRestantes = 0;
      if (areaData.endDate) {
          const diffTime = areaData.endDate.getTime() - today.getTime();
          diasRestantes = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }

      chartData[area] = [{ name: area, realizado, previsto, gap, diasRestantes }];
    }

    return chartData;
  }, [filteredData]);

  const areaProgressChartData = useMemo<AreaProgressChartData[]>(() => {
    const dataByArea: Record<string, { totalAdvance: number; count: number }> = {};

    filteredData.forEach(row => {
      const area = String(row['ÁREA'] || 'N/A');
      if (String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não') {
        if (!dataByArea[area]) {
          dataByArea[area] = { totalAdvance: 0, count: 0 };
        }
        const advance = parseFloat(String(row['AVANÇO'] || '0').replace('%', ''));
        if (!isNaN(advance)) {
          dataByArea[area].totalAdvance += advance;
          dataByArea[area].count++;
        }
      }
    });

    return Object.keys(dataByArea)
      .map(area => ({
        area,
        'AVANÇO MÉDIO': dataByArea[area].count > 0 ? Math.round(dataByArea[area].totalAdvance / dataByArea[area].count) : 0,
      }))
      .sort((a, b) => a['AVANÇO MÉDIO'] - b['AVANÇO MÉDIO']);
  }, [filteredData]);
  
  const { dailyLogChartData, dailyLogChartKeys } = useMemo(() => {
    if (!logData || logData.length === 0 || allData.length === 0) {
      return { dailyLogChartData: [], dailyLogChartKeys: [] };
    }

    const taskToAeraMap: Record<string, string> = {};
    const allTaskIds = new Set<string>();
    allData.forEach(row => {
      if (String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não' && row.id) {
        const taskId = String(row.id);
        taskToAeraMap[taskId] = String(row['ÁREA'] || 'N/A');
        allTaskIds.add(taskId);
      }
    });
    
    const allAreas = Array.from(new Set(Object.values(taskToAeraMap))).sort();

    const logsByDate: Record<string, { taskId: string; progress: number }[]> = {};
    logData.forEach(log => {
      const taskId = String(log.ID_TAREFA);
      if (taskToAeraMap[taskId]) { 
        try {
          const timestamp = new Date(log.TIMESTAMP);
          if (isNaN(timestamp.getTime())) return;
          
          const dateKey = new Date(timestamp.getUTCFullYear(), timestamp.getUTCMonth(), timestamp.getUTCDate()).toISOString().split('T')[0];
          
          if (!logsByDate[dateKey]) {
            logsByDate[dateKey] = [];
          }
          logsByDate[dateKey].push({
            taskId,
            progress: parseFloat(String(log.AVANCO_PERCENTUAL)),
          });
        } catch (e) { /* ignore malformed logs */ }
      }
    });
    
    const sortedDates = Object.keys(logsByDate).sort();

    if (sortedDates.length === 0) {
      return { dailyLogChartData: [], dailyLogChartKeys: [] };
    }

    const dailyStates: DailyProgressChartData[] = [];
    const currentTaskProgress: Record<string, number> = {};
    allTaskIds.forEach(id => currentTaskProgress[id] = 0);

    for (const dateKey of sortedDates) {
      const todaysLogs = logsByDate[dateKey] || [];
      todaysLogs.forEach(log => {
        if (typeof log.progress === 'number' && !isNaN(log.progress)) {
          currentTaskProgress[log.taskId] = log.progress;
        }
      });

      const progressByArea: Record<string, { total: number; count: number }> = {};
      allAreas.forEach(area => {
        progressByArea[area] = { total: 0, count: 0 };
      });

      allTaskIds.forEach(taskId => {
        const area = taskToAeraMap[taskId];
        if (area) { 
          progressByArea[area].total += currentTaskProgress[taskId] || 0;
          progressByArea[area].count++;
        }
      });
      
      const [year, month, day] = dateKey.split('-');
      const chartEntry: DailyProgressChartData = { date: `${day}/${month}/${year.slice(2)}` };
      
      allAreas.forEach(area => {
        const areaData = progressByArea[area];
        chartEntry[area] = areaData.count > 0 ? Math.round(areaData.total / areaData.count) : 0;
      });

      dailyStates.push(chartEntry);
    }
    
    return { dailyLogChartData: dailyStates, dailyLogChartKeys: allAreas };
}, [logData, allData]);


  const selectedOrderTasks = useMemo(() => {
      if (!selectedOrder) return [];
      return processedData.filter(row => 
          String(row['ORDEM']) === selectedOrder && 
          String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não'
      );
  }, [processedData, selectedOrder]);


  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredData, currentPage]);

  const handleFilterChange = (filterName: string, value: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterName]: value === 'all' ? [] : [value],
    }));
    setCurrentPage(1);
  };
  

  const handleAdvanceChange = (id: number, increment: boolean) => {
    let updatedRow: SheetRow | undefined;
    
    setAllData(currentData => {
        const newData = currentData.map(row => {
            if (row.id === id) {
                const current = parseInt(String(row['AVANÇO'] || '0').replace('%', '')) || 0;
                const newValue = increment ? Math.min(100, current + 5) : Math.max(0, current - 5);
                const newRow = { ...row, 'AVANÇO': `${newValue}%` };
                updatedRow = newRow;
                
                // Adiciona a linha alterada à lista de updatedRows
                setUpdatedRows(prev => {
                    const otherRows = prev.filter(r => r.id !== id);
                    return [...otherRows, newRow];
                });

                return newRow;
            }
            return row;
        });
        return newData;
    });

    if (updatedRow) {
      if (!onlineStatus) {
        addRowToUpdateQueue(currentSheetId, updatedRow);
        toast({
          title: "Salvo Offline",
          description: "A alteração será sincronizada quando houver conexão.",
        });
        return;
      }
      
      setIsAutoSaving(true);
      startSaving(async () => {
          const result = await saveSingleRow(currentSheetId, updatedRow!);
          if (result.success) {
            toast({
              title: "Salvo!",
              description: "Avanço salvo com sucesso.",
              duration: 2000,
            });
            setUpdatedRows(prev => prev.filter(r => r.id !== id));
          } else {
              toast({
                  variant: "destructive",
                  title: "Erro no salvamento automático",
                  description: result.message,
              });
              // Reverte a alteração otimista em caso de erro
              setAllData(prevData => {
                  const revertedData = [...prevData];
                  const index = revertedData.findIndex(r => r.id === id);
                  if (index !== -1) {
                      revertedData[index] = initialData.find(r => r.id === id) || revertedData[index];
                  }
                  return revertedData;
              });
              setUpdatedRows(prev => prev.filter(r => r.id !== id));
          }
           setIsAutoSaving(false);
      });
    }
  };


  const handleOrderClick = (order: string) => {
    if (!order || order === '-') return;
    setSelectedOrder(order);
  };

  const handleManualSave = () => {
    if (!onlineStatus) {
      toast({
        variant: "destructive",
        title: "Você está offline",
        description: "Não é possível salvar tudo. As alterações individuais são salvas na fila para sincronização.",
      });
      return;
    }
     if (updatedRows.length === 0) {
      toast({
        title: "Nenhuma alteração para salvar",
        description: "Modifique o avanço de alguma tarefa para poder salvar.",
      });
      return;
    }
    startSaving(async () => {
        const result = await saveDataToSheet(currentSheetId, headers, allData, updatedRows);
        if (result.success) {
            setUpdatedRows([]); 
            toast({
                title: "Salvo com sucesso!",
                description: "Suas alterações foram gravadas na planilha.",
                duration: 3000,
            });
             window.location.reload();
        } else {
            toast({
                variant: "destructive",
                title: "Erro ao salvar",
                description: result.message || 'Ocorreu um erro desconhecido ao salvar os dados.',
            });
        }
    });
  };

  const handleDownloadTemplate = () => {
    const templateLink = "https://docs.google.com/spreadsheets/d/1GsE_XHA3G3eHt_aAUd9Du5LawIWWn64zUQNTycNCLM4/edit?usp=sharing";
    toast({
      title: "Copiando Template...",
      description: "Faça uma cópia para seu projeto e dê um nome à nova planilha.",
    });
    window.open(templateLink, '_blank');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setActiveFilters({ 'ÁREA': [], 'RESPONSÁVEL': [], 'ATUALIZADOR 1(EMAIL)': [] });
    setResumoFilter('all');
    setCaminhoCriticoFilter('all');
    setCurrentPage(1);
  };
  
  const renderPagination = () => {
    const pageButtons = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pageButtons.push(i);
    } else {
        pageButtons.push(1);
        if (currentPage > 3) pageButtons.push('...');
        
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) pageButtons.push(i);

        if (currentPage < totalPages - 2) pageButtons.push('...');
        pageButtons.push(totalPages);
    }
    
    return pageButtons.map((p, i) => (
        <Button
            key={`page-${i}`}
            variant={currentPage === p ? 'default' : 'outline'}
            size="icon"
            onClick={() => typeof p === 'number' && setCurrentPage(p)}
            disabled={p === '...'}
            className="h-9 w-9"
        >
            {p}
        </Button>
    ));
  };

  const FilterControls = ({ inSheet = false }) => (
    <>
      <div className="flex-1 min-w-[150px] text-center">
          <Label className="text-xs font-medium text-primary">TIPO DE LINHA (RESUMO)</Label>
          <Select
            value={resumoFilter}
            onValueChange={(value) => {
              setResumoFilter(value as 'all' | 'sim' | 'não');
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full mt-1 h-9 rounded-md">
              <SelectValue placeholder="Selecionar tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos (Sim e Não)</SelectItem>
              <SelectItem value="sim" className="focus:bg-accent focus:text-accent-foreground font-bold text-primary">Apenas Resumo (Sim)</SelectItem>
              <SelectItem value="não">Apenas Tarefas (Não)</SelectItem>
            </SelectContent>
          </Select>
      </div>
      <div className="flex-1 min-w-[150px] text-center">
          <Label className="text-xs font-medium text-primary">CAMINHO CRÍTICO</Label>
          <Select
            value={caminhoCriticoFilter}
            onValueChange={(value) => {
              setCaminhoCriticoFilter(value as 'all' | 'sim' | 'não');
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full mt-1 h-9 rounded-md">
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos (Sim e Não)</SelectItem>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="não">Não</SelectItem>
            </SelectContent>
          </Select>
      </div>
      <div className="flex-1 min-w-[150px] text-center">
        <Label className="text-xs font-medium text-primary">ÁREA</Label>
        <Select
          value={activeFilters['ÁREA']?.[0] || 'all'}
          onValueChange={(value) => handleFilterChange('ÁREA', value)}
        >
          <SelectTrigger className="w-full mt-1 h-9 rounded-md">
            <SelectValue placeholder="Selecionar Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filterOptions['ÁREA']?.map(option => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
       <div className="flex-1 min-w-[150px] text-center">
        <Label className="text-xs font-medium text-primary">RESPONSÁVEL</Label>
        <Select
          value={activeFilters['RESPONSÁVEL']?.[0] || 'all'}
          onValueChange={(value) => handleFilterChange('RESPONSÁVEL', value)}
        >
          <SelectTrigger className="w-full mt-1 h-9 rounded-md">
            <SelectValue placeholder="Selecionar Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filterOptions['RESPONSÁVEL']?.map(option => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 min-w-[150px] text-center">
        {progressByUpdater !== null && (
            <div className="text-xs font-bold text-primary mb-1">
                AVANÇO MÉDIO: {progressByUpdater}%
            </div>
        )}
        <Label className="text-xs font-medium text-primary">ATUALIZADOR 1</Label>
        <Select
          value={activeFilters['ATUALIZADOR 1(EMAIL)']?.[0] || 'all'}
          onValueChange={(value) => handleFilterChange('ATUALIZADOR 1(EMAIL)', value)}
        >
          <SelectTrigger className="w-full mt-1 h-9 rounded-md">
            <SelectValue placeholder="Selecionar Atualizador 1" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filterOptions['ATUALIZADOR 1(EMAIL)']?.map(option => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {inSheet && (
          <Button onClick={() => setMobileFilterOpen(false)} className="w-full">Aplicar Filtros</Button>
      )}
    </>
  );

  if (error && allData.length === 0) {
    return (
      <Card className="border-0 shadow-none sm:border sm:shadow-sm">
        <CardHeader>
            <CardTitle>{currentProject?.name || 'PAREI v1.1 - GESTOR DE PARADAS INDUSTRIAIS'}</CardTitle>
        </CardHeader>
        <CardContent>
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar dados</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
             <div className="mt-4">
              <Label className="text-xs font-medium text-primary">Selecionar Projeto</Label>
               <Select onValueChange={handleProjectChange} value={currentSheetId || ''}>
                <SelectTrigger className="w-full mt-1 h-9 rounded-md">
                    <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                    {availableProjects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                        {proj.name}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'table':
        return (
          <>
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <div className="h-[65vh] overflow-auto">
                <Table className="relative min-w-full text-xs">
                  <TableHeader className="sticky top-0 z-10 bg-primary">
                    <TableRow className="border-b-0 hover:bg-primary/90">
                      {visibleHeaders.map(header => (
                        <TableHead key={header} className="whitespace-nowrap border-r text-center text-primary-foreground p-2">{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length > 0 ? (
                      paginatedData.map(row => (
                        <TableRow 
                          key={row.id}
                           className={cn('bg-card', {
                            'font-bold italic text-white bg-green-500 hover:bg-green-500/90': String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'sim',
                          })}
                        >
                          {visibleHeaders.map(header => {
                            const isSummaryRow = String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'sim';
                            let cellContent;

                            if (header === 'INÍCIO DA LINHA DE BASE' || header === 'TÉRMINO DA LINHA DE BASE') {
                                cellContent = formatDateValue(row[header]);
                            } else if (header === 'AVANÇO') {
                                if (isSummaryRow) {
                                    cellContent = (
                                        <span className="text-base font-bold">
                                            {row[header] || '0%'}
                                        </span>
                                    );
                                } else {
                                    cellContent = (
                                      <div className="flex items-center justify-center gap-0.5">
                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-5 w-5" 
                                          onClick={() => handleAdvanceChange(row.id, false)}
                                        >
                                          <ChevronDown className="h-3 w-3"/>
                                        </Button>
                                        <span className="w-8 text-center font-medium">{row[header] || '0%'}</span>
                                        <Button 
                                          size="icon"
                                          variant="ghost" 
                                          className="h-5 w-5" 
                                          onClick={() => handleAdvanceChange(row.id, true)}
                                        >
                                          <ChevronUp className="h-3 w-3"/>
                                        </Button>
                                      </div>
                                    );
                                }
                            } else if (header === 'ORDEM') {
                                const orderValue = String(row[header] || '-');
                                cellContent = (
                                  <Button
                                    className="text-blue-600 underline disabled:text-muted-foreground disabled:no-underline"
                                    onClick={() => handleOrderClick(orderValue)}
                                    disabled={orderValue === '-'}
                                  >
                                    {orderValue}
                                  </Button>
                                );
                            } else if (header === 'DESVIO') {
                                const desvioValue = parseFloat(String(row.DESVIO).replace('%', ''));
                                const colorClass = desvioValue < 0 ? 'text-red-500' : desvioValue > 0 ? 'text-green-500' : 'text-gray-500';
                                cellContent = <span className={cn('font-bold', colorClass)}>{row.DESVIO}</span>;
                            } else if (header === 'STATUS') {
                                const status = String(row.STATUS);
                                let colorClass = '';
                                if (status === 'CON') {
                                  colorClass = 'text-green-500';
                                } else if (status === 'AND') {
                                  colorClass = 'text-blue-500';
                                } else if (status === 'NI') {
                                  colorClass = 'text-red-500';
                                } else {
                                  colorClass = 'text-gray-500';
                                }
                                cellContent = <span className={cn('font-bold', colorClass)}>{status}</span>;
                            } else {
                                cellContent = String(row[header] || '-');
                            }

                            return (
                              <TableCell 
                                key={`${row.id}-${header}`} 
                                className={cn("border-r text-center p-1 text-xs", 
                                  header === 'NOME DA TAREFA' ? 'whitespace-normal max-w-[200px]' : 'whitespace-nowrap',
                                  isSummaryRow && 'text-white'
                                )}
                              >
                                {cellContent}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={visibleHeaders.length} className="h-24 text-center">
                          Nenhum resultado encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <div className="flex items-center justify-between mt-4 flex-wrap gap-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {paginatedData.length > 0 ? (currentPage - 1) * ROWS_PER_PAGE + 1 : 0} a {Math.min(currentPage * ROWS_PER_PAGE, filteredData.length)} de {filteredData.length} registros.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <div className="hidden sm:flex items-center gap-1">{renderPagination()}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        );
      case 'bar-chart':
        return (
            <ScrollArea className="h-[70vh] w-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {barChartData.map(chartItem => (
                  <ProgressChart 
                    key={chartItem.area} 
                    data={[chartItem]} 
                  />
                ))}
              </div>
            </ScrollArea>
        );
      case 'line-chart':
          return (
            <ScrollArea className="h-[70vh] w-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.keys(lineChartDataByArea).sort().map(area => (
                  <PlannedRealizedChart 
                    key={area} 
                    data={lineChartDataByArea[area]} 
                    area={area}
                  />
                ))}
              </div>
            </ScrollArea>
          );
      case 'area-progress-chart':
          return (
            <ScrollArea className="h-[70vh] w-full">
              <div className="p-4">
                <AreaProgressChart data={areaProgressChartData} />
              </div>
            </ScrollArea>
          );
      case 'daily-log-chart':
          return (
            <ScrollArea className="h-[70vh] w-full">
              <div className="p-4">
                <DailyProgressChart data={dailyLogChartData} dataKeys={dailyLogChartKeys} />
              </div>
            </ScrollArea>
          );
      default:
        return null;
    }
  };

  const ViewButtons = () => (
    <>
      <Button 
        variant={currentView === 'table' ? 'default' : 'outline'} 
        size="sm" 
        onClick={() => setCurrentView('table')} 
        className="border-primary/50 uppercase"
      >
          <TableIcon className="mr-2 h-4 w-4" /> TABELA
      </Button>
      <Button 
        variant={currentView === 'bar-chart' ? 'default' : 'outline'}
        size="sm" 
        onClick={() => setCurrentView('bar-chart')} 
        className="border-primary/50 uppercase"
      >
          <BarChart className="mr-2 h-4 w-4" /> GRÁFICO
      </Button>
      <Button 
        variant={currentView === 'line-chart' ? 'default' : 'outline'}
        size="sm" 
        onClick={() => setCurrentView('line-chart')} 
        className="border-primary/50 uppercase"
      >
          <LineChartIcon className="mr-2 h-4 w-4" /> CURVA S
      </Button>
      <Button 
        variant={currentView === 'area-progress-chart' ? 'default' : 'outline'}
        size="sm" onClick={() => setCurrentView('area-progress-chart')} 
        className="border-primary/50 uppercase"
      >
          <AreaChart className="mr-2 h-4 w-4" /> PROGRESSO
      </Button>
      <Button 
        variant={currentView === 'daily-log-chart' ? 'default' : 'outline'}
        size="sm" 
        onClick={() => setCurrentView('daily-log-chart')} 
        className="border-primary/50 uppercase"
      >
          <History className="mr-2 h-4 w-4" /> LOG DIÁRIO
      </Button>
    </>
  );


  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm bg-transparent relative">
      {isLoadingProject && (
        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-50">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-lg font-semibold text-primary">Carregando projeto...</p>
        </div>
      )}
      <CardHeader className="p-4">
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="border-primary/50 uppercase">
                    <RotateCw className="mr-2 h-4 w-4" /> ATUALIZAR
                </Button>
                <div className="flex items-center justify-center p-2 bg-primary text-primary-foreground rounded-md text-sm font-medium uppercase h-9">
                    IDS: {filteredData.length}
                </div>
                 <Button size="sm" onClick={handleManualSave} disabled={isSaving || isAutoSaving} className="uppercase">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isAutoSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isAutoSaving ? 'SALVANDO...' : 'SALVAR'}
                </Button>
                <div className="hidden md:flex flex-wrap items-center gap-2">
                    <ViewButtons />
                </div>
                 <div className="ml-auto flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="border-primary/50 uppercase"><Columns className="mr-2 h-4 w-4" /> COLUNAS</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>Exibir/Ocultar Colunas</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea className="h-72">
                            <div className="p-2">
                            {headers.map((header) => (
                                <DropdownMenuCheckboxItem
                                key={header}
                                className="capitalize"
                                checked={columnVisibility[header] ?? true}
                                onCheckedChange={(value) =>
                                    setColumnVisibility((prev) => ({ ...prev, [header]: !!value }))
                                }
                                onSelect={(e) => e.preventDefault()}
                                >
                                {header}
                                </DropdownMenuCheckboxItem>
                            ))}
                            </div>
                        </ScrollArea>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <div className={cn("hidden sm:flex items-center gap-2 text-sm font-semibold", onlineStatus ? 'text-green-600' : 'text-red-600')}>
                        {onlineStatus ? <Wifi className="h-4 w-4"/> : <WifiOff className="h-4 w-4" />}
                        <span>{onlineStatus ? 'Online' : 'Offline'}</span>
                    </div>
                </div>
            </div>
             <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1">
                     <Select onValueChange={handleProjectChange} value={currentSheetId || ''} disabled={isLoadingProject}>
                        <SelectTrigger className="w-full h-9 rounded-md">
                            <SelectValue placeholder={currentProject?.name || 'Selecione um Projeto'} />
                        </SelectTrigger>
                        <SelectContent>
                            {availableProjects.map((proj) => (
                            <SelectItem key={proj.id} value={proj.id}>
                                {proj.name}
                            </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Dialog open={isAddProjectDialogOpen} onOpenChange={setAddProjectDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="border-primary/50 uppercase h-9">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            ADICIONAR
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Adicionar Novo Projeto</DialogTitle>
                            <DialogDescription>
                                Insira o nome do projeto e o ID da planilha Google Sheets para carregá-lo.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleAddProject)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nome do Projeto</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ex: Manutenção Preventiva 2025" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ID da Planilha Google</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Cole o ID da sua planilha aqui" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="secondary">Cancelar</Button>
                                    </DialogClose>
                                    <Button type="submit">Salvar e Carregar</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
                <Button variant="outline" className="border-primary/50 uppercase h-9" onClick={handleDownloadTemplate}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    TEMPLATE
                </Button>
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -mt-2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Pesquisar em toda a base..."
                        value={searchTerm}
                        onChange={e => {
                        setSearchTerm(e.target.value)
                        setCurrentPage(1)
                        }}
                        className="pl-10 pr-10 w-full h-9 rounded-md bg-card"
                    />
                    {searchTerm && (
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -mt-3.5" onClick={() => setSearchTerm('')}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="md:hidden mb-4">
              <Sheet open={isMobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full"><Filter className="mr-2 h-4 w-4" />Filtros & Colunas</Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader><SheetTitle>Filtros e Colunas</SheetTitle></SheetHeader>
                    <ScrollArea className="h-[calc(100%-80px)]">
                        <div className="space-y-4 p-4">
                            <h3 className="font-semibold">Filtros</h3>
                            <div className="space-y-2">
                                <Button variant="outline" size="sm" onClick={clearFilters} className="w-full border-primary/50 uppercase">
                                    <Eraser className="mr-2 h-4 w-4" />
                                    LIMPAR FILTROS
                                </Button>
                                <FilterControls inSheet={true} />
                            </div>
                            <h3 className="font-semibold pt-4">Colunas Visíveis</h3>
                            <div className="space-y-2">
                                {headers.map((header) => (
                                    <div key={`mobile-${header}`} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`mobile-col-${header}`}
                                            checked={columnVisibility[header] ?? true}
                                            onCheckedChange={(value) =>
                                            setColumnVisibility((prev) => ({ ...prev, [header]: !!value }))
                                            }
                                        />
                                        <Label htmlFor={`mobile-col-${header}`} className="flex-1 cursor-pointer">{header}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ScrollArea>
                </SheetContent>
              </Sheet>
        </div>
        <div className="hidden md:flex flex-wrap items-end gap-4 mb-4 relative">
            <Button variant="outline" size="sm" onClick={clearFilters} className="border-primary/50 uppercase">
                <Eraser className="mr-2 h-4 w-4" />
                LIMPAR FILTROS
            </Button>
            <FilterControls />
        </div>
        {renderContent()}
        
        {selectedOrder && (
            <Dialog open={!!selectedOrder} onOpenChange={(isOpen) => !isOpen && setSelectedOrder(null)}>
                <DialogContent className="sm:max-w-[80vw] lg:max-w-[625px]">
                    <DialogHeader>
                        <DialogTitle>Detalhes da Ordem: {selectedOrder}</DialogTitle>
                        <DialogDescription>
                            Lista de tarefas associadas a esta ordem de serviço.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80%]">Nome da Tarefa</TableHead>

                                    <TableHead className="text-right">Avanço</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedData.filter(row => String(row['ORDEM']) === selectedOrder && String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não').length > 0 ? (
                                    processedData
                                    .filter(row => String(row['ORDEM']) === selectedOrder && String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não')
                                    .map(task => (
                                        <TableRow key={task.id}>
                                            <TableCell className="font-medium whitespace-normal">{String(task['NOME DA TAREFA'])}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-0.5">
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-5 w-5" 
                                                        onClick={() => handleAdvanceChange(task.id, false)}
                                                    >
                                                        <ChevronDown className="h-3 w-3"/>
                                                    </Button>
                                                    <span className="w-8 text-center font-medium">{task['AVANÇO'] || '0%'}</span>
                                                    <Button 
                                                        size="icon"
                                                        variant="ghost" 
                                                        className="h-5 w-5" 
                                                        onClick={() => handleAdvanceChange(task.id, true)}
                                                    >
                                                        <ChevronUp className="h-3 w-3"/>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center">
                                            Nenhuma tarefa de execução encontrada para esta ordem.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        )}
      </CardContent>
    </Card>
  );
};
