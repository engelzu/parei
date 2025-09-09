
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

export interface AreaProgressChartData {
  area: string;
  'AVANÇO MÉDIO': number;
}

interface AreaProgressChartProps {
  data: AreaProgressChartData[]
}

export const AreaProgressChart: React.FC<AreaProgressChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Progresso por Área</CardTitle>
          <CardDescription>
            Não há dados de progresso para exibir.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[70vh] flex items-center justify-center">
            <p className="text-muted-foreground">Tente limpar os filtros para ver mais resultados.</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle>Progresso por Área</CardTitle>
        <CardDescription>
          Avanço médio de tarefas por área de atuação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[70vh] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="area" width={120} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--accent) / 0.3)' }}
                formatter={(value: number) => [`${value.toFixed(0)}%`, "Avanço Médio"]}
              />
              <Legend />
              <Bar dataKey="AVANÇO MÉDIO" fill="hsl(var(--primary))" name="Avanço Médio">
                <LabelList 
                  dataKey="AVANÇO MÉDIO" 
                  position="right" 
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
