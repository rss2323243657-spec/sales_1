import * as XLSX from 'xlsx';
import { ProductMappingItem } from '../types/sales';

// Standard demo product mapping
export const DEMO_PRODUCT_MAPPINGS: ProductMappingItem[] = [
  // PET1005 SPU - Harness
  { SKU: 'PET1005-XS-BLK', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-S-BLK', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-M-BLK', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-L-BLK', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-XL-BLK', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-M-RED', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },
  { SKU: 'PET1005-L-RED', SPU: 'PET1005', productType: 'Harness (背带鞍背)' },

  // PET2008 SPU - Dog Toy
  { SKU: 'PET2008-BALL-BLU', SPU: 'PET2008', productType: 'Dog Toy (咬胶玩具)' },
  { SKU: 'PET2008-BALL-ORN', SPU: 'PET2008', productType: 'Dog Toy (咬胶玩具)' },
  { SKU: 'PET2008-ROPE-TRI', SPU: 'PET2008', productType: 'Dog Toy (咬胶玩具)' },
  { SKU: 'PET2008-SQUEAK-DUC', SPU: 'PET2008', productType: 'Dog Toy (咬胶玩具)' },

  // PET3012 SPU - Training Leash
  { SKU: 'PET3012-5FT-BLK', SPU: 'PET3012', productType: 'Training (牵引训练绳)' },
  { SKU: 'PET3012-6FT-REF', SPU: 'PET3012', productType: 'Training (牵引训练绳)' },
  { SKU: 'PET3012-10FT-TRN', SPU: 'PET3012', productType: 'Training (牵引训练绳)' },

  // PET4050 SPU - Grooming Brush
  { SKU: 'PET4050-DESHED-GRN', SPU: 'PET4050', productType: 'Grooming (宠物美容梳)' },
  { SKU: 'PET4050-SLICKER-BLU', SPU: 'PET4050', productType: 'Grooming (宠物美容梳)' },

  // PET6001 SPU - Smart Pet Feeder
  { SKU: 'PET6001-AUTO-WIFI', SPU: 'PET6001', productType: 'Smart Pet (智能喂食器)' },
  { SKU: 'PET6001-CAMERA-4L', SPU: 'PET6001', productType: 'Smart Pet (智能喂食器)' },
];

export function createDemoOrderWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Helper to generate rows for a given month
  const generateMonthRows = (yearMonth: string, count: number, orderIdPrefix: string) => {
    const rows = [];
    const skuCatalog = [
      { online: 'PET1005-M-BLK', internal: 'PET1005', price: 23.99, cost: 7.2 },
      { online: 'PET1005-L-BLK', internal: 'PET1005', price: 25.99, cost: 7.8 },
      { online: 'PET1005-S-BLK', internal: 'PET1005', price: 21.99, cost: 6.5 },
      { online: 'PET1005-XL-BLK', internal: 'PET1005', price: 28.99, cost: 8.9 },
      { online: 'PET1005-M-RED', internal: 'PET1005', price: 23.99, cost: 7.2 },
      { online: 'PET2008-BALL-BLU', internal: 'PET2008', price: 12.99, cost: 2.8 },
      { online: 'PET2008-BALL-ORN', internal: 'PET2008', price: 12.99, cost: 2.8 },
      { online: 'PET2008-ROPE-TRI', internal: 'PET2008', price: 15.5, cost: 3.6 },
      { online: 'PET3012-6FT-REF', internal: 'PET3012', price: 18.99, cost: 4.5 },
      { online: 'PET3012-5FT-BLK', internal: 'PET3012', price: 16.99, cost: 4.1 },
      { online: 'PET4050-DESHED-GRN', internal: 'PET4050', price: 19.99, cost: 5.2 },
      { online: 'PET6001-AUTO-WIFI', internal: 'PET6001', price: 69.99, cost: 28.0 },
      // Intentional unmapped SKU for real-world verification
      { online: 'PET9999-NEW-BOWL', internal: 'PET9999', price: 14.99, cost: 3.5 },
    ];

    for (let i = 1; i <= count; i++) {
      const day = String(Math.min(28, Math.floor((i % 28) + 1))).padStart(2, '0');
      const hour = String(Math.floor((i * 7) % 24)).padStart(2, '0');
      const min = String(Math.floor((i * 13) % 60)).padStart(2, '0');
      const sec = String(Math.floor((i * 23) % 60)).padStart(2, '0');
      const orderTime = `${yearMonth}-${day} ${hour}:${min}:${sec}`;

      const item = skuCatalog[i % skuCatalog.length];
      const orderId = `${orderIdPrefix}${String(10000 + i)}`;

      // Realistic business edge cases:
      // ~4% Cancelled
      let platformStatus = 'Shipped';
      if (i % 25 === 0) {
        platformStatus = 'Cancelled';
      }

      // ~3% Multi-channel zero price
      let unitPrice = item.price;
      if (i % 33 === 0 && platformStatus !== 'Cancelled') {
        unitPrice = 0;
      }

      // Ordered quantity
      let orderedQty = 1;
      if (i % 7 === 0) orderedQty = 2;
      if (i % 19 === 0) orderedQty = 3;

      // Shipped quantity: ~6% has difference (ordered 3, shipped 2; or ordered 2, shipped 1)
      let shippedQty = orderedQty;
      if (i % 17 === 0 && orderedQty > 1) {
        shippedQty = orderedQty - 1;
      }

      rows.push({
        订单号: orderId,
        下单时间: orderTime,
        线上商品SKU: item.online,
        SKU: item.internal,
        平台状态: platformStatus,
        商品SKU数量: orderedQty,
        发货数量: shippedQty,
        商品单价: unitPrice,
        商品成本: item.cost,
        原价: item.price * 1.1,
        税前金额: (shippedQty * unitPrice).toFixed(2),
        订单金额: (shippedQty * unitPrice).toFixed(2),
      });
    }

    return rows;
  };

  // Sheet 1: 2026-08 订单数据 (Order Sheet)
  const rowsAug = generateMonthRows('2026-08', 280, 'WM2608-');
  const wsAug = XLSX.utils.json_to_sheet(rowsAug);
  XLSX.utils.book_append_sheet(wb, wsAug, '2026-08订单');

  // Sheet 2: 2026-09 订单数据 (Order Sheet)
  const rowsSep = generateMonthRows('2026-09', 320, 'WM2609-');
  const wsSep = XLSX.utils.json_to_sheet(rowsSep);
  XLSX.utils.book_append_sheet(wb, wsSep, '2026-09订单');

  // Sheet 3: 2026-10 订单数据 (Order Sheet)
  const rowsOct = generateMonthRows('2026-10', 160, 'WM2610-');
  const wsOct = XLSX.utils.json_to_sheet(rowsOct);
  XLSX.utils.book_append_sheet(wb, wsOct, '2026-10实时订单');

  // Sheet 4: 系统导出说明 (Non-order sheet - tests multi-sheet auto filtering!)
  const metaRows = [
    { 导出信息: 'Walmart US ERP 自动化销售导出', 导出人: 'Walmart_Ops_Team', 导出时间: '2026-10-08 23:00:00' },
    { 导出信息: '注意事项: 请勿修改线上商品SKU与SKU字段映射关系', 导出人: 'System', 导出时间: '' },
    { 导出信息: '本Sheet为元数据配置，系统将根据表头自动忽略', 导出人: 'System', 导出时间: '' },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, '导出说明_Meta');

  return wb;
}

export function createDemoMappingWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const rows = DEMO_PRODUCT_MAPPINGS.map((m) => ({
    线上商品SKU: m.SKU,
    SPU: m.SPU,
    产品类型: m.productType,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '产品映射表');
  return wb;
}
