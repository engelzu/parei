'use client';

import { useState, useMemo, useEffect, useTransition, type FC } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
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
import { useToast } from "@/hooks/use-toast";
import { saveDataToSheet } from '@/app/actions';
import type { SheetRow } from '@/lib/types';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressChart, type ChartData } from '@/components/progress-chart';
import { PlannedRealizedChart, type LineChartData } from '@/components/line-chart';

interface SpreadsheetManagerProps {
  initialData: SheetRow[];
  initialHeaders: string[];
  initialError: string | null;
}

const ROWS_PER_PAGE = 15;
const COLUMN_VISIBILITY_KEY = 'parei-column-visibility';


// Function to convert Excel serial number to JavaScript Date
function excelSerialToDate(serial: number) {
    if (typeof serial !== 'number' || isNaN(serial)) {
        return null;
    }
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
    if (isNaN(date.getTime())) {
        return null;
    }
    return date;
}

function parseDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    
    if (typeof value === 'number') {
        return excelSerialToDate(value);
    }
    
    if (typeof value === 'string') {
        // Try parsing dd/mm/yyyy
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

    // Ensure special columns exist
    if (!newHeaders.includes('STATUS')) newHeaders.push('STATUS');
    if (!newHeaders.includes('PREVISTO')) newHeaders.push('PREVISTO');
    if (!newHeaders.includes('DESVIO')) newHeaders.push('DESVIO');
    if (!newHeaders.includes('ID')) newHeaders.push('ID');
    
    // Remove from current positions to re-insert later
    const columnsToMove = ['ID', 'AVANÇO', 'STATUS', 'ORDEM', 'PREVISTO', 'DESVIO'];
    newHeaders = newHeaders.filter(h => !columnsToMove.includes(h));

    // Add columns in the desired order
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
}) => {
  const [allData, setAllData] = useState<SheetRow[]>(initialData);
  const [headers] = useState<string[]>(() => reorderHeaders(initialHeaders));
  const [error, setError] = useState<string | null>(initialError);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({
    'ÁREA': [],
    'RESPONSÁVEL': [],
    'ATUALIZADOR 1': [],
  });
  const [resumoFilter, setResumoFilter] = useState<'all' | 'sim' | 'não'>('all');
  const [caminhoCriticoFilter, setCaminhoCriticoFilter] = useState<'all' | 'sim' | 'não'>('all');
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isSaving, startSaving] = useTransition();
  const [isMobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<'table' | 'bar-chart' | 'line-chart'>('table');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);


  useEffect(() => {
    setLastUpdated(new Date().toLocaleString('pt-BR'));
  }, [allData]);

  useEffect(() => {
    const savedVisibility = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    const initialVisibility: Record<string, boolean> = {};
    if (savedVisibility) {
        try {
            const parsedVisibility = JSON.parse(savedVisibility);
            headers.forEach(header => {
                initialVisibility[header] = parsedVisibility[header] ?? !header.toLowerCase().startsWith('curva');
            });
        } catch (e) {
            headers.forEach(header => {
                const lowerHeader = header.toLowerCase();
                if (['id', 'avanço', 'status', 'ordem'].includes(lowerHeader)) {
                    initialVisibility[header] = true;
                } else {
                    initialVisibility[header] = !lowerHeader.startsWith('curva');
                }
            });
        }
    } else {
        headers.forEach(header => {
            const lowerHeader = header.toLowerCase();
            if (['id', 'avanço', 'status', 'ordem'].includes(lowerHeader)) {
                initialVisibility[header] = true;
            } else {
                initialVisibility[header] = !lowerHeader.startsWith('curva');
            }
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
      'ATUALIZADOR 1': [],
    };
    if (initialData.length > 0) {
      const area = new Set<string>();
      const responsavel = new Set<string>();
      const atualizador1 = new Set<string>();
      initialData.forEach(row => {
        if (row['ÁREA']) area.add(String(row['ÁREA']));
        if (row['RESPONSÁVEL']) responsavel.add(String(row['RESPONSÁVEL']));
        if (row['ATUALIZADOR 1(EMAIL)']) atualizador1.add(String(row['ATUALIZADOR 1(EMAIL)']));
      });
      options['ÁREA'] = Array.from(area).sort();
      options['RESPONSÁVEL'] = Array.from(responsavel).sort();
      options['ATUALIZADOR 1'] = Array.from(atualizador1).sort();
    }
    return options;
  }, [initialData]);

  const processedData = useMemo(() => {
    let dataToProcess = JSON.parse(JSON.stringify(allData));
    const orderGroups: Record<string, SheetRow[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    dataToProcess.forEach((row: SheetRow) => {
      // Add ID column
      row['ID'] = row['id'];

      // Calculate PREVISTO and DESVIO
      const startDate = parseDate(row['INÍCIO DA LINHA DE BASE']);
      const endDate = parseDate(row['TÉRMINO DA LINHA DE BASE']);
      
      let previsto = 0;
      if (startDate && endDate && String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não') {
        if (today.getTime() >= endDate.getTime()) {
          previsto = 100;
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

      // Calculate STATUS
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
    // Search filter
    if (searchTerm) {
      data = data.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    // Column filters
    data = data.filter(row => {
      if (activeFilters['ÁREA'].length > 0 && !activeFilters['ÁREA'].includes(String(row['ÁREA']))) return false;
      if (activeFilters['RESPONSÁVEL'].length > 0 && !activeFilters['RESPONSÁVEL'].includes(String(row['RESPONSÁVEL']))) return false;
      if (activeFilters['ATUALIZADOR 1'].length > 0 && !activeFilters['ATUALIZADOR 1'].includes(String(row['ATUALIZADOR 1(EMAIL)']))) return false;
      return true;
    });

    // Resumo filter
    if (resumoFilter !== 'all') {
      data = data.filter(row => String(row['RESUMO(SIM/NÃO)']).toLowerCase() === resumoFilter);
    }

    // Caminho Crítico filter
    if (caminhoCriticoFilter !== 'all') {
      data = data.filter(row => String(row['CAMINHO CRÍTICO(SIM/NÃO)']).toLowerCase() === caminhoCriticoFilter);
    }

    return data;
  }, [processedData, searchTerm, activeFilters, resumoFilter, caminhoCriticoFilter]);
  
  const progressByUpdater = useMemo(() => {
    const selectedUpdater = activeFilters['ATUALIZADOR 1']?.[0];
    if (!selectedUpdater || selectedUpdater === 'all') return null;

    const updaterTasks = initialData.filter(
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
  }, [activeFilters, initialData]);

  const barChartData = useMemo<ChartData[]>(() => {
    const dataByArea: Record<string, { [key: string]: number, 'CON': number, 'AND': number, 'NI': number }> = {};
    const statusMapping: Record<string, 'CON' | 'AND' | 'NI'> = {
        'CON': 'CON',
        'AND': 'AND',
        'NI': 'NI',
    };

    filteredData.forEach(row => {
      const area = String(row['ÁREA'] || 'N/A');
      if (String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não') {
        if (!dataByArea[area]) {
          dataByArea[area] = { 'CON': 0, 'AND': 0, 'NI': 0 };
        }
        const status = statusMapping[String(row['STATUS'])];
        if (status) {
          dataByArea[area][status]++;
        }
      }
    });

    return Object.keys(dataByArea)
      .map(area => ({
        area,
        'CONCLUÍDO': dataByArea[area]['CON'],
        'EM ANDAMENTO': dataByArea[area]['AND'],
        'NÃO INICIADO': dataByArea[area]['NI'],
      }))
      .sort((a, b) => a.area.localeCompare(b.area));
  }, [filteredData]);


  const lineChartDataByArea = useMemo<Record<string, LineChartData[]>>(() => {
    const dataByArea: Record<string, { totalRealizado: number; totalPrevisto: number; count: number }> = {};

    filteredData.forEach(row => {
        const area = String(row['ÁREA'] || 'N/A');
        if (String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não') {
            const realizado = parseInt(String(row['AVANÇO'] || '0').replace('%', ''), 10);
            const previsto = parseInt(String(row['PREVISTO'] || '0').replace('%', ''), 10);

            if (!dataByArea[area]) {
                dataByArea[area] = { totalRealizado: 0, totalPrevisto: 0, count: 0 };
            }

            if (!isNaN(realizado)) {
                dataByArea[area].totalRealizado += realizado;
            }
            if (!isNaN(previsto)) {
                dataByArea[area].totalPrevisto += previsto;
            }
            if(!isNaN(realizado) || !isNaN(previsto)) {
               dataByArea[area].count++;
            }
        }
    });
    
    const chartData: Record<string, LineChartData[]> = {};
    for (const area in dataByArea) {
      chartData[area] = [{
        name: area,
        realizado: dataByArea[area].count > 0 ? Math.round(dataByArea[area].totalRealizado / dataByArea[area].count) : 0,
        previsto: dataByArea[area].count > 0 ? Math.round(dataByArea[area].totalPrevisto / dataByArea[area].count) : 0,
      }];
    }

    return chartData;
  }, [filteredData]);
  
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
    setAllData(prevData =>
      prevData.map(row => {
        if (row.id === id) {
          const current = parseInt(String(row['AVANÇO'] || '0').replace('%', '')) || 0;
          const newValue = increment ? Math.min(100, current + 5) : Math.max(0, current - 5);
          return { ...row, 'AVANÇO': `${newValue}%` };
        }
        return row;
      })
    );
  };

  const handleOrderClick = (order: string) => {
    if (!order || order === '-') return;
    setSelectedOrder(order);
  };

  const handleSave = () => {
    startSaving(async () => {
      const result = await saveDataToSheet(headers, allData);
      if (result.success) {
        toast({
          title: "Sucesso!",
          description: "Os dados foram salvos na planilha.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao Salvar",
          description: result.message || 'Ocorreu um erro desconhecido ao salvar os dados.',
        });
      }
    });
  };

  const handleExport = async () => {
    const XLSX = await import('xlsx');
    const dataToExport = filteredData.map(row => {
        const newRow: Record<string, any> = {};
        headers.forEach(header => {
            newRow[header] = row[header];
        });
        return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
    XLSX.writeFile(workbook, "dados_exportados.xlsx");
  };
  
  const clearFilters = () => {
    setSearchTerm('');
    setActiveFilters({ 'ÁREA': [], 'RESPONSÁVEL': [], 'ATUALIZADOR 1': [] });
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
              <SelectValue placeholder="Selecionar Tipo" />
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
            <SelectValue placeholder="Selecionar ÁREA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filterOptions['ÁREA'].map(option => (
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
            <SelectValue placeholder="Selecionar RESPONSÁVEL" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filterOptions['RESPONSÁVEL'].map(option => (
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
          value={activeFilters['ATUALIZADOR 1']?.[0] || 'all'}
          onValueChange={(value) => handleFilterChange('ATUALIZADOR 1', value)}
        >
          <SelectTrigger className="w-full mt-1 h-9 rounded-md">
            <SelectValue placeholder="Selecionar ATUALIZADOR 1" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filterOptions['ATUALIZADOR 1'].map(option => (
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

  if (error) {
    return (
      <Card className="border-0 shadow-none sm:border sm:shadow-sm">
        <CardHeader>
            <CardTitle>PAREI v1.1 - GESTOR DE PARADAS INDUSTRIAIS</CardTitle>
        </CardHeader>
        <CardContent>
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro ao Carregar Dados</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
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
              <div className="h-[60vh] overflow-auto">
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
                            'font-bold italic text-primary bg-primary/20': String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'sim',
                          })}
                        >
                          {visibleHeaders.map(header => {
                            const isSummaryRow = String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'sim';
                            let cellContent;

                            if (header === 'INÍCIO DA LINHA DE BASE' || header === 'TÉRMINO DA LINHA DE BASE') {
                                cellContent = formatDateValue(row[header]);
                            } else if (header === 'AVANÇO') {
                                cellContent = (
                                  <div className="flex items-center justify-center gap-0.5">
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-5 w-5" 
                                      onClick={() => handleAdvanceChange(row.id, false)}
                                      disabled={isSummaryRow}
                                    >
                                      <ChevronDown className="h-3 w-3"/>
                                    </Button>
                                    <span className={cn("w-8 text-center font-medium", isSummaryRow && "text-lg font-bold")}>{row[header] || '0%'}</span>
                                    <Button 
                                      size="icon"
                                      variant="ghost" 
                                      className="h-5 w-5" 
                                      onClick={() => handleAdvanceChange(row.id, true)}
                                      disabled={isSummaryRow}
                                    >
                                      <ChevronUp className="h-3 w-3"/>
                                    </Button>
                                  </div>
                                );
                            } else if (header === 'ORDEM') {
                                const orderValue = String(row[header] || '-');
                                cellContent = (
                                  <button
                                    className="text-blue-600 underline disabled:text-muted-foreground disabled:no-underline"
                                    onClick={() => handleOrderClick(orderValue)}
                                    disabled={orderValue === '-'}
                                  >
                                    {orderValue}
                                  </button>
                                );
                            } else if (header === 'DESVIO') {
                                const desvioValue = parseFloat(String(row.DESVIO).replace('%', ''));
                                const colorClass = desvioValue < 0 ? 'text-red-500' : desvioValue > 0 ? 'text-green-500' : 'text-gray-500';
                                cellContent = <span className={cn('font-bold', colorClass)}>{row.DESVIO}</span>;
                            } else if (header === 'STATUS') {
                                const status = String(row.STATUS);
                                const colorClass = status === 'CON' ? 'text-green-500' : status === 'AND' ? 'text-blue-500' : 'text-gray-500';
                                cellContent = <span className={cn('font-bold', colorClass)}>{status}</span>;
                            } else {
                                cellContent = String(row[header] || '-');
                            }

                            return (
                              <TableCell 
                                key={`${row.id}-${header}`} 
                                className={cn("border-r text-center p-1 text-xs", 
                                  header === 'NOME DA TAREFA' ? 'whitespace-normal max-w-[200px]' : 'whitespace-nowrap'
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
      default:
        return null;
    }
  };


  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm bg-transparent">
      <CardHeader>
        <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-2">
                <CardTitle className="text-2xl font-bold text-primary text-center">PAREI v1.1 - GESTOR DE PARADAS INDUSTRIAIS</CardTitle>
                <CardDescription className="text-primary/70 text-sm">
                    {lastUpdated ? `Última atualização: ${lastUpdated}` : 'Carregando...'}
                </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="border-primary/50 uppercase">
                    <RotateCw className="mr-2 h-4 w-4" /> ATUALIZAR
                </Button>
                <div className="flex items-center justify-center p-2 bg-primary text-primary-foreground rounded-md text-sm font-medium uppercase h-9">
                  IDs: {filteredData.length}
                </div>
                 <Button size="sm" onClick={handleSave} disabled={isSaving} className="uppercase">
                    {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    SALVAR
                </Button>
                 <Button variant="outline" size="sm" onClick={() => setCurrentView(currentView === 'table' ? 'bar-chart' : 'table')} className="border-primary/50 uppercase">
                    <BarChart className="mr-2 h-4 w-4" /> {currentView === 'bar-chart' ? 'TABELA' : 'GRÁFICO'}
                </Button>
                 <Button variant="outline" size="sm" onClick={() => setCurrentView(currentView === 'table' ? 'line-chart' : 'table')} className="border-primary/50 uppercase">
                    <LineChartIcon className="mr-2 h-4 w-4" /> {currentView === 'line-chart' ? 'TABELA' : 'CURVA S'}
                </Button>
                <Button size="sm" variant="outline" onClick={handleExport} className="border-primary/50 uppercase">
                    <Download className="mr-2 h-4 w-4" />
                    EXPORTAR
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="border-primary/50 uppercase"><Columns className="mr-2 h-4 w-4" /> Colunas</Button>
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
                <div className="relative w-full max-w-sm sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchTerm('')}>
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
                                    Limpar Filtros
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
                Limpar Filtros
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
