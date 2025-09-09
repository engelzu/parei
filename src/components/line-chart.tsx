
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
  tendencia?: number;
  gap: number;
  diasRestantes: number;
}

interface PlannedRealizedChartProps {
  data: { name: string; previsto: number; realizado: number, gap: number, diasRestantes: number }[];
  area: string;
}


export const PlannedRealizedChart: React.FC<PlannedRealizedChartProps> = ({ data, area }) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Curva S - {area}</CardTitle>
          <CardDescription>
            PREVISTO X REALIZADO
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">Sem tarefas de execução para esta área.</p>
        </CardContent>
      </Card>
    )
  }
  
  const currentData = data[0];
  const { previsto: currentPrevisto, realizado: currentRealizado, gap, diasRestantes } = currentData;
  
  const trendEndValue = currentPrevisto > 0 
    ? (currentRealizado / currentPrevisto) * 100
    : currentRealizado;

  const chartData = [
      { name: 'Início', previsto: 0, realizado: 0, tendencia: 0 },
      { name: area, previsto: currentPrevisto, realizado: currentRealizado, tendencia: currentRealizado },
      { name: 'Fim', previsto: 100, tendencia: trendEndValue > 0 ? trendEndValue : undefined },
  ];

  const dailyProgressNeeded = diasRestantes > 0 ? (100 - currentRealizado) / diasRestantes : 0;


  return (
    <Card className="bg-card relative">
      <CardHeader>
        <CardTitle>Curva S - {area}</CardTitle>
        <CardDescription>
          PREVISTO X REALIZADO
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full relative">
            <div className="absolute top-0 right-0 z-10 p-2">
                <Card className="bg-background/80 backdrop-blur-sm">
                    <CardHeader className="p-3">
                        <CardTitle className="text-sm">Diagnóstico Rápido</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 text-xs">
                        {gap > 0 ? (
                           <p>A área está <span className="font-bold text-green-500">{gap.toFixed(0)}%</span> à frente do previsto.</p>
                        ) : (
                           <p>A área está <span className="font-bold text-red-500">{Math.abs(gap).toFixed(0)}%</span> atrás do previsto.</p>
                        )}
                        {dailyProgressNeeded > 0 && diasRestantes > 0 && (
                            <p className="mt-1">
                                Precisa de <span className="font-bold">{dailyProgressNeeded.toFixed(1)}%</span>/dia por <span className="font-bold">{diasRestantes}</span> dias para atingir a meta.
                            </p>
                        )}
                         {currentRealizado === 100 && (
                            <p className="mt-1 font-bold text-primary">Área concluída!</p>
                        )}
                    </CardContent>
                </Card>
            </div>
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
                formatter={(value: number) => `${value.toFixed(0)}%`}
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
                    formatter={(value: number) => value > 0 ? `${value.toFixed(0)}%` : ''} 
                    style={{ fontWeight: 'bold', fill: 'black' }}
                />
              </Line>
              <Line type="monotone" dataKey="realizado" name="Realizado" stroke="hsl(var(--primary))" strokeWidth={2}>
                 <LabelList 
                    dataKey="realizado" 
                    position="top" 
                    formatter={(value: number) => value > 0 ? `${value.toFixed(0)}%` : ''} 
                    style={{ fontWeight: 'bold', fill: 'black' }}
                 />
              </Line>
               <Line type="monotone" dataKey="tendencia" name="Tendência" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 5">
                 <LabelList 
                    dataKey="tendencia" 
                    position="top" 
                    formatter={(value: number, index: number) => index === 2 && value > 0 ? `${value.toFixed(0)}%` : ''} 
                    style={{ fontWeight: 'bold', fill: 'hsl(var(--destructive))' }}
                 />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
