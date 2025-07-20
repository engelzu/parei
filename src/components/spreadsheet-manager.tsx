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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { saveDataToSheet } from '@/app/actions';
import type { SheetRow } from '@/lib/types';
import {
  RotateCw,
  Filter,
  X,
  FileSpreadsheet,
  Save,
  Loader2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Search,
} from 'lucide-react';

interface SpreadsheetManagerProps {
  initialData: SheetRow[];
  initialHeaders: string[];
  initialError: string | null;
}

const ROWS_PER_PAGE = 15;

export const SpreadsheetManager: FC<SpreadsheetManagerProps> = ({
  initialData,
  initialHeaders,
  initialError,
}) => {
  const [allData, setAllData] = useState<SheetRow[]>(initialData);
  const [headers, setHeaders] = useState<string[]>(initialHeaders);
  const [error, setError] = useState<string | null>(initialError);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({
    'ÁREA': [],
    'RESPONSÁVEL': [],
    'ATUALIZADOR 1': [],
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isSaving, startSaving] = useTransition();
  const [isMobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setLastUpdated(new Date().toLocaleString('pt-BR'));
  }, [allData]);

  const filterOptions = useMemo(() => {
    const options: Record<string, string[]> = {
      'ÁREA': [],
      'RESPONSÁVEL': [],
      'ATUALIZADOR 1': [],
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
      options['ATUALIZADOR 1'] = Array.from(atualizador1).sort();
    }
    return options;
  }, [allData]);

  const filteredData = useMemo(() => {
    let data = [...allData];
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
  }, [allData, searchTerm, activeFilters]);

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
          const newValue = increment ? Math.min(100, current + 1) : Math.max(0, current - 1);
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
          description: result.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao Salvar",
          description: result.message,
        });
      }
    });
  };
  
  const clearFilters = () => {
    setSearchTerm('');
    setActiveFilters({ 'ÁREA': [], 'RESPONSÁVEL': [], 'ATUALIZADOR 1': [] });
    setCurrentPage(1);
  };

  const exportToCsv = () => {
    const csvContent = [
      headers.join(';'),
      ...filteredData.map(row => 
        headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(';')
      )
    ].join('\r\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'planilha_flex_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <CardTitle>PlanilhaFlex</CardTitle>
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
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-200">PlanilhaFlex</CardTitle>
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
                <Button variant="outline" onClick={exportToCsv}><FileSpreadsheet className="mr-2 h-4 w-4" />Exportar</Button>
                <Button variant="ghost" onClick={clearFilters}><X className="mr-2 h-4 w-4" />Limpar</Button>
            </div>
            <div className="md:hidden">
              <Sheet open={isMobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full"><Filter className="mr-2 h-4 w-4" />Filtros</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader><SheetTitle>Filtros</SheetTitle></SheetHeader>
                  <div className="space-y-4 py-4">
                    <FilterControls inSheet={true} />
                    <Button variant="outline" onClick={exportToCsv} className="w-full"><FileSpreadsheet className="mr-2 h-4 w-4" />Exportar</Button>
                    <Button variant="ghost" onClick={() => { clearFilters(); setMobileFilterOpen(false); }} className="w-full"><X className="mr-2 h-4 w-4" />Limpar Filtros</Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
        </div>
        <div className="hidden md:grid md:grid-cols-3 gap-4 mb-4">
            <FilterControls />
        </div>
        <div className="rounded-md border">
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-secondary">
                <TableRow>
                  {headers.map(header => (
                    <TableHead key={header} className="whitespace-nowrap">{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? (
                  paginatedData.map(row => (
                    <TableRow key={row.id}>
                      {headers.map(header => (
                        <TableCell key={`${row.id}-${header}`} className="whitespace-nowrap max-w-xs truncate">
                          {header === 'AVANÇO' ? (
                            <div className="flex items-center gap-2">
                               <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleAdvanceChange(row.id, false)}><ChevronDown className="h-4 w-4"/></Button>
                               <span className="w-12 text-center font-medium">{row[header] || '0%'}</span>
                               <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleAdvanceChange(row.id, true)}><ChevronUp className="h-4 w-4"/></Button>
                            </div>
                          ) : (
                            row[header] || '-'
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={headers.length} className="h-24 text-center">
                      Nenhum resultado encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
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
