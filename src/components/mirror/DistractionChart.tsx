import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DistractionChartProps {
  focusMs: number;
  idleMs: number;
  distractionMs: number;
}

// DESIGN #4: Custom center label inside donut
const CenterLabel = ({
  cx,
  cy,
  focusPct,
}: {
  cx: number;
  cy: number;
  focusPct: number;
}) => {
  const color = focusPct < 40 ? '#FF3B3B' : focusPct < 70 ? '#FF6B35' : '#00D46A';
  return (
    <g>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fill={color}
        fontSize={18}
        fontWeight="bold"
        fontFamily="'JetBrains Mono', monospace"
      >
        {focusPct}%
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fill="#888888"
        fontSize={9}
        fontFamily="'JetBrains Mono', monospace"
        letterSpacing={2}
      >
        FOCUS
      </text>
    </g>
  );
};

export default function DistractionChart({ focusMs, idleMs, distractionMs }: DistractionChartProps) {
  const total = focusMs + idleMs + distractionMs;
  if (total === 0) return null;

  const focusPct = Math.round((focusMs / total) * 100);

  const data = [
    { name: 'Focus', value: focusMs, color: '#00D46A' },
    { name: 'Idle', value: idleMs, color: '#FF6B35' },
    { name: 'Distraction', value: distractionMs, color: '#FF3B3B' },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <h3 className="text-xs font-mono uppercase tracking-widest text-flow-muted mb-4">
        Where Your Time Went
      </h3>

      <div className="flex items-center gap-6">
        {/* Chart with center label */}
        <div className="w-[160px] h-[160px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
                label={({ cx, cy }) => (
                  <CenterLabel cx={cx} cy={cy} focusPct={focusPct} />
                )}
                labelLine={false}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => {
                  const min = Math.round(value / 60000);
                  const pct = Math.round((value / total) * 100);
                  return [`${min} min (${pct}%)`, ''];
                }}
                contentStyle={{
                  background: '#161616',
                  border: '1px solid #2A2A2A',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                itemStyle={{ color: '#FFFFFF' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="space-y-3 flex-1">
          {data.map((item) => {
            const min = Math.round(item.value / 60000);
            const pct = Math.round((item.value / total) * 100);
            return (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-flow-muted">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-medium text-white">{min}m</span>
                  <span className="text-xs text-flow-very-muted ml-1.5">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
