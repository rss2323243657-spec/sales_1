import React, { useState, useEffect, useMemo } from 'react';
import {
  StandardSalesRecord,
  ExcludedRecord,
  AdjustmentRecord,
  ProductMappingItem,
  ProcessingLog,
  FilterState,
} from './types/sales';
import {
  getAllCleanSalesRecords,
  saveCleanSalesRecords,
  getAllExcludedRecords,
  saveExcludedRecords,
  getAllAdjustmentRecords,
  saveAdjustmentRecords,
  getAllProductMappings,
  saveProductMappings,
  getAllProcessingLogs,
  saveProcessingLog,
  clearAllAnalyticsData,
  clearDemoDataOnly,
} from './services/db';
import { filterAndAggregateSales, processWorkbookOrders } from './services/dataProcessor';
import {
  DEMO_PRODUCT_MAPPINGS,
  createDemoOrderWorkbook,
} from './services/sampleDataGenerator';
import { exportToXLSX, exportToCSV, formatCleanRecordsForExport } from './services/exporter';

import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { KPICards } from './components/KPICards';
import { AnomalyAlerts } from './components/AnomalyAlerts';
import { SalesTrendChart } from './components/SalesTrendChart';
import { CategoryAndSpuRank } from './components/CategoryAndSpuRank';
import { SkuRankTable } from './components/SkuRankTable';
import { SkuDetailModal } from './components/SkuDetailModal';
import { AiAnalysisModal } from './components/AiAnalysisModal';
import { DataQualityCenter } from './components/DataQualityCenter';
import { SalesRawTable } from './components/SalesRawTable';
import { DataUploadModal } from './components/DataUploadModal';

export default function App() {
  const [cleanRecords, setCleanRecords] = useState<StandardSalesRecord[]>([]);
  const [excludedRecords, setExcludedRecords] = useState<ExcludedRecord[]>([]);
  const [adjustmentRecords, setAdjustmentRecords] = useState<AdjustmentRecord[]>([]);
  const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);
  const [productMappings, setProductMappings] = useState<Map<string, ProductMappingItem>>(new Map());

  const [activeTab, setActiveTab] = useState<'dashboard' | 'trends' | 'products' | 'details' | 'quality'>('dashboard');
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [drillDownSku, setDrillDownSku] = useState<string | null>(null);
  const [skuAiContext, setSkuAiContext] = useState<any>(null);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    timeGranularity: 'month',
    selectedDateRange: ['', ''],
    productHierarchy: 'all',
    selectedProductType: 'ALL',
    selectedSpu: 'ALL',
    selectedOnlineSku: 'ALL',
    onlineSkuSearch: '',
    spuSearch: '',
    internalSkuSearch: '',
    globalSearch: '',
    primaryMetric: 'finalSales',
  });

  // Check if any demo data exists in records
  const hasDemoData = useMemo(() => {
    return cleanRecords.some((r) => r.isDemoData);
  }, [cleanRecords]);

  // Load from IndexedDB on startup
  useEffect(() => {
    async function loadData() {
      try {
        const [savedSales, savedExcluded, savedAdj, savedMappings, savedLogs] = await Promise.all([
          getAllCleanSalesRecords(),
          getAllExcludedRecords(),
          getAllAdjustmentRecords(),
          getAllProductMappings(),
          getAllProcessingLogs(),
        ]);

        const mappingMap = new Map<string, ProductMappingItem>();
        if (savedMappings.length > 0) {
          savedMappings.forEach((m) => mappingMap.set(m.SKU, m));
        } else {
          DEMO_PRODUCT_MAPPINGS.forEach((m) => mappingMap.set(m.SKU, m));
          await saveProductMappings(DEMO_PRODUCT_MAPPINGS);
        }
        setProductMappings(mappingMap);

        if (savedSales.length > 0) {
          setCleanRecords(savedSales);
          setExcludedRecords(savedExcluded);
          setAdjustmentRecords(savedAdj);
          setProcessingLogs(savedLogs);

          // Find max date in dataset
          let maxD = '2026-09-01';
          savedSales.forEach((r) => {
            if (r.dateOnly > maxD) maxD = r.dateOnly;
          });
        } else {
          // If totally empty, load initial demo dataset
          await loadDemoData(mappingMap);
        }
      } catch (err) {
        console.error('Failed to load DB:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    loadData();
  }, []);

  // Helper for loading demo dataset
  const loadDemoData = async (currentMappings?: Map<string, ProductMappingItem>) => {
    setIsLoadingDemo(true);
    try {
      const mappingsToUse = currentMappings || productMappings;
      const wb = createDemoOrderWorkbook();

      const result = processWorkbookOrders({
        fileName: 'Walmart_US_ERP_2026_Q3_Q4_模拟业务订单.xlsx',
        workbook: wb,
        productMappings: mappingsToUse,
      });

      // Mark records as demo data
      result.cleanRecords.forEach((r) => (r.isDemoData = true));

      setCleanRecords(result.cleanRecords);
      setExcludedRecords(result.excludedRecords);
      setAdjustmentRecords(result.adjustmentRecords);
      setProcessingLogs([result.log]);

      // Set default date range to last 30 days of data
      if (result.maxOrderDate) {
        const maxD = new Date(result.maxOrderDate);
        const startD = new Date(maxD);
        startD.setDate(maxD.getDate() - 29);
        setFilters((prev) => ({
          ...prev,
          timeGranularity: 'month',
          selectedDateRange: [startD.toISOString().substring(0, 10), result.maxOrderDate],
        }));
      }

      await Promise.all([
        saveCleanSalesRecords(result.cleanRecords),
        saveExcludedRecords(result.excludedRecords),
        saveAdjustmentRecords(result.adjustmentRecords),
        saveProcessingLog(result.log),
      ]);
    } catch (e) {
      console.error('Failed demo load:', e);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  // Clear demo data only
  const handleClearDemoData = async () => {
    if (confirm('确认清空当前的【模拟演示数据】吗？清空后将仅保留您正式上传的文件。')) {
      await clearDemoDataOnly();
      const updated = cleanRecords.filter((r) => !r.isDemoData);
      setCleanRecords(updated);
      alert('已成功清除演示数据！现在可以上传您的真实 ERP 订单文件。');
    }
  };

  // Clear all data
  const handleClearAllData = async () => {
    if (confirm('确认清空系统内所有已导入的销售订单、排除明细与修正日志吗？此操作不可逆。')) {
      await clearAllAnalyticsData();
      setCleanRecords([]);
      setExcludedRecords([]);
      setAdjustmentRecords([]);
      setProcessingLogs([]);
      alert('已清空全部数据。');
    }
  };

  // Add single product mapping item
  const handleAddProductMapping = async (item: ProductMappingItem) => {
    const updated = new Map(productMappings);
    updated.set(item.SKU, item);
    setProductMappings(updated);
    await saveProductMappings(Array.from(updated.values()));

    setCleanRecords((prev) =>
      prev.map((r) => {
        if (r.onlineProductSKU === item.SKU) {
          return {
            ...r,
            SPU: item.SPU,
            productType: item.productType,
            isUnmapped: false,
          };
        }
        return r;
      })
    );
  };

  // Bulk update product mappings from upload
  const handleSaveBulkMappings = async (items: ProductMappingItem[]) => {
    const updated = new Map(productMappings);
    items.forEach((m) => updated.set(m.SKU, m));
    setProductMappings(updated);
    await saveProductMappings(Array.from(updated.values()));

    setCleanRecords((prev) =>
      prev.map((r) => {
        const m = updated.get(r.onlineProductSKU);
        if (m) {
          return {
            ...r,
            SPU: m.SPU,
            productType: m.productType,
            isUnmapped: false,
          };
        }
        return r;
      })
    );
  };

  // Save freshly processed uploaded orders with replace or append
  const handleSaveProcessedOrders = async (
    result: {
      cleanRecords: StandardSalesRecord[];
      excludedRecords: ExcludedRecord[];
      adjustmentRecords: AdjustmentRecord[];
      log: ProcessingLog;
      maxOrderDate: string;
    },
    mode: 'replace' | 'append'
  ) => {
    let finalClean: StandardSalesRecord[] = [];
    let finalExcluded: ExcludedRecord[] = [];
    let finalAdj: AdjustmentRecord[] = [];
    let finalLogs: ProcessingLog[] = [];

    if (mode === 'replace') {
      await clearAllAnalyticsData();
      finalClean = result.cleanRecords;
      finalExcluded = result.excludedRecords;
      finalAdj = result.adjustmentRecords;
      finalLogs = [result.log];
    } else {
      finalClean = [...cleanRecords, ...result.cleanRecords];
      finalExcluded = [...excludedRecords, ...result.excludedRecords];
      finalAdj = [...adjustmentRecords, ...result.adjustmentRecords];
      finalLogs = [result.log, ...processingLogs];
    }

    setCleanRecords(finalClean);
    setExcludedRecords(finalExcluded);
    setAdjustmentRecords(finalAdj);
    setProcessingLogs(finalLogs);

    // Update filter date range to recent 30 days of uploaded data
    if (result.maxOrderDate) {
      const maxD = new Date(result.maxOrderDate);
      const startD = new Date(maxD);
      startD.setDate(maxD.getDate() - 29);
      setFilters((prev) => ({
        ...prev,
        selectedDateRange: [startD.toISOString().substring(0, 10), result.maxOrderDate],
      }));
    }

    await Promise.all([
      saveCleanSalesRecords(finalClean),
      saveExcludedRecords(finalExcluded),
      saveAdjustmentRecords(finalAdj),
      saveProcessingLog(result.log),
    ]);
  };

  // Export clean data
  const handleExportCleanData = (format: 'xlsx' | 'csv') => {
    const formatted = formatCleanRecordsForExport(cleanRecords);
    if (format === 'xlsx') {
      exportToXLSX(formatted, `Walmart_标准销售数据_${cleanRecords.length}条`, 'Clean_Sales');
    } else {
      exportToCSV(formatted, `Walmart_标准销售数据_${cleanRecords.length}条`);
    }
  };

  // Dropdown options
  const availableProductTypes = useMemo(() => {
    const types = new Set<string>();
    cleanRecords.forEach((r) => {
      if (r.productType) types.add(r.productType);
    });
    return Array.from(types).sort();
  }, [cleanRecords]);

  const availableSpus = useMemo(() => {
    const spus = new Set<string>();
    cleanRecords.forEach((r) => {
      if (r.SPU) {
        if (filters.selectedProductType === 'ALL' || r.productType === filters.selectedProductType) {
          spus.add(r.SPU);
        }
      }
    });
    return Array.from(spus).sort();
  }, [cleanRecords, filters.selectedProductType]);

  const availableOnlineSkus = useMemo(() => {
    const skus = new Set<string>();
    cleanRecords.forEach((r) => {
      if (filters.selectedProductType !== 'ALL' && r.productType !== filters.selectedProductType) return;
      if (filters.selectedSpu !== 'ALL' && r.SPU !== filters.selectedSpu) return;
      skus.add(r.onlineProductSKU);
    });
    return Array.from(skus).sort();
  }, [cleanRecords, filters.selectedProductType, filters.selectedSpu]);

  // Execute Core Filtering & Aggregation
  const {
    filteredRecords,
    kpis,
    aggregatedByTime,
    aggregatedByProductType,
    aggregatedBySpu,
    aggregatedBySku,
    timeComparison,
    anomalies,
    maxDateFound,
  } = useMemo(() => {
    return filterAndAggregateSales(cleanRecords, filters);
  }, [cleanRecords, filters]);

  // Reset filters to default (last 30 days of data)
  const handleResetFilters = () => {
    let start = '';
    let end = maxDateFound;
    if (maxDateFound) {
      const maxD = new Date(maxDateFound);
      const startD = new Date(maxD);
      startD.setDate(maxD.getDate() - 29);
      start = startD.toISOString().substring(0, 10);
    }

    setFilters({
      timeGranularity: 'month',
      selectedDateRange: [start, end],
      productHierarchy: 'all',
      selectedProductType: 'ALL',
      selectedSpu: 'ALL',
      selectedOnlineSku: 'ALL',
      onlineSkuSearch: '',
      spuSearch: '',
      internalSkuSearch: '',
      globalSearch: '',
      primaryMetric: 'finalSales',
    });
  };

  // Open SKU AI Diagnose
  const handleRequestAiSkuDiagnose = (skuData: any) => {
    setSkuAiContext(skuData);
    setShowAiModal(true);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-800">正在初始化 Walmart US ERP 销售分析引擎...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        globalSearch={filters.globalSearch}
        setGlobalSearch={(val) => setFilters((prev) => ({ ...prev, globalSearch: val }))}
        totalRecordsCount={cleanRecords.length}
        hasDemoData={hasDemoData}
        onOpenUpload={() => setShowUploadModal(true)}
        onLoadDemo={() => loadDemoData()}
        onExportCleanData={handleExportCleanData}
        onClearDemoData={handleClearDemoData}
        onClearAllData={handleClearAllData}
        onOpenAiModal={() => setShowAiModal(true)}
        isLoadingDemo={isLoadingDemo}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Filter Bar (Active in analytics and trend tabs) */}
        {(activeTab === 'dashboard' || activeTab === 'trends' || activeTab === 'products') && (
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            availableProductTypes={availableProductTypes}
            availableSpus={availableSpus}
            availableOnlineSkus={availableOnlineSkus}
            maxOrderDate={maxDateFound}
            onReset={handleResetFilters}
          />
        )}

        {/* TAB 1: EXECUTIVE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            <KPICards kpis={kpis} timeComparison={timeComparison} />

            <AnomalyAlerts anomalies={anomalies} />

            <SalesTrendChart
              data={aggregatedByTime}
              granularity={filters.timeGranularity}
              activeMetric={filters.primaryMetric}
              onMetricChange={(m) => setFilters((prev) => ({ ...prev, primaryMetric: m }))}
              showAiAutoAnalysis={true}
            />

            <CategoryAndSpuRank
              productTypes={aggregatedByProductType}
              spus={aggregatedBySpu}
              onSelectProductType={(pt) => setFilters((prev) => ({ ...prev, selectedProductType: pt }))}
              onSelectSpu={(spu) => setFilters((prev) => ({ ...prev, selectedSpu: spu }))}
            />

            <SkuRankTable
              skuList={aggregatedBySku}
              onSelectSku={(sku) => setDrillDownSku(sku)}
            />
          </div>
        )}

        {/* TAB 2: DEDICATED SALES TRENDS & AUTOMATED AI DIAGNOSIS (Requirement 7) */}
        {activeTab === 'trends' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Walmart 销售趋势与全自动 AI 智能分析工作区
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    时间轴以各自然周/月度区间真实日期为准 · 实时联动量额异动诊断与毛利风险预警
                  </p>
                </div>
                <button
                  onClick={() => setShowAiModal(true)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
                >
                  启动全局 AI 经营诊断报告
                </button>
              </div>
            </div>

            <KPICards kpis={kpis} timeComparison={timeComparison} />

            <AnomalyAlerts anomalies={anomalies} />

            <SalesTrendChart
              data={aggregatedByTime}
              granularity={filters.timeGranularity}
              activeMetric={filters.primaryMetric}
              onMetricChange={(m) => setFilters((prev) => ({ ...prev, primaryMetric: m }))}
              showAiAutoAnalysis={true}
            />
          </div>
        )}

        {/* TAB 3: PRODUCT ANALYSIS (SKU / SPU / CATEGORY) */}
        {activeTab === 'products' && (
          <div className="space-y-6 animate-fadeIn">
            <KPICards kpis={kpis} timeComparison={timeComparison} />

            <CategoryAndSpuRank
              productTypes={aggregatedByProductType}
              spus={aggregatedBySpu}
              onSelectProductType={(pt) => setFilters((prev) => ({ ...prev, selectedProductType: pt }))}
              onSelectSpu={(spu) => setFilters((prev) => ({ ...prev, selectedSpu: spu }))}
            />

            <SkuRankTable
              skuList={aggregatedBySku}
              onSelectSku={(sku) => setDrillDownSku(sku)}
            />
          </div>
        )}

        {/* TAB 4: CLEAN SALES DATA DETAILS TABLE */}
        {activeTab === 'details' && (
          <div className="animate-fadeIn">
            <SalesRawTable records={filteredRecords} />
          </div>
        )}

        {/* TAB 5: DATA QUALITY CENTER */}
        {activeTab === 'quality' && (
          <div className="animate-fadeIn">
            <DataQualityCenter
              adjustments={adjustmentRecords}
              excluded={excludedRecords}
              cleanRecords={cleanRecords}
              logs={processingLogs}
              onAddProductMapping={handleAddProductMapping}
            />
          </div>
        )}
      </main>

      {/* Upload Modal with Progress Bar & Mode Choice */}
      <DataUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        productMappings={productMappings}
        onSaveMappings={handleSaveBulkMappings}
        onSaveProcessedOrders={handleSaveProcessedOrders}
        hasDemoData={hasDemoData}
        onClearDemoData={handleClearDemoData}
      />

      {/* SKU Drill-Down Detail Modal */}
      {drillDownSku && (
        <SkuDetailModal
          sku={drillDownSku}
          allRecords={cleanRecords}
          onClose={() => setDrillDownSku(null)}
          onRequestAiSkuDiagnose={handleRequestAiSkuDiagnose}
        />
      )}

      {/* AI Analysis Modal */}
      <AiAnalysisModal
        isOpen={showAiModal}
        onClose={() => {
          setShowAiModal(false);
          setSkuAiContext(null);
        }}
        kpis={kpis}
        timeComparison={timeComparison}
        productTypes={aggregatedByProductType}
        spus={aggregatedBySpu}
        skus={aggregatedBySku}
        filters={filters}
        skuSpecificContext={skuAiContext}
      />
    </div>
  );
}
