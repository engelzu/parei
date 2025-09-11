
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
  'ATRASADA': number;
}

interface ProgressChartProps {
  data: ChartData[]
}

const CustomizedLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    
    // Threshold to decide when to render the label outside
    const isTooSmall = width < 20 && value > 0;

    if (value === 0) {
      return null;
    }

    if (isTooSmall) {
      const lineX = x + width / 2;
      const lineY = y + height;
      const lineEndY = y + height + 10;
      const textY = lineEndY + 5;
      
      return (
        <g>
          <line x1={lineX} y1={lineY} x2={lineX} y2={lineEndY} stroke="hsl(var(--foreground))" strokeWidth={1}/>
          <text x={lineX} y={textY} textAnchor="middle" dominantBaseline="middle" fill="hsl(var(--foreground))" style={{ fontWeight: 'bold' }}>
            {`${value}`}
          </text>
        </g>
      );
    }
  
    // Render label inside the bar
    return (
      <text x={x + width / 2} y={y + height / 2} fill="#ffffff" textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 'bold' }}>
        {value}
      </text>
    );
};


export const ProgressChart: React.FC<ProgressChartProps> = ({ data }) => {
  const areaName = data.length > 0 ? data[0].area : 'N/A';

  const chartItem = data[0];

  if (!data || data.length === 0 || (chartItem['CONCLUÍDO'] === 0 && chartItem['EM ANDAMENTO'] === 0 && chartItem['NÃO INICIADO'] === 0 && chartItem['ATRASADA'] === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status de Tarefas - {areaName}</CardTitle>
          <CardDescription>
            Não há dados suficientes para exibir o gráfico para esta área.
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
        <CardTitle>Status de Tarefas - {areaName}</CardTitle>
        <CardDescription>
          Contagem de tarefas por status para a área de atuação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[40vh] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="area" tick={false} axisLine={false} tickLine={false} width={10} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--accent) / 0.3)' }}
                formatter={(value: number, name: string) => [value, name]}
              />
              <Legend />
              <Bar dataKey="NÃO INICIADO" stackId="a" fill="#d1d5db" name="Não Iniciado">
                <LabelList dataKey="NÃO INICIADO" content={<CustomizedLabel data={data}/>} />
              </Bar>
              <Bar dataKey="EM ANDAMENTO" stackId="a" fill="#3b82f6" name="Em Andamento">
                 <LabelList dataKey="EM ANDAMENTO" content={<CustomizedLabel data={data}/>} />
              </Bar>
              <Bar dataKey="CONCLUÍDO" stackId="a" fill="#22c55e" name="Concluído">
                 <LabelList dataKey="CONCLUÍDO" content={<CustomizedLabel data={data}/>} />
              </Bar>
               <Bar dataKey="ATRASADA" stackId="a" fill="#ef4444" name="Atrasada">
                <LabelList dataKey="ATRASADA" content={<CustomizedLabel data={data}/>} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
