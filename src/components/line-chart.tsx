"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';

export interface LineChartData {
  name: string
  previsto: number
  realizado: number
}

interface PlannedRealizedChartProps {
  data: LineChartData[]
  area: string
}

export const PlannedRealizedChart: React.FC<PlannedRealizedChartProps> = ({ data, area }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Curva S - {area}</CardTitle>
          <CardDescription>
            Não há dados suficientes para exibir o gráfico para esta área.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Sem tarefas de execução para esta área.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle>Curva S - {area}</CardTitle>
        <CardDescription>
          Média de avanço previsto e realizado para a área.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
               margin={{
                top: 5,
                right: 50,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" dataKey="value" domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="name" hide={true} />
              <Tooltip
                formatter={(value: number) => `${value}%`}
              />
              <Legend />
              <Bar dataKey="previsto" name="Previsto" fill="hsl(var(--muted-foreground))" />
              <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
