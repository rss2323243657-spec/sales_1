import * as XLSX from 'xlsx';
import {
  RawOrderRow,
  StandardSalesRecord,
  ExcludedRecord,
  AdjustmentRecord,
  ProductMappingItem,
  ProcessingLog,
  FilterState,
  KPIOverview,
  TimeComparison,
  AggregatedRow,
  AnomalyItem,
} from '../types/sales';

// Normalized key mappings with comprehensive aliases
const FIELD_ALIASES: Record<string, string[]> = {
  orderId: ['订单号', '订单编号', 'order id', 'orderid', '订单号*', 'erp订单号', '平台订单号'],
  orderTime: ['下单时间', '购买时间', 'order time', 'order date', '创建时间', '下单日期', '付款时间', '支付时间'],
  onlineProductSKU: [
    '线上商品sku',
    'online sku',
    'online product sku',
    'product sku',
    '平台sku',
    '销售sku',
    'walmart sku',
    'walmart销售sku',
    '平台商品sku',
    '线上sku',
  ],
  internalSKU: [
    'sku',
    '内部sku',
    'erp sku',
    '本地sku',
    '公司sku',
    '商品编码',
    '内部编码',
    'erp编号',
    '公司内部产品编码',
    'erp产品编码',
  ],
  productCost: ['商品成本', '成本', 'product cost', '单件成本', '单位成本', '采购成本', 'cost', '单件产品成本'],
  platformStatus: ['平台状态', '订单状态', 'order status', '状态', 'status', '平台订单状态', '销售状态'],
  orderedQuantity: ['商品sku数量', '订购数量', '购买数量', 'ordered quantity', '订单数量', '数量', 'qty', '件数'],
  shippedQuantity: ['发货数量', '实际发货数量', 'shipped quantity', '出库数量', '发货件数', '实际发货件数'],
  unitPrice: ['商品单价', '单价', 'unit price', '售价', '销售单价', 'price', '实际单价'],
};

function normalizeHeader(str: string): string {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-*()（）]/g, '');
}

export function detectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }));

  for (const [standardKey, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const item of normalizedHeaders) {
      if (aliases.some((alias) => normalizeHeader(alias) === item.norm)) {
        if (standardKey === 'internalSKU' && item.norm.includes('线上')) {
          continue;
        }
        if (standardKey === 'onlineProductSKU' && item.norm === 'sku') {
          continue;
        }
        mapping[standardKey] = item.original;
        break;
      }
    }
  }

  // Fallback for onlineProductSKU
  if (!mapping.onlineProductSKU) {
    const found = normalizedHeaders.find(
      (h) => h.norm.includes('online') || h.norm.includes('线上') || h.norm.includes('平台sku')
    );
    if (found) mapping.onlineProductSKU = found.original;
  }

  // Fallback for internalSKU
  if (!mapping.internalSKU) {
    const found = normalizedHeaders.find((h) => h.norm === 'sku' && h.original !== mapping.onlineProductSKU);
    if (found) mapping.internalSKU = found.original;
  }

  return mapping;
}

export function isOrderSheet(headers: string[]): boolean {
  const mapping = detectColumnMapping(headers);
  let score = 0;
  if (mapping.onlineProductSKU) score += 2;
  if (mapping.internalSKU) score += 1;
  if (mapping.orderTime) score += 2;
  if (mapping.unitPrice) score += 2;
  if (mapping.shippedQuantity || mapping.orderedQuantity) score += 2;
  if (mapping.platformStatus) score += 1;
  if (mapping.productCost) score += 1;
  return score >= 4;
}

// Check if platformStatus represents a cancelled order
export function isCancelledStatus(status: any): boolean {
  if (status === null || status === undefined) return false;
  const s = String(status).trim().toLowerCase();
  return (
    s === 'cancelled' ||
    s === 'canceled' ||
    s === '已取消' ||
    s === '取消' ||
    s.includes('cancel') ||
    s.includes('已取消')
  );
}

// Clean and parse unit price safely
export function parseUnitPrice(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace(/[^0-9.-]+/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Clean and parse product cost safely
export function parseProductCost(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace(/[^0-9.-]+/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Date parsing with support for multiple formats
export function parseDateString(val: any): {
  iso: string;
  dateOnly: string;
  year: number;
  month: string;
  quarter: string;
  week: string;
  humanRange: {
    dayLabel: string;
    weekLabel: string;
    monthLabel: string;
    quarterLabel: string;
    yearLabel: string;
  };
} {
  let d: Date = new Date();
  let hasParsed = false;

  if (typeof val === 'number') {
    // Excel serial number
    const utc_days = Math.floor(val - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    const fractional_day = val - Math.floor(val) + 0.0000001;
    let total_seconds = Math.floor(86400 * fractional_day);
    const seconds = total_seconds % 60;
    total_seconds -= seconds;
    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;
    d = new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
    hasParsed = !isNaN(d.getTime());
  } else if (val) {
    const rawStr = String(val).trim();
    // Try US date MM/DD/YYYY HH:mm:ss
    const usPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/;
    const usMatch = rawStr.match(usPattern);
    if (usMatch) {
      const month = parseInt(usMatch[1], 10) - 1;
      const day = parseInt(usMatch[2], 10);
      const year = parseInt(usMatch[3], 10);
      d = new Date(year, month, day);
      if (usMatch[4]) {
        const timePart = new Date(`1970-01-01 ${usMatch[4].trim()}`);
        if (!isNaN(timePart.getTime())) {
          d.setHours(timePart.getHours(), timePart.getMinutes(), timePart.getSeconds());
        }
      }
      hasParsed = !isNaN(d.getTime());
    }

    if (!hasParsed) {
      const cleanStr = rawStr.replace(/\//g, '-');
      d = new Date(cleanStr);
      hasParsed = !isNaN(d.getTime());
    }
  }

  if (!hasParsed || isNaN(d.getTime())) {
    d = new Date('2026-09-01T00:00:00');
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  const dateOnly = `${yyyy}-${mm}-${dd}`;
  const iso = `${dateOnly} ${hh}:${min}:${ss}`;
  const month = `${yyyy}-${mm}`;

  const q = Math.ceil((d.getMonth() + 1) / 3);
  const quarter = `${yyyy}-Q${q}`;

  // ISO Week calculation (Monday - Sunday)
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const week = `${yyyy}-W${String(weekNumber).padStart(2, '0')}`;

  // Week start (Monday) and end (Sunday) dates
  const currDay = (d.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(d);
  monday.setDate(d.getDate() - currDay);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const monStr = `${String(monday.getMonth() + 1).padStart(2, '0')}/${String(monday.getDate()).padStart(2, '0')}`;
  const sunStr = `${String(sunday.getMonth() + 1).padStart(2, '0')}/${String(sunday.getDate()).padStart(2, '0')}`;

  // Month range
  const lastDayOfMonth = new Date(yyyy, d.getMonth() + 1, 0).getDate();

  // Quarter range
  const qStartMonth = (q - 1) * 3 + 1;
  const qEndMonth = q * 3;
  const qLastDay = new Date(yyyy, qEndMonth, 0).getDate();

  const humanRange = {
    dayLabel: `${yyyy}-${mm}-${dd}`,
    weekLabel: `第${weekNumber}周 (${monStr} ~ ${sunStr})`,
    monthLabel: `${yyyy}年${mm}月 (${mm}/01 ~ ${mm}/${lastDayOfMonth})`,
    quarterLabel: `${yyyy} Q${q} (${String(qStartMonth).padStart(2, '0')}/01 ~ ${String(qEndMonth).padStart(2, '0')}/${qLastDay})`,
    yearLabel: `${yyyy}年度 (01/01 ~ 12/31)`,
  };

  return { iso, dateOnly, year: yyyy, month, quarter, week, humanRange };
}

export interface SheetAnalysis {
  sheetName: string;
  rowCount: number;
  headers: string[];
  isOrderSheet: boolean;
  columnMapping: Record<string, string>;
}

export function inspectWorkbookSheets(workbook: XLSX.WorkBook): SheetAnalysis[] {
  const result: SheetAnalysis[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!jsonRows || jsonRows.length === 0) {
      result.push({
        sheetName,
        rowCount: 0,
        headers: [],
        isOrderSheet: false,
        columnMapping: {},
      });
      continue;
    }

    const headers = (jsonRows[0] || []).map((h: any) => String(h || '').trim()).filter(Boolean);
    const orderValid = isOrderSheet(headers);
    const columnMapping = detectColumnMapping(headers);

    result.push({
      sheetName,
      rowCount: Math.max(0, jsonRows.length - 1),
      headers,
      isOrderSheet: orderValid,
      columnMapping,
    });
  }

  return result;
}

export interface ProcessFileOptions {
  fileName: string;
  workbook: XLSX.WorkBook;
  targetSheets?: string[];
  manualMappings?: Record<string, Record<string, string>>;
  productMappings: Map<string, ProductMappingItem>;
}

export function processWorkbookOrders(options: ProcessFileOptions): {
  cleanRecords: StandardSalesRecord[];
  excludedRecords: ExcludedRecord[];
  adjustmentRecords: AdjustmentRecord[];
  log: ProcessingLog;
  maxOrderDate: string;
} {
  const { fileName, workbook, manualMappings, productMappings } = options;
  const sheetAnalyses = inspectWorkbookSheets(workbook);

  const selectedSheets = options.targetSheets || sheetAnalyses.filter((s) => s.isOrderSheet).map((s) => s.sheetName);
  const ignoredSheets = workbook.SheetNames.filter((s) => !selectedSheets.includes(s));

  const cleanRecords: StandardSalesRecord[] = [];
  const excludedRecords: ExcludedRecord[] = [];
  const adjustmentRecords: AdjustmentRecord[] = [];

  let rawCount = 0;
  let cancelledCount = 0;
  let zeroPriceCount = 0;
  let qtyMismatchCount = 0;
  let unmappedCount = 0;
  let totalSalesAmount = 0;
  let maxOrderDate = '2026-09-01';

  for (const sheetName of selectedSheets) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    rawCount += rawRows.length;

    const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
    const mapping = manualMappings?.[sheetName] || detectColumnMapping(headers);

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      const rawOrderId = String(row[mapping.orderId] ?? `ORD-${sheetName}-${i + 1}`).trim();
      const rawOrderTime = row[mapping.orderTime];
      const onlineSKU = String(row[mapping.onlineProductSKU] ?? '').trim() || 'Unknown Online SKU';
      const internalSKU = String(row[mapping.internalSKU] ?? '').trim() || 'Unknown Internal SKU';
      const platformStatus = String(row[mapping.platformStatus] ?? 'Shipped').trim();
      const unitPrice = parseUnitPrice(row[mapping.unitPrice]);
      const productCost = parseProductCost(row[mapping.productCost]);
      const orderedQty = parseInt(String(row[mapping.orderedQuantity] ?? '1'), 10) || 0;
      const shippedQty = parseInt(String(row[mapping.shippedQuantity] ?? orderedQty), 10) || 0;

      const dateParsed = parseDateString(rawOrderTime);
      const formattedDate = dateParsed.iso;
      const dateOnly = dateParsed.dateOnly;
      const year = dateParsed.year;
      const month = dateParsed.month;
      const quarter = dateParsed.quarter;
      const week = dateParsed.week;

      if (dateOnly > maxOrderDate) {
        maxOrderDate = dateOnly;
      }

      const id = `${rawOrderId}_${onlineSKU}_${sheetName}_${i}`;

      // CRITICAL STEP 1: Check Cancelled status FIRST
      if (isCancelledStatus(platformStatus)) {
        cancelledCount++;
        excludedRecords.push({
          id,
          orderId: rawOrderId,
          orderTime: formattedDate,
          onlineProductSKU: onlineSKU,
          internalSKU,
          platformStatus,
          unitPrice,
          orderedQuantity: orderedQty,
          shippedQuantity: shippedQty,
          excludeReason: 'Platform Status = Cancelled',
          sheetSource: sheetName,
          fileName,
          raw: row,
        });
        continue;
      }

      // CRITICAL STEP 2: Of the non-cancelled orders, check Unit Price = 0
      if (unitPrice <= 0) {
        zeroPriceCount++;
        excludedRecords.push({
          id,
          orderId: rawOrderId,
          orderTime: formattedDate,
          onlineProductSKU: onlineSKU,
          internalSKU,
          platformStatus,
          unitPrice,
          orderedQuantity: orderedQty,
          shippedQuantity: shippedQty,
          excludeReason: 'Unit Price = 0 (多渠道配送等非正常Walmart运营数据)',
          sheetSource: sheetName,
          fileName,
          raw: row,
        });
        continue;
      }

      // CRITICAL STEP 3: Check quantity mismatch
      const isMismatch = orderedQty !== shippedQty;
      if (isMismatch) {
        qtyMismatchCount++;
        const rawCalculatedAmount = orderedQty * unitPrice;
        const adjustedFinalSales = shippedQty * unitPrice;
        adjustmentRecords.push({
          id: `adj_${id}`,
          orderId: rawOrderId,
          onlineProductSKU: onlineSKU,
          internalSKU,
          orderedQuantity: orderedQty,
          shippedQuantity: shippedQty,
          unitPrice,
          rawCalculatedAmount,
          finalSales: adjustedFinalSales,
          diffAmount: adjustedFinalSales - rawCalculatedAmount,
          orderTime: formattedDate,
        });
      }

      // Valid sales calculation
      const salesQty = shippedQty;
      const finalSales = salesQty * unitPrice;
      const salesCost = salesQty * productCost;
      const basicGrossProfit = finalSales - salesCost;
      const basicGrossMargin = finalSales > 0 ? basicGrossProfit / finalSales : 0;
      const averageSellingPrice = salesQty > 0 ? finalSales / salesQty : 0;

      // Product Mapping: STRICTLY ERP.onlineProductSKU -> mapping.SKU
      const mapped = productMappings.get(onlineSKU);
      const isUnmapped = !mapped;
      if (isUnmapped) {
        unmappedCount++;
      }

      const spu = mapped ? mapped.SPU : 'Unmapped';
      const prodType = mapped ? mapped.productType : 'Unmapped';

      totalSalesAmount += finalSales;

      cleanRecords.push({
        id,
        orderId: rawOrderId,
        orderTime: formattedDate,
        dateOnly,
        year,
        month,
        quarter,
        week,
        onlineProductSKU: onlineSKU,
        internalSKU, // Supplementary internal SKU only
        SPU: spu,
        productType: prodType,
        productCost,
        platformStatus,
        orderedQuantity: orderedQty,
        shippedQuantity: shippedQty,
        unitPrice,
        finalSales,
        salesQuantity: salesQty,
        salesCost,
        basicGrossProfit,
        basicGrossMargin,
        averageSellingPrice,
        isQtyMismatched: isMismatch,
        isUnmapped,
        sheetSource: sheetName,
        fileName,
      });
    }
  }

  const log: ProcessingLog = {
    id: `log_${Date.now()}`,
    timestamp: new Date().toLocaleString('zh-CN'),
    fileName,
    totalSheets: workbook.SheetNames.length,
    detectedOrderSheets: selectedSheets,
    ignoredSheets,
    rawCount,
    cancelledCount,
    zeroPriceCount,
    qtyMismatchCount,
    unmappedSkuCount: unmappedCount,
    duplicateCount: 0,
    validSalesCount: cleanRecords.length,
    totalSalesAmount,
  };

  return { cleanRecords, excludedRecords, adjustmentRecords, log, maxOrderDate };
}

export function parseProductMappingFile(workbook: XLSX.WorkBook): ProductMappingItem[] {
  const result: ProductMappingItem[] = [];
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return result;

  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (rawRows.length === 0) return result;

  const headers = Object.keys(rawRows[0]);
  let skuKey =
    headers.find((h) => {
      const norm = normalizeHeader(h);
      return norm.includes('sku') || norm.includes('线上sku') || norm.includes('商品sku');
    }) || headers[0];

  let spuKey =
    headers.find((h) => {
      const norm = normalizeHeader(h);
      return norm.includes('spu');
    }) || headers[1] || 'SPU';

  let typeKey =
    headers.find((h) => {
      const norm = normalizeHeader(h);
      return (
        norm.includes('类型') ||
        norm.includes('类目') ||
        norm.includes('类别') ||
        norm.includes('type') ||
        norm.includes('category')
      );
    }) || headers[2] || '产品类型';

  for (const row of rawRows) {
    const sku = String(row[skuKey] ?? '').trim();
    const spu = String(row[spuKey] ?? '').trim();
    const productType = String(row[typeKey] ?? '').trim();

    if (sku) {
      result.push({
        SKU: sku,
        SPU: spu || 'General SPU',
        productType: productType || 'General Category',
      });
    }
  }

  return result;
}

// Calculate KPIs from clean sales dataset with filtering and human-readable time labels
export function filterAndAggregateSales(
  records: StandardSalesRecord[],
  filters: FilterState
): {
  filteredRecords: StandardSalesRecord[];
  kpis: KPIOverview;
  aggregatedByTime: AggregatedRow[];
  aggregatedByProductType: AggregatedRow[];
  aggregatedBySpu: AggregatedRow[];
  aggregatedBySku: AggregatedRow[];
  timeComparison: TimeComparison;
  anomalies: AnomalyItem[];
  maxDateFound: string;
} {
  // Find max date in all records
  let maxDateFound = '2026-09-01';
  for (const r of records) {
    if (r.dateOnly > maxDateFound) maxDateFound = r.dateOnly;
  }

  // Apply filters
  const filteredRecords = records.filter((r) => {
    // 1. Date Range Filter
    if (filters.selectedDateRange && filters.selectedDateRange[0] && filters.selectedDateRange[1]) {
      if (r.dateOnly < filters.selectedDateRange[0] || r.dateOnly > filters.selectedDateRange[1]) {
        return false;
      }
    }

    // 2. Product Type Filter
    if (filters.selectedProductType && filters.selectedProductType !== 'ALL') {
      if (r.productType !== filters.selectedProductType) return false;
    }

    // 3. SPU Filter
    if (filters.selectedSpu && filters.selectedSpu !== 'ALL') {
      if (r.SPU !== filters.selectedSpu) return false;
    }

    // 4. Online SKU Filter (Dropdown)
    if (filters.selectedOnlineSku && filters.selectedOnlineSku !== 'ALL') {
      if (r.onlineProductSKU !== filters.selectedOnlineSku) return false;
    }

    // 4b. Online SKU Search input
    if (filters.onlineSkuSearch && filters.onlineSkuSearch.trim()) {
      const q = filters.onlineSkuSearch.trim().toLowerCase();
      if (!r.onlineProductSKU.toLowerCase().includes(q)) return false;
    }

    // 4c. SPU Search input
    if (filters.spuSearch && filters.spuSearch.trim()) {
      const q = filters.spuSearch.trim().toLowerCase();
      if (!r.SPU.toLowerCase().includes(q)) return false;
    }

    // 5. Internal SKU Search (Auxiliary)
    if (filters.internalSkuSearch && filters.internalSkuSearch.trim()) {
      const q = filters.internalSkuSearch.trim().toLowerCase();
      if (!r.internalSKU.toLowerCase().includes(q)) return false;
    }

    // 6. Global Search (Constrained within current time range and criteria)
    if (filters.globalSearch && filters.globalSearch.trim()) {
      const q = filters.globalSearch.trim().toLowerCase();
      const match =
        r.orderId.toLowerCase().includes(q) ||
        r.onlineProductSKU.toLowerCase().includes(q) ||
        r.internalSKU.toLowerCase().includes(q) ||
        r.SPU.toLowerCase().includes(q) ||
        r.productType.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // KPI Overview
  let finalSales = 0;
  let salesQuantity = 0;
  let salesCost = 0;
  let basicGrossProfit = 0;
  const uniqueOrders = new Set<string>();
  const uniqueOnlineSkus = new Set<string>();
  const uniqueSpus = new Set<string>();
  const uniqueProductTypes = new Set<string>();

  for (const r of filteredRecords) {
    finalSales += r.finalSales;
    salesQuantity += r.salesQuantity;
    salesCost += r.salesCost;
    basicGrossProfit += r.basicGrossProfit;
    uniqueOrders.add(r.orderId);
    uniqueOnlineSkus.add(r.onlineProductSKU);
    uniqueSpus.add(r.SPU);
    uniqueProductTypes.add(r.productType);
  }

  const basicGrossMargin = finalSales > 0 ? basicGrossProfit / finalSales : 0;
  const averageSellingPrice = salesQuantity > 0 ? finalSales / salesQuantity : 0;

  const kpis: KPIOverview = {
    finalSales,
    salesQuantity,
    salesCost,
    basicGrossProfit,
    basicGrossMargin,
    averageSellingPrice,
    orderCount: uniqueOrders.size,
    activeOnlineSkuCount: uniqueOnlineSkus.size,
    activeSpuCount: uniqueSpus.size,
    activeProductTypeCount: uniqueProductTypes.size,
  };

  // Time aggregation with HUMAN-READABLE range labels
  const timeMap = new Map<string, { key: string; label: string; records: StandardSalesRecord[] }>();

  for (const r of filteredRecords) {
    const parsed = parseDateString(r.orderTime);
    let key = r.month;
    let label = parsed.humanRange.monthLabel;

    if (filters.timeGranularity === 'day') {
      key = r.dateOnly;
      label = parsed.humanRange.dayLabel;
    } else if (filters.timeGranularity === 'week') {
      key = r.week;
      label = parsed.humanRange.weekLabel;
    } else if (filters.timeGranularity === 'quarter') {
      key = r.quarter;
      label = parsed.humanRange.quarterLabel;
    } else if (filters.timeGranularity === 'year') {
      key = String(r.year);
      label = parsed.humanRange.yearLabel;
    } else if (filters.timeGranularity === 'custom') {
      key = r.dateOnly;
      label = parsed.humanRange.dayLabel;
    }

    if (!timeMap.has(key)) {
      timeMap.set(key, { key, label, records: [] });
    }
    timeMap.get(key)!.records.push(r);
  }

  const sortedTimeKeys = Array.from(timeMap.keys()).sort();
  const aggregatedByTime: AggregatedRow[] = sortedTimeKeys.map((key) => {
    const entry = timeMap.get(key)!;
    const list = entry.records;
    let sSales = 0;
    let sQty = 0;
    let sCost = 0;
    let sProfit = 0;
    const orderSet = new Set<string>();

    for (const item of list) {
      sSales += item.finalSales;
      sQty += item.salesQuantity;
      sCost += item.salesCost;
      sProfit += item.basicGrossProfit;
      orderSet.add(item.orderId);
    }

    return {
      key,
      label: entry.label, // Human-readable range, e.g. "第38周 (09/14 ~ 09/20)"
      finalSales: sSales,
      salesQuantity: sQty,
      salesCost: sCost,
      basicGrossProfit: sProfit,
      basicGrossMargin: sSales > 0 ? sProfit / sSales : 0,
      averageSellingPrice: sQty > 0 ? sSales / sQty : 0,
      orderCount: orderSet.size,
    };
  });

  // MoM
  for (let i = 0; i < aggregatedByTime.length; i++) {
    if (i > 0) {
      const prev = aggregatedByTime[i - 1].finalSales;
      aggregatedByTime[i].growthMoM = prev > 0 ? (aggregatedByTime[i].finalSales - prev) / prev : null;
    } else {
      aggregatedByTime[i].growthMoM = null;
    }
  }

  // Product Type aggregation
  const typeMap = new Map<string, StandardSalesRecord[]>();
  for (const r of filteredRecords) {
    const typeKey = r.productType || 'Unmapped';
    if (!typeMap.has(typeKey)) typeMap.set(typeKey, []);
    typeMap.get(typeKey)!.push(r);
  }

  const aggregatedByProductType: AggregatedRow[] = Array.from(typeMap.entries())
    .map(([pType, list]) => {
      let tSales = 0;
      let tQty = 0;
      let tCost = 0;
      let tProfit = 0;
      const ords = new Set<string>();
      for (const item of list) {
        tSales += item.finalSales;
        tQty += item.salesQuantity;
        tCost += item.salesCost;
        tProfit += item.basicGrossProfit;
        ords.add(item.orderId);
      }
      return {
        key: pType,
        label: pType,
        productType: pType,
        finalSales: tSales,
        salesQuantity: tQty,
        salesCost: tCost,
        basicGrossProfit: tProfit,
        basicGrossMargin: tSales > 0 ? tProfit / tSales : 0,
        averageSellingPrice: tQty > 0 ? tSales / tQty : 0,
        orderCount: ords.size,
        sharePercentage: finalSales > 0 ? tSales / finalSales : 0,
      };
    })
    .sort((a, b) => b.finalSales - a.finalSales);

  // SPU aggregation
  const spuMap = new Map<string, StandardSalesRecord[]>();
  for (const r of filteredRecords) {
    const spuKey = r.SPU || 'Unmapped';
    if (!spuMap.has(spuKey)) spuMap.set(spuKey, []);
    spuMap.get(spuKey)!.push(r);
  }

  const aggregatedBySpu: AggregatedRow[] = Array.from(spuMap.entries())
    .map(([spu, list]) => {
      let sSales = 0;
      let sQty = 0;
      let sCost = 0;
      let sProfit = 0;
      const ords = new Set<string>();
      const prodType = list[0]?.productType || 'Unmapped';
      for (const item of list) {
        sSales += item.finalSales;
        sQty += item.salesQuantity;
        sCost += item.salesCost;
        sProfit += item.basicGrossProfit;
        ords.add(item.orderId);
      }
      return {
        key: spu,
        label: spu,
        SPU: spu,
        productType: prodType,
        finalSales: sSales,
        salesQuantity: sQty,
        salesCost: sCost,
        basicGrossProfit: sProfit,
        basicGrossMargin: sSales > 0 ? sProfit / sSales : 0,
        averageSellingPrice: sQty > 0 ? sSales / sQty : 0,
        orderCount: ords.size,
        sharePercentage: finalSales > 0 ? sSales / finalSales : 0,
      };
    })
    .sort((a, b) => b.finalSales - a.finalSales);

  // SKU aggregation (Strictly onlineProductSKU as key, internalSKU displayed alongside)
  const skuMap = new Map<string, StandardSalesRecord[]>();
  for (const r of filteredRecords) {
    const skuKey = r.onlineProductSKU;
    if (!skuMap.has(skuKey)) skuMap.set(skuKey, []);
    skuMap.get(skuKey)!.push(r);
  }

  const aggregatedBySku: AggregatedRow[] = Array.from(skuMap.entries())
    .map(([sku, list]) => {
      let kSales = 0;
      let kQty = 0;
      let kCost = 0;
      let kProfit = 0;
      const ords = new Set<string>();
      const first = list[0];
      for (const item of list) {
        kSales += item.finalSales;
        kQty += item.salesQuantity;
        kCost += item.salesCost;
        kProfit += item.basicGrossProfit;
        ords.add(item.orderId);
      }
      return {
        key: sku,
        label: sku,
        onlineProductSKU: sku,
        internalSKU: first.internalSKU,
        SPU: first.SPU,
        productType: first.productType,
        finalSales: kSales,
        salesQuantity: kQty,
        salesCost: kCost,
        basicGrossProfit: kProfit,
        basicGrossMargin: kSales > 0 ? kProfit / kSales : 0,
        averageSellingPrice: kQty > 0 ? kSales / kQty : 0,
        orderCount: ords.size,
        sharePercentage: finalSales > 0 ? kSales / finalSales : 0,
      };
    })
    .sort((a, b) => b.finalSales - a.finalSales);

  // MoM and YoY calculations for the latest period vs prior periods
  let timeComparison: TimeComparison = {
    priorSales: null,
    priorQty: null,
    momSalesChange: null,
    momQtyChange: null,
    lastYearSales: null,
    lastYearQty: null,
    yoySalesChange: null,
    yoyQtyChange: null,
  };

  if (aggregatedByTime.length >= 2) {
    const currentPeriod = aggregatedByTime[aggregatedByTime.length - 1];
    const priorPeriod = aggregatedByTime[aggregatedByTime.length - 2];
    timeComparison.currentLabel = currentPeriod.label;
    timeComparison.priorLabel = priorPeriod.label;
    timeComparison.priorSales = priorPeriod.finalSales;
    timeComparison.priorQty = priorPeriod.salesQuantity;

    if (priorPeriod.finalSales > 0) {
      timeComparison.momSalesChange = (currentPeriod.finalSales - priorPeriod.finalSales) / priorPeriod.finalSales;
    }
    if (priorPeriod.salesQuantity > 0) {
      timeComparison.momQtyChange = (currentPeriod.salesQuantity - priorPeriod.salesQuantity) / priorPeriod.salesQuantity;
    }

    const curKey = currentPeriod.key;
    if (curKey.includes('-')) {
      const parts = curKey.split('-');
      const curYear = parseInt(parts[0], 10);
      if (!isNaN(curYear)) {
        const lastYearKey = `${curYear - 1}-${parts.slice(1).join('-')}`;
        const lastYearFound = aggregatedByTime.find((t) => t.key === lastYearKey);
        if (lastYearFound) {
          timeComparison.lastYearSales = lastYearFound.finalSales;
          timeComparison.lastYearQty = lastYearFound.salesQuantity;
          if (lastYearFound.finalSales > 0) {
            timeComparison.yoySalesChange = (currentPeriod.finalSales - lastYearFound.finalSales) / lastYearFound.finalSales;
          }
          if (lastYearFound.salesQuantity > 0) {
            timeComparison.yoyQtyChange = (currentPeriod.salesQuantity - lastYearFound.salesQuantity) / lastYearFound.salesQuantity;
          }
        }
      }
    }
  }

  // Automatic Sales Anomaly Identification
  const anomalies: AnomalyItem[] = [];

  if (timeComparison.momSalesChange !== null && timeComparison.momQtyChange !== null) {
    if (timeComparison.momQtyChange > 0.05 && timeComparison.momSalesChange < -0.05) {
      anomalies.push({
        id: 'anom_vol_up_rev_down',
        level: 'warning',
        type: '量额背离（降价倾销/折扣过大）',
        target: '整体店铺',
        title: '销量增长但销售额下滑',
        description: `当前周期销量环比增长 ${(timeComparison.momQtyChange * 100).toFixed(1)}%，但销售额环比下降 ${(Math.abs(timeComparison.momSalesChange) * 100).toFixed(1)}%。表明平均销售单价(ASP)发生下探。`,
        suggestedAction: '核查本期是否开启了高额Coupon、促销折扣或低价捆绑，评估是否侵蚀了毛利底线。',
      });
    } else if (timeComparison.momQtyChange < -0.05 && timeComparison.momSalesChange > 0.05) {
      anomalies.push({
        id: 'anom_vol_down_rev_up',
        level: 'info',
        type: '量额背离（高客单驱动）',
        target: '整体店铺',
        title: '销量下降但销售额逆势上升',
        description: `当前周期销量环比下降 ${(Math.abs(timeComparison.momQtyChange) * 100).toFixed(1)}%，销售额环比增长 ${(timeComparison.momSalesChange * 100).toFixed(1)}%。表明产品销售结构向高客单价SKU转移，或主推款提价。`,
        suggestedAction: '评估提价是否对Walmart自然搜索转化率和购物车胜率(Buy Box)造成长期压制。',
      });
    }
  }

  if (basicGrossMargin < 0.25 && finalSales > 0) {
    anomalies.push({
      id: 'anom_low_margin',
      level: 'danger',
      type: '毛利风险',
      target: '全店基础毛利',
      title: '全店基础毛利率偏低警告',
      description: `当前基础毛利率仅为 ${(basicGrossMargin * 100).toFixed(1)}%（尚未扣除Walmart平台15%佣金及WFS履约费），扣除佣金与履约后净利面临穿透亏损风险。`,
      suggestedAction: '立即排查高成本低售价SKU，收缩负毛利产品推广，调整产品线定价。',
    });
  }

  if (aggregatedBySku.length > 0) {
    const topSku = aggregatedBySku[0];
    if (topSku.sharePercentage && topSku.sharePercentage > 0.45) {
      anomalies.push({
        id: 'anom_sku_concentration',
        level: 'warning',
        type: 'SKU集中度过高',
        target: topSku.onlineProductSKU || '',
        title: `单一SKU营收占比高达 ${(topSku.sharePercentage * 100).toFixed(1)}%`,
        description: `主力销售SKU【${topSku.onlineProductSKU}】贡献了全店超四成销售额，店铺业绩抗风险能力较脆弱。`,
        suggestedAction: '建议加紧二梯队SPU与潜力SKU动销培育，同时严格锁定该主力款在WFS的库存周转天数以防断货。',
      });
    }
  }

  const unmappedSkuCount = aggregatedBySku.filter((s) => s.SPU === 'Unmapped').length;
  if (unmappedSkuCount > 0) {
    anomalies.push({
      id: 'anom_unmapped',
      level: 'info',
      type: '数据映射缺失',
      target: '产品映射表',
      title: `存在 ${unmappedSkuCount} 个未匹配Walmart销售SKU`,
      description: '未映射SKU数据已完全计入全店销售，但无法归集至SPU及产品类型层级。',
      suggestedAction: '前往【数据质量中心】下载未匹配SKU清单，补齐并重新上传产品映射表。',
    });
  }

  return {
    filteredRecords,
    kpis,
    aggregatedByTime,
    aggregatedByProductType,
    aggregatedBySpu,
    aggregatedBySku,
    timeComparison,
    anomalies,
    maxDateFound,
  };
}
