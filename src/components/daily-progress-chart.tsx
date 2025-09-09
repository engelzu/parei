
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

// This will be populated with the data from the Log sheet
export interface DailyProgressChartData {
  date: string;
  [key: string]: number | string; // Allows for dynamic area keys
}

interface DailyProgressChartProps {
  data: DailyProgressChartData[];
  dataKeys: string[]; // This will be the list of areas, e.g., ['MECÂNICA', 'ELÉTRICA']
}

// Simple hash function to get a color for each area
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}

export const DailyProgressChart: React.FC<DailyProgressChartProps> = ({ data, dataKeys }) => {
  if (!data || data.length === 0 || !dataKeys || dataKeys.length === 0) {
    return (
      <Card>
        <CardHeader>
           <div className="flex items-center">
            <CardTitle>Log de Avanço Diário por Área</CardTitle>
          </div>
          <CardDescription>
            Acompanhe a evolução do avanço médio por área ao longo do tempo.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[70vh] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
                <p>Nenhum dado de log encontrado.</p>
                <p className="text-sm mt-2">Assim que as alterações de avanço forem salvas, os dados aparecerão aqui.</p>
                 <p className="text-sm mt-1">Certifique-se de que a aba "LogDiario" tem dados e o app foi atualizado.</p>
            </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="bg-card">
      <CardHeader>
        <div className="flex items-center">
          <CardTitle>Log de Avanço Diário por Área</CardTitle>
        </div>
        <CardDescription>
          Acompanhe a evolução do avanço médio por área ao longo do tempo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[70vh] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 20, right: 40, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis type="number" domain={[0, 100]} unit="%" />
              <Tooltip
                cursor={{ fill: 'hsl(var(--accent) / 0.3)' }}
                formatter={(value: number, name: string) => [`${value.toFixed(0)}%`, name]}
              />
              <Legend />
              {dataKeys.map(key => (
                <Line 
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={stringToColor(key)}
                  strokeWidth={2}
                  name={key}
                  dot={false}
                >
                    <LabelList 
                        dataKey={key} 
                        position="top" 
                        offset={10}
                        formatter={(value: number) => `${value}%`}
                        style={{ fill: 'hsl(var(--foreground))', fontSize: '12px', fontWeight: 'bold' }}
                    />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
