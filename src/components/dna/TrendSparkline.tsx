import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Area,
  AreaChart,
} from 'recharts';

interface TrendSparklineProps {
  data: { date: string; score: number }[];
}

export default function TrendSparkline({ data }: TrendSparklineProps) {
  return (
    <div>
      <h3 className="text-xs font-mono uppercase tracking-widest text-flow-muted mb-4">
        Focus Score Trend
      </h3>

      <div className="card-dashed p-4 h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#00F5FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#444444', fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: '#2A2A2A' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#444444', fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                background: '#161616',
                border: '1px solid #2A2A2A',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono',
              }}
              itemStyle={{ color: '#00F5FF' }}
              formatter={(value: number) => [`${value}`, 'Score']}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#00F5FF"
              strokeWidth={2}
              fill="url(#scoreGradient)"
              dot={{ r: 3, fill: '#00F5FF', stroke: '#0A0A0A', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: '#00F5FF', stroke: '#0A0A0A', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
