const mongoose = require("mongoose");

const historicalSaleSchema = new mongoose.Schema(
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

    transactionDate: {
      type: Date,
      required: true,
    },

    salesType: {
      type: String,
      trim: true,
    },

    isReturn: {
      type: Boolean,
      default: false,
    },

    reasonOfReturn: {
      type: String,
      trim: true,
    },

    supplier: {
      type: String,
      trim: true,
    },

    productDivision: {
      type: String,
      trim: true,
    },

    productCategory: {
      type: String,
      trim: true,
    },

    productSubcategory: {
      type: String,
      trim: true,
    },

    productSegment: {
      type: String,
      trim: true,
    },

    salesChannel: {
      type: String,
      trim: true,
    },

    quantitySold: {
      type: Number,
      required: true,
    },

    salesAmount: {
      type: Number,
      required: true,
    },

    cogs: {
      type: Number,
      required: true,
    },

    numberOfTransactions: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

historicalSaleSchema.index({
  product: 1,
  store: 1,
  transactionDate: 1,
});

module.exports = mongoose.model("HistoricalSale", historicalSaleSchema);
