'use client';

import { useState, useMemo, useEffect, useTransition, type FC } from 'react';
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
  X,
  Save,
  Loader2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Search,
  Columns,
  BarChart,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressChart, type ChartData } from '@/components/progress-chart';

interface SpreadsheetManagerProps {
  initialData: SheetRow[];
  initialHeaders: string[];
  initialError: string | null;
}

const ROWS_PER_PAGE = 15;
const COLUMN_VISIBILITY_KEY = 'parei-column-visibility';

const reorderHeaders = (headers: string[]): string[] => {
    const newHeaders = [...headers];
    const avancoIndex = newHeaders.indexOf('AVANÇO');
    const nomeTarefaIndex = newHeaders.indexOf('NOME DA TAREFA');

    if (avancoIndex !== -1 && nomeTarefaIndex !== -1 && avancoIndex !== nomeTarefaIndex + 1) {
        const [avancoHeader] = newHeaders.splice(avancoIndex, 1);
        newHeaders.splice(nomeTarefaIndex + 1, 0, avancoHeader);
    }
    return newHeaders;
};


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
  const [currentView, setCurrentView] = useState<'table' | 'chart'>('table');


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
                initialVisibility[header] = !header.toLowerCase().startsWith('curva');
            });
        }
    } else {
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

    dataToProcess.forEach((row: SheetRow) => {
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
                const advance = parseInt(String(child['AVANÇO'] || '0').replace('%', ''), 10) || 0;
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
  
  const chartData = useMemo<ChartData[]>(() => {
    const dataByArea: Record<string, { total: number; count: number }> = {};

    filteredData.forEach(row => {
      const area = String(row['ÁREA'] || 'N/A');
      if (String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'não') {
        const advance = parseInt(String(row['AVANÇO'] || '0').replace('%', ''), 10);
        if (!dataByArea[area]) {
          dataByArea[area] = { total: 0, count: 0 };
        }
        dataByArea[area].total += advance;
        dataByArea[area].count++;
      }
    });

    return Object.keys(dataByArea)
      .map(area => ({
        area,
        avanco: dataByArea[area].count > 0 ? Math.round(dataByArea[area].total / dataByArea[area].count) : 0,
      }))
      .sort((a, b) => b.avanco - a.avanco);
  }, [filteredData]);

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

  const handleExport = () => {
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
      <div className="flex-1 min-w-[150px]">
          <Label className="text-xs font-medium text-muted-foreground">TIPO DE LINHA (RESUMO)</Label>
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
      <div className="flex-1 min-w-[150px]">
          <Label className="text-xs font-medium text-muted-foreground">CAMINHO CRÍTICO</Label>
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
      {Object.keys(filterOptions).map(filterName => (
        <div key={filterName} className="flex-1 min-w-[150px]">
          <Label className="text-xs font-medium text-muted-foreground">{filterName}</Label>
          <Select
            value={activeFilters[filterName]?.[0] || 'all'}
            onValueChange={(value) => handleFilterChange(filterName, value)}
          >
            <SelectTrigger className="w-full mt-1 h-9 rounded-md">
              <SelectValue placeholder={`Selecionar ${filterName}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {filterOptions[filterName as keyof typeof filterOptions].map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
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

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm bg-transparent">
      <CardHeader>
        <div className="flex flex-col items-center gap-4">
            <div className="text-center">
                <CardTitle className="text-2xl font-bold text-primary">PAREI v1.1 - GESTOR DE PARADAS INDUSTRIAIS</CardTitle>
                <CardDescription className="text-primary/70">
                    {lastUpdated ? `Última atualização com a base de dados: ${lastUpdated}` : 'Carregando...'}
                </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="border-primary/50 uppercase">
                    <RotateCw className="mr-2 h-4 w-4" /> ATUALIZAR
                </Button>
                <div className="flex items-center justify-center p-2 bg-primary text-primary-foreground rounded-md text-sm font-medium uppercase">
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
                <Button variant="outline" size="sm" onClick={() => setCurrentView(currentView === 'table' ? 'chart' : 'table')} className="border-primary/50 uppercase">
                    <BarChart className="mr-2 h-4 w-4" /> {currentView === 'table' ? 'GRÁFICO' : 'TABELA'}
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
                          >
                            {header}
                          </DropdownMenuCheckboxItem>
                        ))}
                        </div>
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-2 mb-4">
            <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Pesquisar em toda a planilha..."
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="pl-10 w-full h-9 rounded-md bg-card"
                />
            </div>
            <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={clearFilters}><X className="mr-2 h-4 w-4" />Limpar</Button>
            </div>
            <div className="md:hidden">
              <Sheet open={isMobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full"><Filter className="mr-2 h-4 w-4" />Filtros & Colunas</Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader><SheetTitle>Filtros e Colunas</SheetTitle></SheetHeader>
                    <ScrollArea className="h-[calc(100%-80px)]">
                        <div className="space-y-4 p-4">
                            <h3 className="font-semibold">Filtros</h3>
                            <FilterControls inSheet={true} />
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
                    <div className="p-4 border-t">
                        <Button variant="ghost" onClick={() => { clearFilters(); setMobileFilterOpen(false); }} className="w-full"><X className="mr-2 h-4 w-4" />Limpar Filtros</Button>
                    </div>
                </SheetContent>
              </Sheet>
            </div>
        </div>
        <div className="hidden md:flex flex-wrap gap-4 mb-4">
            <FilterControls />
        </div>
        {currentView === 'table' ? (
        <>
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
          <div className="h-[60vh] overflow-auto bg-card">
            <Table className="relative min-w-full">
              <TableHeader className="sticky top-0 z-10 bg-primary/10">
                <TableRow className="hover:bg-primary/20">
                  {visibleHeaders.map(header => (
                    <TableHead key={header} className="whitespace-nowrap bg-inherit border-r text-center">{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? (
                  paginatedData.map(row => (
                    <TableRow 
                      key={row.id}
                      className={cn({
                        'text-primary font-bold': String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'sim',
                      })}
                    >
                      {visibleHeaders.map(header => {
                        const isSummaryRow = String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'sim';
                        return (
                          <TableCell key={`${row.id}-${header}`} className="whitespace-nowrap border-r text-center">
                            {header === 'AVANÇO' ? (
                              <div className="flex items-center justify-center gap-2">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7" 
                                  onClick={() => handleAdvanceChange(row.id, false)}
                                  disabled={isSummaryRow}
                                >
                                  <ChevronDown className="h-4 w-4"/>
                                </Button>
                                <span className="w-12 text-center font-medium">{row[header] || '0%'}</span>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7" 
                                  onClick={() => handleAdvanceChange(row.id, true)}
                                  disabled={isSummaryRow}
                                >
                                  <ChevronUp className="h-4 w-4"/>
                                </Button>
                              </div>
                            ) : (
                              String(row[header] || '-')
                            )}
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
        ) : (
          <ProgressChart data={chartData} />
        )}
      </CardContent>
    </Card>
  );
};
