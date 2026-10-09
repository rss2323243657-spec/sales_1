import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));

// Server-side Gemini initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint for Walmart US Sales AI Diagnostic Analysis
app.post('/api/ai-analyze', async (req, res) => {
  try {
    const {
      analysisContext,
      kpis,
      topGainers,
      topDecliners,
      productTypes,
      timeComparison,
      selectedFilters,
      skuDetails,
    } = req.body;

    if (!analysisContext && !kpis) {
      return res.status(400).json({ error: 'Missing analysis context' });
    }

    const systemInstruction = `你是一名资深的 Walmart US 资深运营专家兼电商数据分析师。
你的职责是基于用户当前筛选的【真实 Walmart ERP 销售数据】进行深入、严谨、面向运营决策的诊断分析。

【严格遵守以下规则】：
1. 绝对严禁使用虚构数据或泛泛而谈（如“受市场环境影响”、“建议持续关注”、“加大品牌宣传”等无意义废话）。
2. 分析必须遵循逻辑链条：
   【数据事实】 -> 【数据推断】 -> 【可能原因】 -> 【需要进一步验证的数据】 -> 【具体运营行动】。
3. 严格区分“线上商品SKU”（Walmart销售SKU，onlineProductSKU）与“公司内部SKU”（internalSKU）。
4. 核心销售额统一口径为 finalSales (发货数量 shippedQuantity × 商品单价 unitPrice)，销售量为 salesQuantity (发货数量)。
5. 针对销量与销售额关系剖析：
   - 销量下降 + 销售额下降：提示下滑主要由销量驱动，但由于系统当前无流量数据，不可直接武断断言“广告效果差”或“流量暴跌”，应指出需结合流量/广告数据验证；
   - 销量增长 + 销售额下降：重点分析平均销售价格 (ASP) 下跌及折扣/降价影响；
   - 销量下降 + 销售额增长：重点分析客单价/销售单价提升对销量的抑制效应；
   - 销量增长 + 销售额增长：分析主力推动 SKU/SPU 及动销健康度。
6. 输出内容必须包含以下 6 个结构化板块（使用清晰 Markdown 格式与关键指标高亮）：
   一、整体销售表现概括（销售额、环比/同比、销量、毛利率、ASP）
   二、业绩增长主要来源（TOP增长SKU/SPU/类型，具体增量与贡献）
   三、业绩下滑主要来源（TOP下滑SKU/SPU/类型，具体降幅）
   四、量额关系与客单价(ASP)深度剖析
   五、严谨归因（明确列出“已证实数据事实”与“需验证推测假说”，标注需要补充验证的数据字段，如广告ACOS、WFS库存覆盖天数、搜索排名）
   六、针对性 Walmart 运营落地建议（按紧急程度与责任模块分类：价格与促销调整、库存备货预警、产品线优化）。`;

    const userPrompt = `请对以下 Walmart US ERP 真实销售统计数据进行深度诊断分析：

【筛选条件】：
- 时间维度/范围: ${selectedFilters?.timeRange || '全部'} (粒度: ${selectedFilters?.granularity || '月'})
- 产品类型筛选: ${selectedFilters?.productType || '全店'}
- SPU筛选: ${selectedFilters?.spu || '全部'}
- SKU筛选: ${selectedFilters?.onlineSku || '全部'}

【核心KPI汇总】：
- 最终销售额 (finalSales): $${kpis?.finalSales?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0}
- 销售量 (salesQuantity): ${kpis?.salesQuantity?.toLocaleString() || 0} 件
- 销售成本 (salesCost): $${kpis?.salesCost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0}
- 基础毛利 (basicGrossProfit): $${kpis?.basicGrossProfit?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0}
- 基础毛利率: ${kpis?.basicGrossMargin != null ? (kpis.basicGrossMargin * 100).toFixed(2) + '%' : 'N/A'}
- 平均销售单价 (ASP): $${kpis?.averageSellingPrice != null ? kpis.averageSellingPrice.toFixed(2) : 'N/A'}
- 订单数: ${kpis?.orderCount || 0}
- 动销 Walmart销售SKU数: ${kpis?.activeOnlineSkuCount || 0}
- 动销 SPU数: ${kpis?.activeSpuCount || 0}

【环比 (MoM) 与 同比 (YoY) 比较】：
${timeComparison ? JSON.stringify(timeComparison, null, 2) : '暂无对比数据'}

【TOP增长产品/SKU】：
${topGainers && topGainers.length > 0 ? JSON.stringify(topGainers, null, 2) : '无明显增长记录'}

【TOP下滑产品/SKU】：
${topDecliners && topDecliners.length > 0 ? JSON.stringify(topDecliners, null, 2) : '无明显下滑记录'}

【产品类型销售构成】：
${productTypes ? JSON.stringify(productTypes, null, 2) : '无类别构成'}

${skuDetails ? `【单SKU深度上下文】:\n${JSON.stringify(skuDetails, null, 2)}` : ''}

请开始输出专业运营诊断报告。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    const reportText = response.text || '未能生成分析报告';
    return res.json({ report: reportText });
  } catch (err: any) {
    console.error('Gemini Analysis Error:', err);
    return res.status(500).json({
      error: 'AI诊断生成失败',
      details: err?.message || '未知错误',
    });
  }
});

// Vite middleware in dev or static files in prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Walmart US ERP Analytics Server running on http://localhost:${PORT}`);
  });
}

startServer();
