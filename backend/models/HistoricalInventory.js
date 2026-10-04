const mongoose = require("mongoose");

const historicalInventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
    },

    stockStatus: {
      type: String,
      trim: true,
    },

    supplier: {
      type: String,
      trim: true,
    },

    salesChannel: {
      type: String,
      trim: true,
    },

    quantityOnHand: {
      type: Number,
      required: true,
    },

    stocksSellingAmount: {
      type: Number,
      required: true,
    },

    costOfStocks: {
      type: Number,
      required: true,
    },

    unitSellingPrice: {
      type: Number,
      required: true,
    },

    unitCostPrice: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

historicalInventorySchema.index({
  product: 1,
  store: 1,
  startDate: 1,
});

module.exports = mongoose.model(
  "HistoricalInventory",
  historicalInventorySchema
);
