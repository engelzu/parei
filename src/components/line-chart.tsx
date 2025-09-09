"use client"

import {
  LineChart,
  Line,
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
  area: string
  previsto: number
  realizado: number
}

interface PlannedRealizedChartProps {
  data: LineChartData[]
}

export const PlannedRealizedChart: React.FC<PlannedRealizedChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gráfico Previsto vs. Realizado por Área</CardTitle>
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
        <CardTitle>Curva S - Previsto vs. Realizado por Área</CardTitle>
        <CardDescription>
          Média de avanço previsto e realizado para cada área de atuação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[60vh] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="area" angle={-45} textAnchor="end" height={80} interval={0} />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip
                formatter={(value: number, name: string) => [`${value}%`, name === 'realizado' ? 'Realizado' : 'Previsto']}
              />
              <Legend />
              <Line type="monotone" dataKey="previsto" name="Previsto" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="realizado" name="Realizado" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
