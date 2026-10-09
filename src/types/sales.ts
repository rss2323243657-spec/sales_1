// Type definitions for Walmart US ERP Sales Analytics Workbench

export interface RawOrderRow {
  sheetName?: string;
  orderId?: string | number;
  orderTime?: string;
  onlineProductSKU?: string;
  internalSKU?: string;
  productCost?: number;
  platformStatus?: string;
  orderedQuantity?: number;
  shippedQuantity?: number;
  unitPrice?: number;
  originalPrice?: number;
  orderAmount?: number;
  preTaxAmount?: number;
  [key: string]: any;
}

export interface StandardSalesRecord {
  id: string; // generated unique id
  orderId: string;
  orderTime: string; // ISO date string or YYYY-MM-DD HH:mm:ss
  dateOnly: string; // YYYY-MM-DD
  year: number;
  month: string; // YYYY-MM
  quarter: string; // YYYY-Q1
  week: string; // YYYY-W32
  onlineProductSKU: string; // Walmart platform selling SKU (primary SKU)
  internalSKU: string; // ERP internal product code
  SPU: string; // Mapped SPU or 'Unmapped'
  productType: string; // Mapped Category or 'Unmapped'
  productCost: number; // Unit product cost
  platformStatus: string;
  orderedQuantity: number;
  shippedQuantity: number;
  unitPrice: number;
  finalSales: number; // shippedQuantity * unitPrice
  salesQuantity: number; // shippedQuantity
  salesCost: number; // shippedQuantity * productCost
  basicGrossProfit: number; // finalSales - salesCost
  basicGrossMargin: number; // basicGrossProfit / finalSales
  averageSellingPrice: number; // finalSales / salesQuantity
  isQtyMismatched: boolean; // orderedQuantity !== shippedQuantity
  isUnmapped: boolean;
  isDemoData?: boolean;
  sheetSource?: string;
  fileName?: string;
}

export interface ExcludedRecord {
  id: string;
  orderId: string;
  orderTime: string;
  onlineProductSKU: string;
  internalSKU: string;
  platformStatus: string;
  unitPrice: number;
  orderedQuantity: number;
  shippedQuantity: number;
  excludeReason: 'Platform Status = Cancelled' | 'Unit Price = 0' | 'Missing Required Fields' | 'Invalid Date' | string;
  sheetSource?: string;
  fileName?: string;
  raw: any;
}

export interface AdjustmentRecord {
  id: string;
  orderId: string;
  onlineProductSKU: string;
  internalSKU: string;
  orderedQuantity: number;
  shippedQuantity: number;
  unitPrice: number;
  rawCalculatedAmount: number; // orderedQuantity * unitPrice
  finalSales: number; // shippedQuantity * unitPrice
  diffAmount: number; // finalSales - rawCalculatedAmount
  orderTime: string;
}

export interface ProductMappingItem {
  SKU: string; // Corresponds to onlineProductSKU
  SPU: string;
  productType: string;
}

export interface ProcessingLog {
  id: string;
  timestamp: string;
  fileName: string;
  totalSheets: number;
  detectedOrderSheets: string[];
  ignoredSheets: string[];
  rawCount: number;
  cancelledCount: number;
  zeroPriceCount: number;
  qtyMismatchCount: number;
  unmappedSkuCount: number;
  duplicateCount: number;
  validSalesCount: number;
  totalSalesAmount: number;
}

export interface KPIOverview {
  finalSales: number;
  salesQuantity: number;
  salesCost: number;
  basicGrossProfit: number;
  basicGrossMargin: number;
  averageSellingPrice: number;
  orderCount: number;
  activeOnlineSkuCount: number;
  activeSpuCount: number;
  activeProductTypeCount: number;
}

export interface TimeComparison {
  priorSales: number | null;
  priorQty: number | null;
  momSalesChange: number | null; // % change
  momQtyChange: number | null; // % change
  lastYearSales: number | null;
  lastYearQty: number | null;
  yoySalesChange: number | null; // % change
  yoyQtyChange: number | null; // % change
  priorLabel?: string;
  currentLabel?: string;
}

export interface FilterState {
  timeGranularity: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  selectedDateRange: [string, string]; // [start, end]
  productHierarchy: 'all' | 'productType' | 'spu' | 'sku';
  selectedProductType: string; // 'ALL' or specific
  selectedSpu: string; // 'ALL' or specific
  selectedOnlineSku: string; // 'ALL' or specific
  onlineSkuSearch: string;
  spuSearch: string;
  internalSkuSearch: string;
  globalSearch: string;
  primaryMetric: 'finalSales' | 'salesQuantity' | 'salesCost' | 'basicGrossProfit' | 'basicGrossMargin' | 'averageSellingPrice';
}

export interface AggregatedRow {
  key: string;
  label: string;
  onlineProductSKU?: string;
  internalSKU?: string;
  SPU?: string;
  productType?: string;
  salesQuantity: number;
  finalSales: number;
  salesCost: number;
  basicGrossProfit: number;
  basicGrossMargin: number;
  averageSellingPrice: number;
  orderCount: number;
  sharePercentage?: number;
  growthMoM?: number | null;
}

export interface AnomalyItem {
  id: string;
  level: 'warning' | 'danger' | 'info';
  type: string;
  target: string;
  title: string;
  description: string;
  suggestedAction: string;
}
