
"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList
} from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';

// This will be populated with the data from the Log sheet
export interface DailyProgressChartData {
  date: string;
  'AVANÇO': number;
}

interface DailyProgressChartProps {
  data: DailyProgressChartData[]
}

export const DailyProgressChart: React.FC<DailyProgressChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
           <div className="flex items-center">
            <CardTitle>Log de Avanço Diário</CardTitle>
          </div>
          <CardDescription>
            Acompanhe a evolução do avanço total ao longo do tempo.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[70vh] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
                <p>Nenhum dado de log encontrado.</p>
                <p className="text-sm mt-2">Assim que as alterações de avanço forem salvas, os dados aparecerão aqui.</p>
                 <p className="text-sm mt-1">Certifique-se de que a aba "LogDiario" foi criada e o Google Apps Script foi atualizado.</p>
            </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="bg-card">
      <CardHeader>
        <div className="flex items-center">
          <CardTitle>Log de Avanço Diário</CardTitle>
        </div>
        <CardDescription>
          Acompanhe a evolução do avanço total ao longo do tempo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[70vh] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis type="number" domain={[0, 100]} unit="%" />
              <Tooltip
                cursor={{ fill: 'hsl(var(--accent) / 0.3)' }}
                formatter={(value: number) => [`${value.toFixed(0)}%`, "Avanço Total"]}
              />
              <Legend />
              <Bar dataKey="AVANÇO" fill="hsl(var(--primary))" name="Avanço Total">
                <LabelList 
                  dataKey="AVANÇO" 
                  position="top" 
                  formatter={(value: number) => `${value}%`}
                  style={{ fill: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
