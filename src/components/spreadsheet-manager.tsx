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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpreadsheetManagerProps {
  initialData: SheetRow[];
  initialHeaders: string[];
  initialError: string | null;
}

const ROWS_PER_PAGE = 15;
const COLUMN_VISIBILITY_KEY = 'parei-column-visibility';

export const SpreadsheetManager: FC<SpreadsheetManagerProps> = ({
  initialData,
  initialHeaders,
  initialError,
}) => {
  const [allData, setAllData] = useState<SheetRow[]>(initialData);
  const [headers] = useState<string[]>(initialHeaders);
  const [error, setError] = useState<string | null>(initialError);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({
    'ÁREA': [],
    'RESPONSÁVEL': [],
    'ATUALIZADOR 1': [],
  });
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isSaving, startSaving] = useTransition();
  const [isMobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { toast } = useToast();

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
                initialVisibility[header] = parsedVisibility[header] ?? true;
            });
        } catch (e) {
            headers.forEach(header => {
                initialVisibility[header] = true;
            });
        }
    } else {
        headers.forEach(header => {
            initialVisibility[header] = true;
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
    const dataWithCalculations = JSON.parse(JSON.stringify(allData));
    const orderGroups: Record<string, SheetRow[]> = {};

    dataWithCalculations.forEach((row: SheetRow) => {
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

            const summaryRowIndex = dataWithCalculations.findIndex((r: SheetRow) => r.id === summaryRow.id);
            if (summaryRowIndex !== -1) {
                dataWithCalculations[summaryRowIndex] = summaryRow;
            }
        }
    });
    
    return dataWithCalculations;
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
      if (activeFilters['ATUALIZADOR 1'].length > 0 && !activeFilters['ATUALIZADOR 1'].includes(String(row['ATUALIZADOR 1(EMAIL)']))) return false;
      return true;
    });
    return data;
  }, [processedData, searchTerm, activeFilters]);

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
  
  const clearFilters = () => {
    setSearchTerm('');
    setActiveFilters({ 'ÁREA': [], 'RESPONSÁVEL': [], 'ATUALIZADOR 1': [] });
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
      {Object.keys(filterOptions).map(filterName => (
        <div key={filterName}>
          <label className="text-sm font-medium text-muted-foreground">{filterName}</label>
          <Select
            value={activeFilters[filterName]?.[0] || 'all'}
            onValueChange={(value) => handleFilterChange(filterName, value)}
          >
            <SelectTrigger className="w-full mt-1">
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
      <Card>
        <CardHeader>
            <CardTitle>PAREI v1.1</CardTitle>
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
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle className="text-2xl font-bold text-primary">PAREI v1.1</CardTitle>
                <CardDescription>
                    {lastUpdated ? `Última atualização: ${lastUpdated}` : 'Carregando...'}
                </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                    <RotateCw className="mr-2 h-4 w-4" /> Atualizar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar
                </Button>
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
                    className="pl-10 w-full"
                />
            </div>
            <div className="hidden md:flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline"><Columns className="mr-2 h-4 w-4" /> Colunas</Button>
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
                            checked={columnVisibility[header]}
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
                <Button variant="ghost" onClick={clearFilters}><X className="mr-2 h-4 w-4" />Limpar</Button>
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
                                            checked={columnVisibility[header]}
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
        <div className="hidden md:grid md:grid-cols-3 gap-4 mb-4">
            <FilterControls />
        </div>
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
          <div className="h-[60vh] overflow-auto bg-card">
            <Table className="relative min-w-full">
              <TableHeader className="sticky top-0 z-10 bg-secondary">
                <TableRow className="hover:bg-secondary">
                  {visibleHeaders.map(header => (
                    <TableHead key={header} className="whitespace-nowrap bg-inherit border-r">{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? (
                  paginatedData.map(row => (
                    <TableRow 
                      key={row.id}
                      className={cn({
                        'text-destructive font-bold': String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'sim',
                      })}
                    >
                      {visibleHeaders.map(header => {
                        const isSummaryRow = String(row['RESUMO(SIM/NÃO)']).toLowerCase() === 'sim';
                        return (
                          <TableCell key={`${row.id}-${header}`} className="whitespace-nowrap border-r">
                            {header === 'AVANÇO' ? (
                              <div className="flex items-center gap-2">
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
      </CardContent>
    </Card>
  );
};
