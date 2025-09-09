
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

const CustomizedLabel = (props: any) => {
    const { x, y, width, height, value, index, data, dataKey } = props;
    const chartItem = data[index];
    const total = chartItem['CONCLUÍDO'] + chartItem['EM ANDAMENTO'] + chartItem['NÃO INICIADO'];
    const radius = 10;
    
    const percentage = total > 0 ? value / total : 0;
    
    // Threshold to decide when to render the label outside
    const isTooSmall = percentage < 0.05;

    if (value === 0) {
      return null;
    }

    if (isTooSmall) {
      // Render label outside with a line
      const midAngle = -45; // Angle for the line
      const ex = x + width / 2;
      const ey = y + height / 2;
      const sx = ex + (width / 2 + 5) * Math.cos(midAngle);
      const sy = ey + (height / 2 + 5) * Math.sin(midAngle);
      const mx = ex + (width / 2 + 15) * Math.cos(midAngle);
      const my = ey + (height / 2 + 15) * Math.sin(midAngle);
      const tx = mx + 5 * Math.cos(midAngle);
      const ty = my;
      
      return (
        <g>
          <path d={`M${sx},${sy}L${mx},${my}L${tx},${ty}`} stroke="hsl(var(--foreground))" fill="none" strokeWidth={1}/>
          <circle cx={sx} cy={sy} r={2} fill="hsl(var(--foreground))" stroke="none" />
          <text x={tx + (midAngle > 90 * Math.PI / 180 ? -5 : 5)} y={ty} textAnchor="start" dominantBaseline="middle" fill="hsl(var(--foreground))" style={{ fontWeight: 'bold' }}>
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

  if (!data || data.length === 0 || (chartItem['CONCLUÍDO'] === 0 && chartItem['EM ANDAMENTO'] === 0 && chartItem['NÃO INICIADO'] === 0)) {
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
                <LabelList content={<CustomizedLabel dataKey="NÃO INICIADO" data={data}/>} />
              </Bar>
              <Bar dataKey="EM ANDAMENTO" stackId="a" fill="#3b82f6" name="Em Andamento">
                 <LabelList content={<CustomizedLabel dataKey="EM ANDAMENTO" data={data}/>} />
              </Bar>
              <Bar dataKey="CONCLUÍDO" stackId="a" fill="#22c55e" name="Concluído">
                 <LabelList content={<CustomizedLabel dataKey="CONCLUÍDO" data={data}/>} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
