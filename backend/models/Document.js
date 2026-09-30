import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
  description: String,
  quantity: Number,
  unitPrice: Number,
  amount: Number,
});

const documentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fileName: String,
  documentType: {
    type: String,
    default: 'Tax Invoice',
  },
  vendor: {
    name: String,
    taxId: String,
  },
  invoiceNumber: String,
  invoiceDate: String,
  lineItems: [lineItemSchema],
  financials: {
    subtotal: Number,
    taxAmount: Number,
    totalAmount: Number,
  },
  audit: {
    mathCheckPassed: Boolean,
    discrepancy: Number,
    flags: [String],
    riskLevel: {
      type: String,
      enum: ['LOW', 'HIGH'],
    },
  },
  executiveSummary: String,
  disputeDraft: String,
  erpStatus: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Document = mongoose.model('Document', documentSchema);
export default Document;
