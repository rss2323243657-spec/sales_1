import React, { useState } from 'react';
import { LineChart, BarChart2, TrendingUp, Calendar, Sparkles, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AggregatedRow, FilterState } from '../types/sales';

interface SalesTrendChartProps {
  data: AggregatedRow[];
  granularity: FilterState['timeGranularity'];
  activeMetric: FilterState['primaryMetric'];
  onMetricChange: (metric: FilterState['primaryMetric']) => void;
  showAiAutoAnalysis?: boolean;
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  data,
  granularity,
  activeMetric,
  onMetricChange,
  showAiAutoAnalysis = true,
}) => {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 mb-6">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
        <p className="text-xs">暂无当前时间范围内的销售趋势数据，请调整时间筛选或导入订单</p>
      </div>
    );
  }

  const metricLabels: Record<FilterState['primaryMetric'], { name: string; unit: string; isCurrency: boolean }> = {
    finalSales: { name: '最终销售额', unit: '$', isCurrency: true },
    salesQuantity: { name: '销售量', unit: '件', isCurrency: false },
    salesCost: { name: '销售成本', unit: '$', isCurrency: true },
    basicGrossProfit: { name: '基础毛利', unit: '$', isCurrency: true },
    basicGrossMargin: { name: '基础毛利率', unit: '%', isCurrency: false },
    averageSellingPrice: { name: '平均售价 (ASP)', unit: '$', isCurrency: true },
  };

  const currentMetricConfig = metricLabels[activeMetric];

  const getVal = (item: AggregatedRow) => {
    switch (activeMetric) {
      case 'finalSales':
        return item.finalSales;
      case 'salesQuantity':
        return item.salesQuantity;
      case 'salesCost':
        return item.salesCost;
      case 'basicGrossProfit':
        return item.basicGrossProfit;
      case 'basicGrossMargin':
        return item.basicGrossMargin * 100;
      case 'averageSellingPrice':
        return item.averageSellingPrice;
      default:
        return item.finalSales;
    }
  };

  const values = data.map((d) => getVal(d));
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);

  // SVG dimensions
  const svgWidth = 840;
  const svgHeight = 240;
  const paddingLeft = 65;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 45;

  const chartInnerWidth = svgWidth - paddingLeft - paddingRight;
  const chartInnerHeight = svgHeight - paddingTop - paddingBottom;

  const getY = (val: number) => {
    if (maxVal === minVal) return paddingTop + chartInnerHeight / 2;
    const ratio = (val - minVal) / (maxVal - minVal);
    return paddingTop + chartInnerHeight - ratio * chartInnerHeight;
  };

  const getX = (idx: number) => {
    if (data.length === 1) return paddingLeft + chartInnerWidth / 2;
    return paddingLeft + (idx / (data.length - 1)) * chartInnerWidth;
  };

  const points = data.map((d, i) => `${getX(i)},${getY(getVal(d))}`).join(' ');

  const formatValue = (v: number) => {
    if (currentMetricConfig.isCurrency) {
      return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (activeMetric === 'basicGrossMargin') {
      return `${v.toFixed(2)}%`;
    }
    return v.toLocaleString();
  };

  // Real-time Automated Trend AI Diagnosis
  const latestItem = data[data.length - 1];
  const previousItem = data.length > 1 ? data[data.length - 2] : null;
  const momGrowth = previousItem && previousItem.finalSales > 0
    ? (latestItem.finalSales - previousItem.finalSales) / previousItem.finalSales
    : null;
  const momQtyGrowth = previousItem && previousItem.salesQuantity > 0
    ? (latestItem.salesQuantity - previousItem.salesQuantity) / previousItem.salesQuantity
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs mb-6">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-150">
        <div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">
              销售周期走势 ({currentMetricConfig.name})
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium border border-blue-200">
              {data.length} 个时间周期
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            时间轴清晰标注起始与截止范围 · 严禁模糊代码标注
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Metric Selector Buttons */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
            <button
              onClick={() => onMetricChange('finalSales')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                activeMetric === 'finalSales' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              销售额
            </button>
            <button
              onClick={() => onMetricChange('salesQuantity')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                activeMetric === 'salesQuantity' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              销量
            </button>
            <button
              onClick={() => onMetricChange('basicGrossProfit')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                activeMetric === 'basicGrossProfit' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              毛利
            </button>
            <button
              onClick={() => onMetricChange('averageSellingPrice')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                activeMetric === 'averageSellingPrice' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              平均售价 ASP
            </button>
          </div>

          {/* Line / Bar Switch */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
            <button
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded cursor-pointer ${
                chartType === 'line' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
              }`}
              title="折线图"
            >
              <LineChart className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded cursor-pointer ${
                chartType === 'bar' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
              }`}
              title="柱状图"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-56 min-w-[620px] overflow-visible select-none"
        >
          {/* Y Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const y = paddingTop + chartInnerHeight * (1 - r);
            const gridVal = minVal + (maxVal - minVal) * r;
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  strokeWidth="0.8"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono"
                >
                  {currentMetricConfig.isCurrency
                    ? `$${Math.round(gridVal).toLocaleString()}`
                    : Math.round(gridVal).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {chartType === 'line' && data.length > 1 && (
            <polygon
              points={`${points} ${getX(data.length - 1)},${paddingTop + chartInnerHeight} ${getX(0)},${paddingTop + chartInnerHeight}`}
              fill="url(#trendLightGradient)"
              opacity="0.25"
            />
          )}

          {/* Line Path */}
          {chartType === 'line' && data.length > 1 && (
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          )}

          {/* Bars / Points */}
          {data.map((d, i) => {
            const val = getVal(d);
            const cx = getX(i);
            const cy = getY(val);
            const isHovered = hoveredIdx === i;

            if (chartType === 'bar') {
              const barWidth = Math.max(12, Math.min(36, chartInnerWidth / data.length - 8));
              const barHeight = Math.max(2, paddingTop + chartInnerHeight - cy);
              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={cx - barWidth / 2}
                    y={cy}
                    width={barWidth}
                    height={barHeight}
                    rx="3"
                    fill={isHovered ? '#1d4ed8' : '#3b82f6'}
                    className="transition-colors"
                  />
                </g>
              );
            }

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 4}
                  fill="#ffffff"
                  stroke={isHovered ? '#1d4ed8' : '#2563eb'}
                  strokeWidth={isHovered ? '2.5' : '2'}
                  className="transition-all"
                />
              </g>
            );
          })}

          {/* X Axis Human-Readable Labels */}
          {data.map((d, i) => {
            const step = Math.ceil(data.length / 7);
            const show = i % step === 0 || i === data.length - 1;
            if (!show) return null;

            return (
              <text
                key={i}
                x={getX(i)}
                y={svgHeight - 12}
                textAnchor="middle"
                className="text-[10px] fill-slate-600 font-medium"
              >
                {d.label}
              </text>
            );
          })}

          <defs>
            <linearGradient id="trendLightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Hover Tooltip */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="absolute top-2 right-4 bg-white/95 border border-slate-300 rounded-lg p-3 shadow-lg text-xs pointer-events-none z-20 min-w-[210px]">
            <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-1.5 flex items-center justify-between">
              <span>{data[hoveredIdx].label}</span>
              <span className="text-[10px] text-slate-500 font-mono">订单: {data[hoveredIdx].orderCount}</span>
            </div>
            <div className="flex items-center justify-between text-slate-700 mb-1">
              <span>{currentMetricConfig.name}:</span>
              <span className="font-mono font-bold text-blue-700">{formatValue(getVal(data[hoveredIdx]))}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <span>最终销量:</span>
              <span className="font-mono">{data[hoveredIdx].salesQuantity} 件</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <span>最终销售额:</span>
              <span className="font-mono">${data[hoveredIdx].finalSales.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <span>基础毛利:</span>
              <span className="font-mono text-emerald-600">${data[hoveredIdx].basicGrossProfit.toFixed(2)}</span>
            </div>
            {data[hoveredIdx].growthMoM !== null && data[hoveredIdx].growthMoM !== undefined && (
              <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                <span>环比变化:</span>
                <span
                  className={`font-mono font-semibold ${
                    (data[hoveredIdx].growthMoM || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {(data[hoveredIdx].growthMoM || 0) >= 0 ? '+' : ''}
                  {((data[hoveredIdx].growthMoM || 0) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Automated AI Real-Time Insights & Warning Banner */}
      {showAiAutoAnalysis && latestItem && (
        <div className="mt-4 pt-3 border-t border-slate-150 bg-slate-50/70 p-3.5 rounded-lg text-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>当前趋势区间全自动 AI 诊断与异动预警</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              最新基准周期: {latestItem.label}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-2.5 rounded bg-white border border-slate-200">
              <div className="text-[11px] text-slate-500">最新周期销售业绩</div>
              <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                ${latestItem.finalSales.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-600 mt-1 flex items-center space-x-1">
                <span>销量: {latestItem.salesQuantity} 件 · 毛利:</span>
                <span className="text-emerald-700 font-semibold font-mono">
                  {(latestItem.basicGrossMargin * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-white border border-slate-200">
              <div className="text-[11px] text-slate-500">环比变化驱动解析</div>
              <div className="text-sm font-bold font-mono mt-0.5 flex items-center space-x-1">
                {momGrowth !== null ? (
                  <span className={momGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {momGrowth >= 0 ? '+' : ''}{(momGrowth * 100).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-slate-400">基期无数据</span>
                )}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                {momGrowth !== null && momQtyGrowth !== null ? (
                  momQtyGrowth > 0 && momGrowth < 0 ? (
                    <span className="text-amber-700 font-medium">⚠️ 量增额跌 (促销降价侵蚀ASP)</span>
                  ) : momQtyGrowth < 0 && momGrowth > 0 ? (
                    <span className="text-blue-700 font-medium">📈 量跌额增 (高客单款拉升)</span>
                  ) : momGrowth >= 0 ? (
                    <span className="text-emerald-700 font-medium">✅ 量额同增 (动销良性健康)</span>
                  ) : (
                    <span className="text-rose-700 font-medium">🔻 销量收缩驱动整体下滑</span>
                  )
                ) : (
                  <span>单周期基准运行中</span>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded bg-white border border-slate-200">
              <div className="text-[11px] text-slate-500">下一步运营求证重点</div>
              <p className="text-[11px] text-slate-700 mt-0.5 leading-relaxed">
                当前系统已纠偏订购/发货差额。若发生业绩下滑，需在后台交叉印证 <strong>WFS 可用库存周转天数</strong> 与 <strong>Buy Box 胜率</strong>，严禁在无流量数据前断言广告失效。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
