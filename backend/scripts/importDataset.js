const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { parse } = require("csv-parse");

const Product = require("../models/Product");
const Store = require("../models/Store");
const Inventory = require("../models/Inventory");
const HistoricalSale = require("../models/HistoricalSale");
const HistoricalInventory = require("../models/HistoricalInventory");

const INVENTORY_CSV = path.resolve(
  __dirname,
  "../../data/raw/retail_inventory_ml_apl.csv"
);
const SALES_CSV = path.resolve(
  __dirname,
  "../../data/raw/retail_sales_ml_apl.csv"
);
const DATASET_SOURCE_ID = "retail-inventory-ml-apl-v1";
const SAMPLE_PRODUCT_SKUS = [
  "RICE-5KG-001",
  "SHAMP-001",
  "BISC-001",
  "MILK-1L-001",
];
const END_OF_DATASET = "9999-12-31";
const BATCH_SIZE = 1000;
const DEFAULT_REORDER_LEVEL = 10;
const APPLY_IMPORT = process.argv.includes("--apply");
const INVENTORY_FIELDS = [
  "Start Date",
  "End Date",
  "Stock Status",
  "Supplier",
  "Product No",
  "Product Description",
  "Product Division",
  "Product Category",
  "Product Subcategory",
  "Product Segment",
  "Store",
  "Store Type",
  "Sales Channel",
  "Qty on hand",
  "Stocks Selling Amount",
  "Cost of Stocks",
  "Stock Unit Selling Price",
  "Stock Unit Cost Price",
];
const SALES_FIELDS = [
  "Transaction Date",
  "Sales Type",
  "Is Return",
  "Reason of Return",
  "Supplier",
  "Product No",
  "Product Description",
  "Product Division",
  "Product Category",
  "Product Subcategory",
  "Product Segment",
  "Store",
  "Sales Channel",
  "Qty Sold",
  "Sales Amount",
  "Cogs",
  "Number of Transactions",
];

const emptyCounts = () => ({
  rows: 0,
  negativeQuantities: 0,
  negativeAmounts: 0,
  negativeCogs: 0,
  invalidOpenEndedCandidates: 0,
  validOpenEndedCandidates: 0,
  openEndedRows: 0,
  returns: 0,
});

const readCsv = async function* (filePath, expectedHeaders) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: (headers) => {
        const missing = expectedHeaders.filter((field) => !headers.includes(field));
        if (missing.length) {
          throw new Error(
            `${path.basename(filePath)} is missing required columns: ${missing.join(", ")}`
          );
        }
        return headers;
      },
      skip_empty_lines: true,
      trim: true,
      bom: true,
    })
  );

  for await (const row of parser) {
    yield row;
  }
};

const toNumber = (value, fieldName, rowNumber) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`Missing ${fieldName} at data row ${rowNumber}`);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid ${fieldName} at data row ${rowNumber}: ${value}`);
  }
  return number;
};

const toDate = (value, fieldName, rowNumber) => {
  if (!value) {
    throw new Error(`Missing ${fieldName} at data row ${rowNumber}`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName} at data row ${rowNumber}: ${value}`);
  }
  return date;
};

const toEndDate = (value, rowNumber) =>
  value === END_OF_DATASET ? null : toDate(value, "End Date", rowNumber);

const toBoolean = (value, fieldName, rowNumber) => {
  if (value !== "0" && value !== "1") {
    throw new Error(`Invalid ${fieldName} at data row ${rowNumber}: ${value}`);
  }
  return value === "1";
};

const nonempty = (value) => (value && value.trim() ? value.trim() : undefined);

const sourceRecordId = (sourceFile, rowNumber) => {
  const key = `${DATASET_SOURCE_ID}:${sourceFile}:${rowNumber}`;
  const hexId = crypto.createHash("sha256").update(key).digest("hex").slice(0, 24);
  return new mongoose.Types.ObjectId(hexId);
};

const newCatalogEntry = (row) => ({
  sku: row["Product No"].trim(),
  name: row["Product Description"].trim(),
  category: row["Product Category"].trim(),
  supplier: nonempty(row.Supplier),
  description: nonempty(row["Product Description"]),
  division: nonempty(row["Product Division"]),
  subcategory: nonempty(row["Product Subcategory"]),
  segment: nonempty(row["Product Segment"]),
  priceVariants: new Set(),
  costVariants: new Set(),
  selectedPrice: null,
  selectedPriceDate: null,
  selectedCost: null,
  selectedCostDate: null,
  selectedPriceRow: 0,
  selectedCostRow: 0,
});

const addProductMetadata = (entry, row, rowNumber) => {
  const fields = [
    ["name", "Product Description"],
    ["category", "Product Category"],
    ["supplier", "Supplier"],
    ["division", "Product Division"],
    ["subcategory", "Product Subcategory"],
    ["segment", "Product Segment"],
  ];
  for (const [key, field] of fields) {
    const value = nonempty(row[field]);
    if (value && entry[key] && entry[key] !== value) {
      throw new Error(
        `Conflicting ${field} for SKU ${entry.sku} at inventory data row ${rowNumber}`
      );
    }
    if (value) entry[key] = value;
  }
};

const selectLatestValidPrice = (entry, row, rowNumber, counts) => {
  const startDate = toDate(row["Start Date"], "Start Date", rowNumber);
  for (const [field, valueKey, dateKey, rowKey] of [
    ["Stock Unit Selling Price", "selectedPrice", "selectedPriceDate", "selectedPriceRow"],
    ["Stock Unit Cost Price", "selectedCost", "selectedCostDate", "selectedCostRow"],
  ]) {
    const value = toNumber(row[field], field, rowNumber);
    const variants = field === "Stock Unit Selling Price" ? entry.priceVariants : entry.costVariants;
    variants.add(value);
    if (value <= 0) {
      counts.invalidPriceValues += 1;
      continue;
    }
    if (
      !entry[dateKey] ||
      startDate > entry[dateKey] ||
      (startDate.getTime() === entry[dateKey].getTime() && rowNumber > entry[rowKey])
    ) {
      entry[valueKey] = value;
      entry[dateKey] = startDate;
      entry[rowKey] = rowNumber;
    }
  }
};

const validateInventoryRow = (row, rowNumber, counts) => {
  const sku = nonempty(row["Product No"]);
  const storeCode = nonempty(row.Store);
  if (!sku || !storeCode) {
    throw new Error(`Missing Product No or Store at inventory data row ${rowNumber}`);
  }

  const quantity = toNumber(row["Qty on hand"], "Qty on hand", rowNumber);
  toDate(row["Start Date"], "Start Date", rowNumber);
  toEndDate(row["End Date"], rowNumber);
  toNumber(row["Stocks Selling Amount"], "Stocks Selling Amount", rowNumber);
  toNumber(row["Cost of Stocks"], "Cost of Stocks", rowNumber);
  toNumber(row["Stock Unit Selling Price"], "Stock Unit Selling Price", rowNumber);
  toNumber(row["Stock Unit Cost Price"], "Stock Unit Cost Price", rowNumber);
  if (!row["Product Description"].trim() || !row["Product Category"].trim()) {
    throw new Error(`Missing product name/category at inventory data row ${rowNumber}`);
  }

  counts.rows += 1;
  if (quantity < 0) counts.negativeQuantities += 1;
  if (row["End Date"] === END_OF_DATASET) {
    counts.openEndedRows += 1;
    if (quantity < 0) counts.invalidOpenEndedCandidates += 1;
    else counts.validOpenEndedCandidates += 1;
  }

  return { sku, storeCode, quantity };
};

const validateSalesRow = (row, rowNumber, counts) => {
  const sku = nonempty(row["Product No"]);
  const storeCode = nonempty(row.Store);
  if (!sku || !storeCode) {
    throw new Error(`Missing Product No or Store at sales data row ${rowNumber}`);
  }

  toDate(row["Transaction Date"], "Transaction Date", rowNumber);
  const quantity = toNumber(row["Qty Sold"], "Qty Sold", rowNumber);
  const salesAmount = toNumber(row["Sales Amount"], "Sales Amount", rowNumber);
  const cogs = toNumber(row.Cogs, "Cogs", rowNumber);
  toNumber(row["Number of Transactions"], "Number of Transactions", rowNumber);
  const isReturn = toBoolean(row["Is Return"], "Is Return", rowNumber);
  if (quantity < 0) counts.negativeQuantities += 1;
  if (salesAmount < 0) counts.negativeAmounts += 1;
  if (cogs < 0) counts.negativeCogs += 1;
  if (isReturn) counts.returns += 1;
  counts.rows += 1;
  return { sku, storeCode };
};

const updatePriceSelection = (entry, row, rowNumber, counts) => {
  selectLatestValidPrice(entry, row, rowNumber, counts);
};

const validateProductCatalog = (catalog) => {
  for (const entry of catalog.values()) {
    if (!entry.selectedPriceDate || !entry.selectedCostDate) {
      throw new Error(
        `No positive selling/cost price available for dataset SKU ${entry.sku}`
      );
    }
  }
};

const makeHistoricalInventoryDocument = (row, productId, storeId, rowNumber) => ({
  product: productId,
  store: storeId,
  startDate: toDate(row["Start Date"], "Start Date", rowNumber),
  endDate: toEndDate(row["End Date"], rowNumber),
  stockStatus: nonempty(row["Stock Status"]),
  supplier: nonempty(row.Supplier),
  salesChannel: nonempty(row["Sales Channel"]),
  quantityOnHand: toNumber(row["Qty on hand"], "Qty on hand", rowNumber),
  stocksSellingAmount: toNumber(row["Stocks Selling Amount"], "Stocks Selling Amount", rowNumber),
  costOfStocks: toNumber(row["Cost of Stocks"], "Cost of Stocks", rowNumber),
  unitSellingPrice: toNumber(row["Stock Unit Selling Price"], "Stock Unit Selling Price", rowNumber),
  unitCostPrice: toNumber(row["Stock Unit Cost Price"], "Stock Unit Cost Price", rowNumber),
});

const makeHistoricalSaleDocument = (row, productId, storeId, rowNumber) => ({
  product: productId,
  store: storeId,
  transactionDate: toDate(row["Transaction Date"], "Transaction Date", rowNumber),
  salesType: nonempty(row["Sales Type"]),
  isReturn: toBoolean(row["Is Return"], "Is Return", rowNumber),
  reasonOfReturn: nonempty(row["Reason of Return"]),
  supplier: nonempty(row.Supplier),
  productDivision: nonempty(row["Product Division"]),
  productCategory: nonempty(row["Product Category"]),
  productSubcategory: nonempty(row["Product Subcategory"]),
  productSegment: nonempty(row["Product Segment"]),
  salesChannel: nonempty(row["Sales Channel"]),
  quantitySold: toNumber(row["Qty Sold"], "Qty Sold", rowNumber),
  salesAmount: toNumber(row["Sales Amount"], "Sales Amount", rowNumber),
  cogs: toNumber(row.Cogs, "Cogs", rowNumber),
  numberOfTransactions: toNumber(row["Number of Transactions"], "Number of Transactions", rowNumber),
});

const mapLimit = (array, size) => {
  const result = [];
  for (let offset = 0; offset < array.length; offset += size) {
    result.push(array.slice(offset, offset + size));
  }
  return result;
};

const requireUniqueStoreRecords = (stores, codes) => {
  const byCode = new Map();
  for (const store of stores) {
    if (!codes.has(store.code)) continue;
    if (byCode.has(store.code)) {
      throw new Error(`Duplicate Store.code exists in MongoDB: ${store.code}`);
    }
    byCode.set(store.code, store);
  }
  return byCode;
};

const printPriceVariants = (catalog) => {
  const products = [...catalog.values()].filter(
    (product) => product.priceVariants.size > 1 || product.costVariants.size > 1
  );
  const fieldVariantCount = products.reduce(
    (total, product) =>
      total +
      Number(product.priceVariants.size > 1) +
      Number(product.costVariants.size > 1),
    0
  );
  console.log(`SKU price fields with multiple observed values: ${fieldVariantCount}`);
  console.log("Observed product price variants (unique values; selected value in brackets):");
  for (const product of products) {
    const sellingVariants = [...product.priceVariants].sort((a, b) => a - b);
    const costVariants = [...product.costVariants].sort((a, b) => a - b);
    console.log(
      `SKU ${product.sku} | Selling price variants: ${sellingVariants.join(", ")} ` +
        `(selected ${product.selectedPrice}) | Cost price variants: ${costVariants.join(", ")} ` +
        `(selected ${product.selectedCost})`
    );
  }
  return products;
};

const printCsvAuditSummary = (catalog, storeCodes, inventoryCounts, salesCounts, activePairs) => {
  console.log("");
  console.log("========================================");
  console.log("CSV Validation Summary");
  console.log("========================================");
  console.log(`Inventory CSV rows: ${inventoryCounts.rows}`);
  console.log(`Sales CSV rows: ${salesCounts.rows}`);
  console.log(`Unique dataset SKUs: ${catalog.size}`);
  console.log(`Unique dataset Store codes: ${storeCodes.size}`);
  console.log(`Returns preserved: ${salesCounts.returns}`);
  console.log(`Negative sales quantities preserved: ${salesCounts.negativeQuantities}`);
  console.log(`Historical negative inventory quantities preserved: ${inventoryCounts.negativeQuantities}`);
  console.log(`Open-ended inventory rows: ${inventoryCounts.openEndedRows}`);
  console.log(`Valid operational inventory candidates: ${inventoryCounts.validOpenEndedCandidates}`);
  console.log(`Negative open-ended inventory quarantined: ${inventoryCounts.invalidOpenEndedCandidates}`);
  console.log(`Unique valid Product + Store pairs: ${activePairs}`);
  console.log("");
  console.log("Product price selection:");
  console.log("Use the latest nonnegative value by Start Date for each SKU and price field.");
  console.log("On a same-date tie, use the last CSV row; all observed variants are listed.");
  printPriceVariants(catalog);
  console.log("");
};

const main = async () => {
  console.log("========================================");
  console.log("StockSense Dataset Import Audit");
  console.log("========================================");
  console.log(`DRY RUN: ${!APPLY_IMPORT}`);
  console.log("");

  const catalog = new Map();
  const storeCodes = new Set();
  const inventoryCounts = emptyCounts();
  inventoryCounts.invalidPriceValues = 0;
  const activeInventoryByPair = new Map();
  const openEndedInventoryPairs = new Set();

  console.log("Scanning inventory CSV...");
  let inventoryRowNumber = 0;
  for await (const row of readCsv(INVENTORY_CSV, INVENTORY_FIELDS)) {
    inventoryRowNumber += 1;
    const { sku, storeCode, quantity } = validateInventoryRow(
      row,
      inventoryRowNumber,
      inventoryCounts
    );
    storeCodes.add(storeCode);
    let entry = catalog.get(sku);
    if (!entry) {
      entry = newCatalogEntry(row);
      catalog.set(sku, entry);
    }
    addProductMetadata(entry, row, inventoryRowNumber);
    updatePriceSelection(entry, row, inventoryRowNumber, inventoryCounts);

    if (row["End Date"] === END_OF_DATASET) {
      const key = `${sku}\u0000${storeCode}`;
      if (openEndedInventoryPairs.has(key)) {
        throw new Error(
          `Duplicate open-ended inventory for SKU ${sku}, store ${storeCode}`
        );
      }
      openEndedInventoryPairs.add(key);
      if (quantity >= 0) {
        activeInventoryByPair.set(key, {
          sku,
          storeCode,
          quantity,
          lastUpdated: toDate(row["Start Date"], "Start Date", inventoryRowNumber),
        });
      }
    }
  }

  validateProductCatalog(catalog);

  const salesCounts = emptyCounts();
  const salesSkus = new Set();
  const salesStores = new Set();
  console.log("Scanning sales CSV...");
  let salesRowNumber = 0;
  for await (const row of readCsv(SALES_CSV, SALES_FIELDS)) {
    salesRowNumber += 1;
    const { sku, storeCode } = validateSalesRow(row, salesRowNumber, salesCounts);
    salesSkus.add(sku);
    salesStores.add(storeCode);
    if (!catalog.has(sku)) {
      throw new Error(`Sales SKU ${sku} at row ${salesRowNumber} is absent from inventory CSV`);
    }
    if (!storeCodes.has(storeCode)) {
      throw new Error(`Sales store ${storeCode} at row ${salesRowNumber} is absent from inventory CSV`);
    }
  }

  if (salesSkus.size !== catalog.size) {
    console.warn(
      `Warning: sales use ${salesSkus.size} of ${catalog.size} inventory-catalog SKUs.`
    );
  }
  if (salesStores.size !== storeCodes.size) {
    console.warn(
      `Warning: sales use ${salesStores.size} of ${storeCodes.size} inventory dataset stores.`
    );
  }
  if (
    catalog.size !== 2326 ||
    storeCodes.size !== 40 ||
    inventoryCounts.rows !== 284755 ||
    salesCounts.rows !== 125751 ||
    salesCounts.returns !== 7491 ||
    inventoryCounts.openEndedRows !== 22701 ||
    inventoryCounts.validOpenEndedCandidates !== 22380 ||
    inventoryCounts.invalidOpenEndedCandidates !== 321
  ) {
    throw new Error(
      "Dataset counts do not match the audited source; no import attempted."
    );
  }

  const sampleCollisions = [...catalog.keys()].filter((sku) =>
    SAMPLE_PRODUCT_SKUS.includes(sku)
  );
  if (sampleCollisions.length) {
    throw new Error(
      `Dataset SKU collides with protected sample product(s): ${sampleCollisions.join(", ")}`
    );
  }

  if (!process.env.MONGO_URI) {
    printCsvAuditSummary(
      catalog,
      storeCodes,
      inventoryCounts,
      salesCounts,
      activeInventoryByPair.size
    );
    throw new Error("MONGO_URI is not configured; cannot verify existing products/stores.");
  }

  console.log("");
  console.log("Connecting read-only for Product/Store preflight...");
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 30000 });
  } catch (error) {
    printCsvAuditSummary(
      catalog,
      storeCodes,
      inventoryCounts,
      salesCounts,
      activeInventoryByPair.size
    );
    console.error("Existing Product/Store verification: unavailable (read-only connection failed).");
    console.error("Database writes: 0");
    throw error;
  }
  try {
    const skuList = [...catalog.keys()];
    const [existingProducts, existingStores, existingSamples] = await Promise.all([
      Product.find({ sku: { $in: skuList } }).select("sku").lean(),
      Store.find({ code: { $in: [...storeCodes] } }).select("_id code").lean(),
      Product.find({ sku: { $in: SAMPLE_PRODUCT_SKUS } }).select("sku").lean(),
    ]);
    const existingSampleSkus = new Set(existingSamples.map((product) => product.sku));
    const missingSampleSkus = SAMPLE_PRODUCT_SKUS.filter(
      (sku) => !existingSampleSkus.has(sku)
    );
    if (missingSampleSkus.length) {
      throw new Error(
        `Protected sample Product SKU(s) missing from MongoDB: ${missingSampleSkus.join(", ")}`
      );
    }
    const existingSkuSet = new Set(existingProducts.map((product) => product.sku));
    const storesByCode = requireUniqueStoreRecords(existingStores, storeCodes);
    const missingStores = [...storeCodes].filter((code) => !storesByCode.has(code));
    if (missingStores.length) {
      throw new Error(
        `Dataset Store code(s) missing from StockSense: ${missingStores.join(", ")}. No import attempted.`
      );
    }

    const newProducts = [...catalog.values()].filter(
      (product) => !existingSkuSet.has(product.sku)
    );
    const preservedProducts = [...catalog.keys()].filter((sku) =>
      existingSkuSet.has(sku)
    );

    const priceVariantProducts = [...catalog.values()].filter(
      (product) => product.priceVariants.size > 1 || product.costVariants.size > 1
    );
    const pricingVariantCount = priceVariantProducts.reduce(
      (total, product) =>
        total +
        Number(product.priceVariants.size > 1) +
        Number(product.costVariants.size > 1),
      0
    );

    console.log("");
    console.log("========================================");
    console.log("StockSense Dataset Import Audit");
    console.log("========================================");
    console.log(`DRY RUN: ${!APPLY_IMPORT}`);
    console.log("");
    console.log("Inventory CSV:");
    console.log(`Rows: ${inventoryCounts.rows}`);
    console.log("");
    console.log("Sales CSV:");
    console.log(`Rows: ${salesCounts.rows}`);
    console.log("");
    console.log("Products:");
    console.log(`Unique dataset SKUs: ${catalog.size}`);
    console.log(`New dataset products: ${newProducts.length}`);
    console.log(`Existing products preserved: ${preservedProducts.length}`);
    console.log(`Protected sample products preserved: ${existingSampleSkus.size}`);
    console.log(`SKU price fields with multiple observed values: ${pricingVariantCount}`);
    console.log(`Non-positive price observations ignored for catalog price: ${inventoryCounts.invalidPriceValues}`);
    console.log("");
    console.log("Stores:");
    console.log(`Dataset stores: ${storeCodes.size}`);
    console.log(`Existing stores verified: ${storesByCode.size}`);
    console.log("Missing stores: 0");
    console.log("Store writes: 0");
    console.log("");
    console.log("Historical Sales:");
    console.log(`Rows to import: ${salesCounts.rows}`);
    console.log(`Returns preserved: ${salesCounts.returns}`);
    console.log(`Negative sales quantities preserved: ${salesCounts.negativeQuantities}`);
    console.log("");
    console.log("Historical Inventory:");
    console.log(`Rows to import: ${inventoryCounts.rows}`);
    console.log(`Historical negative quantities preserved: ${inventoryCounts.negativeQuantities}`);
    console.log("");
    console.log("Operational Inventory:");
    console.log(`Open-ended rows: ${inventoryCounts.openEndedRows}`);
    console.log(`Valid operational rows: ${inventoryCounts.validOpenEndedCandidates}`);
    console.log(`Negative rows quarantined: ${inventoryCounts.invalidOpenEndedCandidates}`);
    console.log(`Unique valid Product + Store pairs: ${activeInventoryByPair.size}`);
    console.log("");
    console.log("Product price selection:");
    console.log("For each SKU and price field, use the latest nonnegative value by Start Date.");
    console.log("When latest dates tie, use the last CSV row; all observed variants are reported below.");
    console.log("");
    if (priceVariantProducts.length) {
      console.log("Observed product price variants (unique values; selected value in brackets):");
      for (const product of priceVariantProducts) {
        const sellingVariants = [...product.priceVariants].sort((a, b) => a - b);
        const costVariants = [...product.costVariants].sort((a, b) => a - b);
        console.log(
          `SKU ${product.sku} | Selling price variants: ${sellingVariants.join(", ")} ` +
            `(selected ${product.selectedPrice}) | Cost price variants: ${costVariants.join(", ")} ` +
            `(selected ${product.selectedCost})`
        );
      }
    } else {
      console.log("No price variation found.");
    }
    console.log("");

    if (!APPLY_IMPORT) {
      console.log("Database writes: 0");
      console.log("Existing Sale collection: untouched");
      console.log("Existing sample Inventory: untouched");
      console.log("Existing Store records and geographic mappings: untouched");
      console.log("");
      console.log("========================================");
      console.log("DRY RUN COMPLETE");
      console.log("No database changes were made.");
      console.log("========================================");
      return;
    }

    const storeIdByCode = new Map(
      [...storesByCode].map(([code, store]) => [code, store._id])
    );
    const productIdBySku = new Map(
      existingProducts.map((product) => [product.sku, product._id])
    );

      console.log("");
      console.log("Applying dataset Products...");
      for (const batch of mapLimit(newProducts, BATCH_SIZE)) {
        const operations = batch.map((product) => ({
          insertOne: {
            document: {
              name: product.name,
              sku: product.sku,
              category: product.category,
              price: product.selectedPrice,
              costPrice: product.selectedCost,
              reorderLevel: DEFAULT_REORDER_LEVEL,
              supplier: product.supplier,
              description: product.description,
            },
          },
        }));
        if (operations.length) {
          await Product.bulkWrite(operations, { ordered: true });
        }
      }

      const resolvedProducts = await Product.find({ sku: { $in: skuList } })
        .select("_id sku")
        .lean();
      for (const product of resolvedProducts) {
        productIdBySku.set(product.sku, product._id);
      }
      if (productIdBySku.size !== catalog.size) {
        throw new Error("Product verification failed after creation; import stopped.");
      }

      console.log("Upserting HistoricalSale rows...");
      let saleBatch = [];
      let saleRow = 0;
      for await (const row of readCsv(SALES_CSV, SALES_FIELDS)) {
        saleRow += 1;
        const productId = productIdBySku.get(row["Product No"].trim());
        const storeId = storeIdByCode.get(row.Store.trim());
        if (!productId || !storeId) {
          throw new Error(`Unresolved Product/Store reference at sales data row ${saleRow}`);
        }
        const id = sourceRecordId("retail_sales_ml_apl.csv", saleRow + 1);
        saleBatch.push({
          updateOne: {
            filter: { _id: id },
            update: {
              $set: makeHistoricalSaleDocument(row, productId, storeId, saleRow),
            },
            upsert: true,
          },
        });
        if (saleBatch.length === BATCH_SIZE) {
          await HistoricalSale.collection.bulkWrite(saleBatch, {
            ordered: false,
          });
          saleBatch = [];
        }
      }
      if (saleBatch.length) {
        await HistoricalSale.collection.bulkWrite(saleBatch, {
          ordered: false,
        });
      }

      console.log("Upserting HistoricalInventory rows...");
      let historicalInventoryBatch = [];
      let inventoryRow = 0;
      for await (const row of readCsv(INVENTORY_CSV, INVENTORY_FIELDS)) {
        inventoryRow += 1;
        const productId = productIdBySku.get(row["Product No"].trim());
        const storeId = storeIdByCode.get(row.Store.trim());
        if (!productId || !storeId) {
          throw new Error(
            `Unresolved Product/Store reference at inventory data row ${inventoryRow}`
          );
        }
        const id = sourceRecordId("retail_inventory_ml_apl.csv", inventoryRow + 1);
        historicalInventoryBatch.push({
          updateOne: {
            filter: { _id: id },
            update: {
              $set: makeHistoricalInventoryDocument(
                row,
                productId,
                storeId,
                inventoryRow
              ),
            },
            upsert: true,
          },
        });
        if (historicalInventoryBatch.length === BATCH_SIZE) {
          await HistoricalInventory.collection.bulkWrite(
            historicalInventoryBatch,
            { ordered: false }
          );
          historicalInventoryBatch = [];
        }
      }
      if (historicalInventoryBatch.length) {
        await HistoricalInventory.collection.bulkWrite(
          historicalInventoryBatch,
          { ordered: false }
        );
      }

      console.log("Upserting valid open-ended operational Inventory rows...");
      const inventoryOperations = [...activeInventoryByPair.values()].map((entry) => {
        const productId = productIdBySku.get(entry.sku);
        const storeId = storeIdByCode.get(entry.storeCode);
        if (!productId || !storeId) {
          throw new Error(
            `Unresolved Product/Store reference for operational inventory SKU ${entry.sku}`
          );
        }
        return {
          updateOne: {
            filter: { product: productId, store: storeId },
            update: {
              $set: {
                quantity: entry.quantity,
                reorderLevel: DEFAULT_REORDER_LEVEL,
                lastUpdated: entry.lastUpdated,
              },
            },
            upsert: true,
          },
        };
      });
      for (const batch of mapLimit(inventoryOperations, BATCH_SIZE)) {
        if (batch.length) {
          await Inventory.bulkWrite(batch, { ordered: false });
        }
      }

    console.log("Dataset import completed.");
  } finally {
    await mongoose.disconnect();
  }
};

main().catch(async (error) => {
  console.error("");
  console.error("DATASET IMPORT AUDIT FAILED");
  console.error(error.message);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  process.exitCode = 1;
});
