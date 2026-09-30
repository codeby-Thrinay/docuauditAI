import { GoogleGenAI } from '@google/genai';
import Document from '../models/Document.js';

export const getSafeMimeType = (file) => {
  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (['tif', 'tiff'].includes(ext)) return 'image/tiff';
  if (ext === 'bmp') return 'image/bmp';
  if (['txt', 'text', 'log', 'rtf'].includes(ext)) return 'text/plain';
  if (['csv', 'tsv'].includes(ext)) return 'text/csv';

  const mime = (file.mimetype || '').toLowerCase();
  if (mime.includes('pdf')) return 'application/pdf';
  if (mime.includes('png')) return 'image/png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'image/jpeg';
  if (mime.includes('webp')) return 'image/webp';
  if (mime.includes('csv')) return 'text/csv';
  if (mime.includes('text') || mime.includes('plain')) return 'text/plain';

  return file.mimetype || 'application/pdf';
};

// Resilient multi-model executor with automatic fallback
export const generateWithModelFallback = async (ai, contents) => {
  const candidateModels = [
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ];

  let lastError = null;
  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await ai.models.generateContent({ model, contents });
        return resp;
      } catch (err) {
        lastError = err;
        const msg = err.message || '';
        if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        break;
      }
    }
  }
  throw lastError;
};

export const analyzeDocument = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ error: 'No file uploaded or file is empty.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const mimeType = getSafeMimeType(req.file);
    const isTextDoc = mimeType.startsWith('text/');

    const extractionPrompt = `You are an expert accounting auditor and document classification system for DocuAudit AI.
Analyze the uploaded document (which may be a PDF document, image file, text file (.txt), or CSV document (.csv)).

STAGE 1: DOCUMENT VALIDITY CLASSIFICATION
Determine with high precision whether the document is a valid invoice/billing document or an invalid document.

VALIDITY CRITERIA:
- VALID (isValidDocument: true):
  * The document is any legitimate financial or billing document: Tax Invoice, Commercial Invoice, Proforma Invoice, Sales Receipt, POS/Cash Register Receipt, Store/Restaurant/Fuel Receipt, Utility Bill (electric, water, gas, telecom), Purchase Order, Credit/Debit Note, Freight/Logistics Bill, Text-based Invoice, or Transaction Statement / Ledger export.
  * Even if the document is scanned, photographed, skewed, thermal-printed, handwritten, simplified, or in another language or currency, or represented as a plain text (.txt) / CSV (.csv) receipt/invoice, IF it represents a bill, receipt, or invoice, it MUST be classified as VALID (isValidDocument: true).
  * DO NOT flag genuine receipts, invoices, or billing text as invalid!

- INVALID (isValidDocument: false):
  * The document is a blank or empty page / picture with nothing on it ("picture with nothing", empty text file, solid color, blank canvas).
  * The document is a non-document photo (such as people, selfies, pets, landscapes, scenery, vehicles, food without receipt, memes, artwork, desktop screenshots, social media).
  * The document is completely unrelated to billing or finance (such as personal resumes/CVs, academic papers, essays, novels, source code files, driver licenses or passports without billing data).
  * The document is completely blurred, blacked out, or corrupted such that no financial details or text can be discerned.

STAGE 2: DATA EXTRACTION (If valid)
If valid, extract the vendor, invoice details, itemized line items, subtotal, tax amount, total amount, and concise executive summary.

Return ONLY a valid JSON object matching this exact schema — no markdown backticks, no code blocks, no other text:
{
  "isValidDocument": boolean,
  "invalidReason": "A clear, specific explanation if invalid, or null if valid",
  "documentType": "Tax Invoice | Commercial Invoice | Receipt | Utility Bill | Purchase Order | Text Invoice | Invalid Document",
  "vendor": {
    "name": "string",
    "taxId": "string or null"
  },
  "invoiceNumber": "string",
  "invoiceDate": "string (YYYY-MM-DD or as printed)",
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "amount": number
    }
  ],
  "subtotal": number,
  "taxAmount": number,
  "totalAmount": number,
  "executiveSummary": "A concise 2-3 sentence summary of this document."
}`;

    // Structure contents appropriately for text docs vs images/PDFs
    let contents;
    if (isTextDoc) {
      const textContent = req.file.buffer.toString('utf-8');
      contents = [
        {
          parts: [
            { text: `DOCUMENT TYPE: Text Document (${req.file.originalname})\nDOCUMENT CONTENT:\n${textContent}` },
            { text: extractionPrompt },
          ],
        },
      ];
    } else {
      contents = [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: req.file.buffer.toString('base64'),
              },
            },
            { text: extractionPrompt },
          ],
        },
      ];
    }

    const extractionResponse = await generateWithModelFallback(ai, contents);

    const rawText = extractionResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'Gemini did not return valid JSON.', raw: rawText });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validation check: ensure pictures with nothing / non-documents are flagged as invalid
    const hasAnyFinancialData = !!(
      (parsed.vendor?.name && parsed.vendor.name.trim()) ||
      (parsed.lineItems && parsed.lineItems.length > 0) ||
      (parsed.totalAmount && Number(parsed.totalAmount) > 0) ||
      (parsed.invoiceNumber && parsed.invoiceNumber.trim())
    );

    if (parsed.isValidDocument === false || (!parsed.isValidDocument && !hasAnyFinancialData)) {
      return res.status(400).json({
        error: `Invalid Document: ${parsed.invalidReason || 'The uploaded file is not a valid invoice, bill, or receipt.'}`,
        isInvalidDocument: true,
        invalidReason: parsed.invalidReason || 'The uploaded file does not contain invoice or billing information.',
        fileName: req.file.originalname,
        documentType: parsed.documentType || 'Invalid Document',
      });
    }

    // Process compute only for valid documents
    const statedTotal = Number((parsed.totalAmount || 0).toFixed(2));
    const subtotal = Number((parsed.subtotal || 0).toFixed(2));
    const taxAmount = Number((parsed.taxAmount || 0).toFixed(2));
    const hasSubtotalOrTax = subtotal > 0 || taxAmount > 0;
    const calculatedTotal = Number((subtotal + taxAmount).toFixed(2));
    const mathMismatch = hasSubtotalOrTax && statedTotal > 0 && Math.abs(calculatedTotal - statedTotal) > 0.05;

    const audit = {
      mathCheckPassed: !mathMismatch,
      discrepancy: mathMismatch ? Number((statedTotal - calculatedTotal).toFixed(2)) : 0,
      flags: [],
      riskLevel: 'LOW',
    };

    if (mathMismatch) {
      audit.flags.push('Arithmetic discrepancy: Subtotal + Tax does not match Total');
    }
    if (!parsed.vendor?.taxId && (parsed.documentType === 'Tax Invoice' || parsed.documentType === 'Commercial Invoice')) {
      audit.flags.push('Vendor Tax Registration ID missing on Tax/Commercial Invoice');
    }

    audit.riskLevel = mathMismatch || audit.flags.length > 0 ? 'HIGH' : 'LOW';

    let disputeDraft = '';
    if (audit.riskLevel === 'HIGH') {
      const disputePrompt = `Draft a professional 3-paragraph vendor dispute email for the following invoice issue.
Invoice Number: ${parsed.invoiceNumber || 'N/A'}
Vendor: ${parsed.vendor?.name || 'Unknown Vendor'}
Issues found: ${audit.flags.join('; ')}
Arithmetic discrepancy amount: ${audit.discrepancy}

Write the email in a formal but polite tone. Include a clear subject line at the top.`;

      const disputeResponse = await generateWithModelFallback(ai, [{ parts: [{ text: disputePrompt }] }]);

      disputeDraft = disputeResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }

    const savedDoc = await Document.create({
      user: req.user.id,
      fileName: req.file.originalname,
      documentType: parsed.documentType || 'Tax Invoice',
      vendor: {
        name: parsed.vendor?.name || '',
        taxId: parsed.vendor?.taxId || '',
      },
      invoiceNumber: parsed.invoiceNumber || '',
      invoiceDate: parsed.invoiceDate || '',
      lineItems: (parsed.lineItems || []).map((item) => ({
        description: item.description || '',
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
        amount: item.amount || 0,
      })),
      financials: {
        subtotal: parsed.subtotal || 0,
        taxAmount: parsed.taxAmount || 0,
        totalAmount: parsed.totalAmount || 0,
      },
      audit,
      executiveSummary: parsed.executiveSummary || '',
      disputeDraft,
      erpStatus: '',
    });

    return res.json(savedDoc);
  } catch (err) {
    console.error('analyzeDocument error:', err);
    return res.status(500).json({ error: err.message });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.json(documents);
  } catch (err) {
    console.error('getDocuments error:', err);
    return res.status(500).json({ error: err.message });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const allDocs = await Document.find({ user: req.user.id });

    const totalDocuments = allDocs.length;

    const totalSpend = Number(
      allDocs
        .reduce((sum, doc) => sum + (doc.financials?.totalAmount || 0), 0)
        .toFixed(2)
    );

    const totalDiscrepanciesCaught = Number(
      allDocs
        .reduce((sum, doc) => sum + Math.abs(doc.audit?.discrepancy || 0), 0)
        .toFixed(2)
    );

    const lowRiskCount = allDocs.filter((doc) => doc.audit?.riskLevel === 'LOW').length;
    const highRiskCount = allDocs.filter((doc) => doc.audit?.riskLevel === 'HIGH').length;

    return res.json({
      totalDocuments,
      totalSpend,
      totalDiscrepanciesCaught,
      lowRiskCount,
      highRiskCount,
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    return res.status(500).json({ error: err.message });
  }
};

export const chatWithDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const doc = await Document.findOne({ _id: id, user: req.user.id });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }

    const calculatedTotal = Number(
      ((doc.financials?.subtotal || 0) + (doc.financials?.taxAmount || 0)).toFixed(2)
    );

    const docContext = JSON.stringify({
      vendor: doc.vendor,
      invoiceNumber: doc.invoiceNumber,
      invoiceDate: doc.invoiceDate,
      lineItems: doc.lineItems,
      financials: doc.financials,
      calculatedTotal,
      discrepancyAmount: doc.audit?.discrepancy,
      flags: doc.audit?.flags,
      riskLevel: doc.audit?.riskLevel,
    }, null, 2);

    const prompt = `You are DocuAudit Copilot. Answer financial, tax, and auditing questions strictly based on the provided document data concisely and clearly.

Document Data:
${docContext}

Auditor Question: ${question}`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await generateWithModelFallback(ai, [{ parts: [{ text: prompt }] }]);

    const reply = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return res.json({ reply });
  } catch (err) {
    console.error('chatWithDocument error:', err);
    return res.status(500).json({ error: err.message });
  }
};

export const syncToERP = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Document.findOneAndUpdate(
      { _id: id, user: req.user.id },
      { erpStatus: 'Synced to ERP' },
      { new: true }
    );
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }
    return res.json(doc);
  } catch (err) {
    console.error('syncToERP error:', err);
    return res.status(500).json({ error: err.message });
  }
};
