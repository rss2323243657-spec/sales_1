import React, { useState } from 'react';
import {
  FileCheck2,
  AlertTriangle,
  XCircle,
  Download,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import {
  AdjustmentRecord,
  ExcludedRecord,
  ProcessingLog,
  StandardSalesRecord,
  ProductMappingItem,
} from '../types/sales';
import {
  exportToXLSX,
  exportToCSV,
  formatAdjustmentsForExport,
  formatExcludedForExport,
} from '../services/exporter';

interface DataQualityCenterProps {
  adjustments: AdjustmentRecord[];
  excluded: ExcludedRecord[];
  cleanRecords: StandardSalesRecord[];
  logs: ProcessingLog[];
  onAddProductMapping: (mapping: ProductMappingItem) => void;
}

export const DataQualityCenter: React.FC<DataQualityCenterProps> = ({
  adjustments,
  excluded,
  cleanRecords,
  logs,
  onAddProductMapping,
}) => {
  const [activeTab, setActiveTab] = useState<'adjustments' | 'excluded' | 'unmapped' | 'rules' | 'logs'>('adjustments');
  const [newSkuMapping, setNewSkuMapping] = useState<{ sku: string; spu: string; productType: string }>({
    sku: '',
    spu: '',
    productType: '',
  });
  const [showAddModal, setShowAddModal] = useState(false);

  const totalClean = cleanRecords.length;
  const totalExcluded = excluded.length;
  const cancelledCount = excluded.filter((e) => e.excludeReason.includes('Cancelled')).length;
  const zeroPriceCount = excluded.filter((e) => e.excludeReason.includes('Unit Price = 0')).length;
  const mismatchCount = adjustments.length;

  const unmappedRecords = cleanRecords.filter((r) => r.isUnmapped);
  const unmappedSkuSet = Array.from(new Set(unmappedRecords.map((r) => r.onlineProductSKU)));

  const handleExportAdjustments = (fmt: 'xlsx' | 'csv') => {
    const formatted = formatAdjustmentsForExport(adjustments);
    if (fmt === 'xlsx') exportToXLSX(formatted, '销售额修正明细表_商品数量不等于发货数量', 'Adjustments');
    else exportToCSV(formatted, '销售额修正明细表_商品数量不等于发货数量');
  };

  const handleExportExcluded = (fmt: 'xlsx' | 'csv') => {
    const formatted = formatExcludedForExport(excluded);
    if (fmt === 'xlsx') exportToXLSX(formatted, '被排除订单明细表', 'Excluded');
    else exportToCSV(formatted, '被排除订单明细表');
  };

  const submitNewMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuMapping.sku || !newSkuMapping.spu) return;
    onAddProductMapping({
      SKU: newSkuMapping.sku,
      SPU: newSkuMapping.spu,
      productType: newSkuMapping.productType || 'General Category',
    });
    setNewSkuMapping({ sku: '', spu: '', productType: '' });
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Quality Center Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">有效销售记录数</div>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
            {totalClean.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">已纳入销售核算标准表</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">已排除无效记录数</div>
          <div className="text-xl font-bold text-rose-700 font-mono mt-1">
            {totalExcluded.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Cancelled 或 单价=0</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">Cancelled 排除订单</div>
          <div className="text-xl font-bold text-slate-800 font-mono mt-1">
            {cancelledCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">已彻底剔除出有效大盘</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">单价=0 排除订单</div>
          <div className="text-xl font-bold text-slate-800 font-mono mt-1">
            {zeroPriceCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">非正常Walmart销售排除</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">数量不一致修正订单</div>
          <div className="text-xl font-bold text-amber-700 font-mono mt-1">
            {mismatchCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">按实际发货重算销售额</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium">未匹配销售SKU数</div>
          <div className="text-xl font-bold text-indigo-700 font-mono mt-1">
            {unmappedSkuSet.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">计入总额，未匹配SPU</div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="flex items-center space-x-2 px-4 pt-2 border-b border-slate-200 bg-slate-50 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('adjustments')}
            className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'adjustments'
                ? 'border-amber-500 text-amber-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            销售额修正记录 ({adjustments.length})
          </button>
          <button
            onClick={() => setActiveTab('excluded')}
            className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'excluded'
                ? 'border-rose-500 text-rose-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            被排除订单明细 ({excluded.length})
          </button>
          <button
            onClick={() => setActiveTab('unmapped')}
            className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'unmapped'
                ? 'border-indigo-500 text-indigo-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            未匹配Walmart销售SKU ({unmappedSkuSet.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'rules'
                ? 'border-blue-500 text-blue-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            底层数据清洗与核算规则可视化
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            数据导入与解析日志 ({logs.length})
          </button>
        </div>

        {/* Tab 1: Adjustments Table */}
        {activeTab === 'adjustments' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span>商品SKU数量 ≠ 发货数量 修正记录</span>
                  <span className="text-xs text-amber-700 font-mono">({adjustments.length} 笔订单已校正)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  依据系统铁律：销售额必须以【实际出库发货数量 × 单价】为唯一准绳，杜绝以ERP订购数量虚增销售额。
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleExportAdjustments('xlsx')}
                  className="px-2.5 py-1 rounded bg-slate-100 text-xs text-slate-700 border border-slate-250 hover:bg-slate-200 cursor-pointer font-medium"
                >
                  导出修正记录 (.xlsx)
                </button>
                <button
                  onClick={() => handleExportAdjustments('csv')}
                  className="px-2.5 py-1 rounded bg-slate-100 text-xs text-slate-700 border border-slate-250 hover:bg-slate-200 cursor-pointer font-medium"
                >
                  导出 (.csv)
                </button>
              </div>
            </div>

            {adjustments.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                暂无数量不一致订单，所有有效订单订购数量均等于实际发货数量。
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">订单号</th>
                      <th className="py-2.5 px-3 font-semibold">下单时间</th>
                      <th className="py-2.5 px-3 text-blue-700 font-bold">Walmart销售SKU</th>
                      <th className="py-2.5 px-3 text-amber-700 font-semibold">内部SKU (对照)</th>
                      <th className="py-2.5 px-3 text-right font-semibold">订购数量</th>
                      <th className="py-2.5 px-3 text-right text-emerald-700 font-bold">发货数量</th>
                      <th className="py-2.5 px-3 text-right font-semibold">单价</th>
                      <th className="py-2.5 px-3 text-right text-slate-400 font-semibold">订购原始金额</th>
                      <th className="py-2.5 px-3 text-right text-slate-900 font-bold">最终核算销售额</th>
                      <th className="py-2.5 px-3 text-right text-rose-700 font-bold">核算差额</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {adjustments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-800">{a.orderId}</td>
                        <td className="py-2 px-3 text-slate-500 font-sans">{a.orderTime}</td>
                        <td className="py-2 px-3 text-blue-700 font-semibold">{a.onlineProductSKU}</td>
                        <td className="py-2 px-3 text-amber-700">{a.internalSKU}</td>
                        <td className="py-2 px-3 text-right text-slate-500">{a.orderedQuantity}</td>
                        <td className="py-2 px-3 text-right text-emerald-700 font-bold">{a.shippedQuantity}</td>
                        <td className="py-2 px-3 text-right">${a.unitPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-400 line-through">
                          ${a.rawCalculatedAmount.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-900 font-bold">
                          ${a.finalSales.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-700 font-semibold">
                          {a.diffAmount >= 0 ? '+' : ''}
                          ${a.diffAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Excluded Orders */}
        {activeTab === 'excluded' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span>被排除订单明细</span>
                  <span className="text-xs text-rose-700 font-mono">({excluded.length} 笔)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  原始记录完好保留，严格隔离于有效销售统计之外。
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleExportExcluded('xlsx')}
                  className="px-2.5 py-1 rounded bg-slate-100 text-xs text-slate-700 border border-slate-250 hover:bg-slate-200 cursor-pointer font-medium"
                >
                  导出排除明细 (.xlsx)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">订单号</th>
                    <th className="py-2.5 px-3 font-semibold">下单时间</th>
                    <th className="py-2.5 px-3 text-blue-700 font-bold">Walmart销售SKU</th>
                    <th className="py-2.5 px-3 text-amber-700">内部SKU</th>
                    <th className="py-2.5 px-3 font-semibold">平台状态</th>
                    <th className="py-2.5 px-3 text-right font-semibold">单价</th>
                    <th className="py-2.5 px-3 text-right font-semibold">订购</th>
                    <th className="py-2.5 px-3 text-right font-semibold">发货</th>
                    <th className="py-2.5 px-3 text-rose-700 font-semibold font-sans">排除原因</th>
                    <th className="py-2.5 px-3 font-semibold font-sans">来源Sheet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {excluded.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-800">{e.orderId}</td>
                      <td className="py-2 px-3 text-slate-500 font-sans">{e.orderTime}</td>
                      <td className="py-2 px-3 text-blue-700">{e.onlineProductSKU}</td>
                      <td className="py-2 px-3 text-amber-700">{e.internalSKU}</td>
                      <td className="py-2 px-3 text-slate-700">{e.platformStatus}</td>
                      <td className="py-2 px-3 text-right">${e.unitPrice}</td>
                      <td className="py-2 px-3 text-right">{e.orderedQuantity}</td>
                      <td className="py-2 px-3 text-right">{e.shippedQuantity}</td>
                      <td className="py-2 px-3 font-sans text-rose-700 font-medium">{e.excludeReason}</td>
                      <td className="py-2 px-3 text-slate-500 font-sans">{e.sheetSource || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Unmapped SKU list */}
        {activeTab === 'unmapped' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  未匹配产品映射表的 Walmart 销售SKU ({unmappedSkuSet.length} 个)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  注意：未匹配SKU的销售额与销量仍 100% 纳入全店大盘统计，但无法聚类至 SPU 和产品类型。可快速补充映射！
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>手动补充映射</span>
              </button>
            </div>

            {unmappedSkuSet.length === 0 ? (
              <div className="text-center py-12 text-emerald-700 text-xs flex flex-col items-center justify-center space-y-2">
                <CheckCircle2 className="w-8 h-8 opacity-90 text-emerald-600" />
                <span className="font-semibold">当前所有在售 SKU 均已成功匹配至 SPU 及产品类型！</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unmappedSkuSet.map((sku) => {
                  const recordsForSku = unmappedRecords.filter((r) => r.onlineProductSKU === sku);
                  const sales = recordsForSku.reduce((a, b) => a + b.finalSales, 0);
                  const qty = recordsForSku.reduce((a, b) => a + b.salesQuantity, 0);

                  return (
                    <div
                      key={sku}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-mono font-bold text-blue-700 text-xs">{sku}</div>
                        <div className="text-[11px] text-slate-600 mt-1">
                          销售额: <span className="font-mono font-bold text-slate-900">${sales.toFixed(2)}</span> · 销量:{' '}
                          <span className="font-mono">{qty}</span> 件
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setNewSkuMapping({ sku, spu: '', productType: '' });
                          setShowAddModal(true);
                        }}
                        className="px-2.5 py-1 text-xs rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-semibold cursor-pointer"
                      >
                        映射
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Rules Visual Architecture */}
        {activeTab === 'rules' && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">系统底层固定销售统计与清洗规则</h3>
              <p className="text-xs text-slate-500 mt-1">
                任何 Dashboard、图表、排行、AI分析及导出结果均 100% 遵循本套透明、可追溯的标准数据链路：
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-blue-700 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-center leading-5 text-[11px]">1</span>
                  <span>双 SKU 严格区分原则</span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  • <strong>线上商品SKU (onlineProductSKU)</strong>: Walmart平台实际销售SKU，全店销售分析与产品映射的主键。<br />
                  • <strong>SKU (internalSKU)</strong>: 公司内部产品编码，仅作为ERP识别、追踪与核对辅助字段，严禁替代线上SKU做映射。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-rose-700 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-center leading-5 text-[11px]">2</span>
                  <span>无效订单过滤与原始留痕</span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  • <strong>排除 Cancelled</strong>: 平台取消订单彻底剔除出有效销售。<br />
                  • <strong>排除 Unit Price = 0</strong>: 多渠道配送及赠品等非正常零售数据隔离。<br />
                  • 原始记录 Raw Data 永久完好保存于数据库，提供排除溯源。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-amber-700 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-center leading-5 text-[11px]">3</span>
                  <span>发货数量统一核算口径</span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  • <strong>最终销售额 (finalSales)</strong> = 实际发货数量 × 商品单价。<br />
                  • <strong>最终销量 (salesQuantity)</strong> = 实际发货数量。<br />
                  • 当订购数量 ≠ 发货数量时，自动按实际发货纠偏并生成修正明细。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-emerald-700 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-center leading-5 text-[11px]">4</span>
                  <span>成本与基础毛利标准</span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  • <strong>销售成本 (salesCost)</strong> = 实际发货数量 × 单件商品成本。<br />
                  • <strong>基础毛利 (basicGrossProfit)</strong> = 最终销售额 - 销售成本。<br />
                  • 基础毛利率 = 基础毛利 ÷ 最终销售额 (未扣除Walmart佣金与WFS费用)。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Logs */}
        {activeTab === 'logs' && (
          <div className="p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">数据处理与解析日志</h3>
            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">暂无处理日志。</div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-700 border-b border-slate-200 pb-2 mb-2 font-sans">
                      <span className="font-bold text-blue-700">{log.fileName}</span>
                      <span className="text-[11px] text-slate-500">{log.timestamp}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        总Sheet数: <span className="text-slate-900 font-bold">{log.totalSheets}</span>
                      </div>
                      <div>
                        识别订单Sheet: <span className="text-emerald-700 font-bold">{log.detectedOrderSheets.join(', ')}</span>
                      </div>
                      <div>
                        原始记录: <span className="text-slate-900 font-bold">{log.rawCount}</span>
                      </div>
                      <div>
                        有效纳入销售: <span className="text-emerald-700 font-bold">{log.validSalesCount}</span>
                      </div>
                      <div>
                        Cancelled排除: <span className="text-rose-700 font-bold">{log.cancelledCount}</span>
                      </div>
                      <div>
                        单价=0排除: <span className="text-slate-700 font-bold">{log.zeroPriceCount}</span>
                      </div>
                      <div>
                        数量不一致修正: <span className="text-amber-700 font-bold">{log.qtyMismatchCount}</span>
                      </div>
                      <div>
                        销售额总计: <span className="text-emerald-700 font-bold">${log.totalSalesAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Mapping Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h4 className="text-sm font-bold text-slate-900">添加产品映射</h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <form onSubmit={submitNewMapping} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-medium">Walmart 销售SKU (线上商品SKU)</label>
                <input
                  type="text"
                  required
                  value={newSkuMapping.sku}
                  onChange={(e) => setNewSkuMapping({ ...newSkuMapping, sku: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-900 font-mono focus:bg-white"
                  placeholder="如: PET1005-XS-BLK"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1 font-medium">所属 SPU</label>
                <input
                  type="text"
                  required
                  value={newSkuMapping.spu}
                  onChange={(e) => setNewSkuMapping({ ...newSkuMapping, spu: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-900 font-mono focus:bg-white"
                  placeholder="如: PET1005"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1 font-medium">产品类型 (Category)</label>
                <input
                  type="text"
                  required
                  value={newSkuMapping.productType}
                  onChange={(e) => setNewSkuMapping({ ...newSkuMapping, productType: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-900 focus:bg-white"
                  placeholder="如: Harness"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-100 text-slate-700"
                >
                  取消
                </button>
                <button type="submit" className="px-3.5 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700">
                  保存映射
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
