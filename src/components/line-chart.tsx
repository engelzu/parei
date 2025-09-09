
"use client"

import {
  LineChart,
  Line,
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

export interface LineChartData {
  name: string;
  previsto: number;
  realizado: number;
}

interface PlannedRealizedChartProps {
  data: { name: string; previsto: number; realizado: number }[];
  area: string;
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
  
  // The data for the line chart needs points to connect. 
  // We'll create a synthetic timeline.
  const chartData = [
      { name: 'Início', previsto: 0, realizado: 0 },
      { name: area, previsto: data[0].previsto, realizado: data[0].realizado },
      { name: 'Fim', previsto: 100, realizado: data[0].realizado }, // Assuming 'realizado' is the current progress
  ];


  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle>Curva S - {area}</CardTitle>
        <CardDescription>
          Comparativo de avanço previsto e realizado para a área.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip
                formatter={(value: number) => `${value}%`}
                labelFormatter={(label) => {
                    if (label === 'Início' || label === 'Fim') return label;
                    return `Ponto Atual (${label})`
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="previsto" name="Previsto" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false}>
                 <LabelList 
                    dataKey="previsto" 
                    position="top" 
                    formatter={(value: number) => value > 0 ? `${value}%` : ''} 
                    style={{ fontWeight: 'bold', fill: 'black' }}
                />
              </Line>
              <Line type="monotone" dataKey="realizado" name="Realizado" stroke="hsl(var(--primary))" strokeWidth={2}>
                 <LabelList 
                    dataKey="realizado" 
                    position="top" 
                    formatter={(value: number) => value > 0 ? `${value}%` : ''} 
                    style={{ fontWeight: 'bold', fill: 'black' }}
                 />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
