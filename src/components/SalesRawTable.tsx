import React, { useState } from 'react';
import { Database, Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { StandardSalesRecord } from '../types/sales';
import { exportToXLSX, exportToCSV, formatCleanRecordsForExport } from '../services/exporter';

interface SalesRawTableProps {
  records: StandardSalesRecord[];
}

export const SalesRawTable: React.FC<SalesRawTableProps> = ({ records }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMismatchOnly, setFilterMismatchOnly] = useState(false);
  const [filterUnmappedOnly, setFilterUnmappedOnly] = useState(false);

  const filtered = records.filter((r) => {
    if (filterMismatchOnly && !r.isQtyMismatched) return false;
    if (filterUnmappedOnly && !r.isUnmapped) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.orderId.toLowerCase().includes(term) ||
      r.onlineProductSKU.toLowerCase().includes(term) ||
      r.internalSKU.toLowerCase().includes(term) ||
      r.SPU.toLowerCase().includes(term) ||
      r.productType.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const currentRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExport = (format: 'xlsx' | 'csv') => {
    const formatted = formatCleanRecordsForExport(filtered);
    if (format === 'xlsx') {
      exportToXLSX(formatted, `Walmart_标准销售数据_${filtered.length}条`, 'Clean_Sales');
    } else {
      exportToCSV(formatted, `Walmart_标准销售数据_${filtered.length}条`);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs mb-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-150">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">标准清洗后销售数据明细表</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-semibold">
              {filtered.length.toLocaleString()} 条
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            严格统一口径 · 线上商品SKU为销售主键 · 发货数量精确核算销售额
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Toggles */}
          <button
            onClick={() => {
              setFilterMismatchOnly(!filterMismatchOnly);
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer font-medium ${
              filterMismatchOnly
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
          >
            仅看数量修正订单
          </button>

          <button
            onClick={() => {
              setFilterUnmappedOnly(!filterUnmappedOnly);
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer font-medium ${
              filterUnmappedOnly
                ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
          >
            仅看未映射SKU
          </button>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索订单/SKU/SPU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-250 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 w-48"
            />
          </div>

          {/* Export button */}
          <button
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center space-x-1 px-3 py-1 rounded bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-250 text-xs cursor-pointer font-medium"
          >
            <Download className="w-3 h-3 text-blue-600" />
            <span>导出表格</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 font-semibold">订单号</th>
              <th className="py-2.5 px-3 font-semibold font-sans">下单时间</th>
              <th className="py-2.5 px-3 text-blue-700 font-bold">Walmart销售SKU</th>
              <th className="py-2.5 px-3 text-amber-700 font-medium" title="公司内部产品编码（仅作对照信息）">
                内部SKU (对照)
              </th>
              <th className="py-2.5 px-3 text-emerald-800 font-semibold">SPU</th>
              <th className="py-2.5 px-3 text-slate-700 font-sans font-semibold">产品类型</th>
              <th className="py-2.5 px-3 text-right font-semibold">单价</th>
              <th className="py-2.5 px-3 text-right font-semibold">订购</th>
              <th className="py-2.5 px-3 text-right text-emerald-700 font-bold">发货(销量)</th>
              <th className="py-2.5 px-3 text-right text-slate-900 font-bold">最终销售额</th>
              <th className="py-2.5 px-3 text-right text-slate-500 font-semibold">成本</th>
              <th className="py-2.5 px-3 text-right text-emerald-700 font-semibold">基础毛利</th>
              <th className="py-2.5 px-3 text-right font-semibold">毛利率</th>
              <th className="py-2.5 px-3 text-center font-sans font-semibold">修正/映射</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150">
            {currentRows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="py-2 px-3 text-slate-800 font-medium">{r.orderId}</td>
                <td className="py-2 px-3 text-slate-500 text-[11px] font-sans">{r.orderTime}</td>
                <td className="py-2 px-3 font-bold text-blue-700">{r.onlineProductSKU}</td>
                <td className="py-2 px-3 text-amber-700 bg-amber-50/20">{r.internalSKU}</td>
                <td className="py-2 px-3 text-slate-700">{r.SPU}</td>
                <td className="py-2 px-3 text-slate-600 font-sans max-w-[120px] truncate" title={r.productType}>
                  {r.productType}
                </td>
                <td className="py-2 px-3 text-right">${r.unitPrice.toFixed(2)}</td>
                <td className="py-2 px-3 text-right text-slate-500">{r.orderedQuantity}</td>
                <td className="py-2 px-3 text-right text-emerald-700 font-bold">{r.salesQuantity}</td>
                <td className="py-2 px-3 text-right font-bold text-slate-900">${r.finalSales.toFixed(2)}</td>
                <td className="py-2 px-3 text-right text-slate-500">${r.salesCost.toFixed(2)}</td>
                <td className="py-2 px-3 text-right text-emerald-700 font-semibold">${r.basicGrossProfit.toFixed(2)}</td>
                <td className="py-2 px-3 text-right text-emerald-700 font-semibold">{(r.basicGrossMargin * 100).toFixed(1)}%</td>
                <td className="py-2 px-3 text-center">
                  <div className="flex items-center justify-center space-x-1 font-sans">
                    {r.isQtyMismatched && (
                      <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        量异重算
                      </span>
                    )}
                    {r.isUnmapped && (
                      <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-100 text-indigo-800 border border-indigo-300">
                        未匹配
                      </span>
                    )}
                    {!r.isQtyMismatched && !r.isUnmapped && (
                      <span className="text-[10px] text-slate-400">正常</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-150 text-xs text-slate-500">
        <div className="flex items-center space-x-2">
          <span>每页行数:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
          <span>
            显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filtered.length)} / 共{' '}
            {filtered.length} 条
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1 rounded bg-white border border-slate-250 disabled:opacity-40 cursor-pointer text-slate-700"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-slate-800 font-semibold">
            {currentPage} / {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1 rounded bg-white border border-slate-250 disabled:opacity-40 cursor-pointer text-slate-700"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
