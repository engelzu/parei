
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

export interface ChartData {
  area: string;
  'CONCLUÍDO': number;
  'EM ANDAMENTO': number;
  'NÃO INICIADO': number;
}

interface ProgressChartProps {
  data: ChartData[]
}

export const ProgressChart: React.FC<ProgressChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gráfico de Status de Tarefas por Área</CardTitle>
          <CardDescription>
            Não há dados suficientes para exibir o gráfico.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center">
            <p className="text-muted-foreground">Tente limpar os filtros para ver mais resultados.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle>Gráfico de Status de Tarefas por Área</CardTitle>
        <CardDescription>
          Contagem de tarefas por status para cada área de atuação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[70vh] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="area" />
              <YAxis allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--accent) / 0.3)' }}
                formatter={(value: number, name: string) => [value, name]}
              />
              <Legend />
              <Bar dataKey="NÃO INICIADO" stackId="a" fill="#d1d5db" name="Não Iniciado">
                <LabelList dataKey="NÃO INICIADO" position="top" formatter={(value: number) => value > 0 ? value : ''} />
              </Bar>
              <Bar dataKey="EM ANDAMENTO" stackId="a" fill="#3b82f6" name="Em Andamento">
                 <LabelList dataKey="EM ANDAMENTO" position="top" formatter={(value: number) => value > 0 ? value : ''} />
              </Bar>
              <Bar dataKey="CONCLUÍDO" stackId="a" fill="#22c55e" name="Concluído">
                 <LabelList dataKey="CONCLUÍDO" position="top" formatter={(value: number) => value > 0 ? value : ''} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
