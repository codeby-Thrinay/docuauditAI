import { GoogleGenAI } from '@google/genai';
import Document from '../models/Document.js';

export const analyzeDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const extractionPrompt = `You are an expert accounting auditor. Analyze the following invoice document image and extract all relevant data.

Return ONLY a valid JSON object with this exact structure — no markdown, no code fences, no extra text:
{
  "documentType": "Tax Invoice",
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
  "executiveSummary": "A concise 2-3 sentence summary of this invoice for an executive review."
}`;

    const extractionResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: req.file.mimetype,
                data: req.file.buffer.toString('base64'),
              },
            },
            { text: extractionPrompt },
          ],
        },
      ],
    });

    const rawText = extractionResponse.candidates[0].content.parts[0].text.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'Gemini did not return valid JSON.', raw: rawText });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const calculatedTotal = Number(((parsed.subtotal || 0) + (parsed.taxAmount || 0)).toFixed(2));
    const statedTotal = Number((parsed.totalAmount || 0).toFixed(2));
    const mathMismatch = Math.abs(calculatedTotal - statedTotal) > 0.05;

    const audit = {
      mathCheckPassed: !mathMismatch,
      discrepancy: mathMismatch ? Number((statedTotal - calculatedTotal).toFixed(2)) : 0,
      flags: [],
      riskLevel: 'LOW',
    };

    if (mathMismatch) {
      audit.flags.push('Arithmetic discrepancy: Subtotal + Tax does not match Total');
    }
    if (!parsed.vendor?.taxId) {
      audit.flags.push('Vendor Tax Registration ID missing');
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

      const disputeResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: disputePrompt }] }],
      });

      disputeDraft = disputeResponse.candidates[0].content.parts[0].text.trim();
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });

    const reply = response.candidates[0].content.parts[0].text.trim();
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
