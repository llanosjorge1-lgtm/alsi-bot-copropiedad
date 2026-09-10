const QRCode = require('qrcode');
const { readDb, writeDb } = require('./db');
const { randomBytes } = require('crypto');

function generateVoucherCode(prefix = 'ALS') {
  const num = Math.floor(1000 + Math.random() * 9000);
  const rand = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${rand}-${num}`;
}

const INDUSTRY_PASS_THEMES = {
  alsi: { bg: 'linear-gradient(135deg, #0284c7 0%, #0f172a 100%)', text: '#38bdf8', label: 'ALSI COPROPIEDAD PASS' }
};

const LEGAL_ANTI_FRAUD_DISCLAIMER = "⚠️ AVISO LEGAL DE SEGURIDAD: Este Voucher de atención de copropiedad está sujeto a validación de ALSI Administración.";

async function createVoucher({ 
  clientName, 
  clientPhone, 
  industry = 'alsi', 
  voucherType, 
  discountOrAmount, 
  expirationDays = 30,
  propertyAddress = 'Condominio Portada Norte VII',
  nightsCount = 0,
  subtotal = 0,
  iva = 0,
  totalPrice = 0,
  paymentProofUrl
}) {
  const db = readDb();
  
  const code = generateVoucherCode('ALS');
  const id = `vch-${Date.now()}`;
  
  const expDate = new Date();
  expDate.setDate(expDate.getDate() + expirationDays);
  const expirationDateStr = expDate.toISOString().split('T')[0];

  const theme = INDUSTRY_PASS_THEMES.alsi;

  const title = voucherType || 'Pase Digital de Atención ALSI Copropiedades';
  const benefit = discountOrAmount || 'Reunión de Atención Gratuita ($0)';

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(JSON.stringify({
      code,
      id,
      verifier: 'ALSI_CONDO_PASS'
    }), {
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      margin: 2,
      width: 350
    });
  } catch (err) {
    console.error('Error generando QR code:', err);
  }

  const walletPassData = {
    formatVersion: 1,
    passTypeIdentifier: "pass.com.alsiadministracion.condo",
    serialNumber: code,
    teamIdentifier: "ALSI_ADMINISTRACION",
    organizationName: "ALSI Administración Copropiedad",
    description: title,
    logoText: theme.label,
    backgroundColor: theme.bg,
    foregroundColor: theme.text,
    barcode: {
      format: "PKBarcodeFormatQR",
      message: code,
      messageEncoding: "iso-8859-1"
    },
    generic: {
      primaryFields: [
        { key: "paymentStatus", label: "ESTADO DE ATENCIÓN", value: "✅ REUNIÓN CONFIRMADA" },
        { key: "benefit", label: "RESIDENTE / COPROPIETARIO", value: clientName }
      ],
      secondaryFields: [
        { key: "address", label: "CONDOMINIO", value: propertyAddress || "Condominio Portada Norte VII" }
      ],
      auxiliaryFields: [
        { key: "code", label: "LLAVE DIGITAL / QR", value: code },
        { key: "legalNotice", label: "AVISO LEGAL", value: LEGAL_ANTI_FRAUD_DISCLAIMER }
      ]
    }
  };

  const voucher = {
    id,
    code,
    clientName: clientName || 'Residente ALSI',
    clientPhone: clientPhone || '+56977665544',
    industry: 'alsi',
    voucherType: title,
    discountOrAmount: benefit,
    expirationDate: expirationDateStr,
    propertyAddress: propertyAddress || 'Condominio Portada Norte VII',
    nightsCount,
    subtotal,
    iva,
    totalPrice,
    paymentProofUrl: paymentProofUrl || null,
    paymentConfirmed: true,
    paymentConfirmedStamp: "✅ REUNIÓN CONFIRMADA",
    legalDisclaimer: LEGAL_ANTI_FRAUD_DISCLAIMER,
    qrDataUrl,
    walletPassData,
    status: 'Activo',
    createdAt: new Date().toISOString()
  };

  db.vouchers.unshift(voucher);
  writeDb(db);

  return voucher;
}

function validateAndRedeemVoucher(codeOrId) {
  const db = readDb();
  const index = db.vouchers.findIndex(v => v.code === codeOrId || v.id === codeOrId);

  if (index === -1) {
    return { success: false, message: 'Voucher no encontrado. Código inválido.' };
  }

  const voucher = db.vouchers[index];

  if (voucher.status === 'Canjeado') {
    return { 
      success: false, 
      message: `El voucher ${voucher.code} ya fue VALIDADO el ${new Date(voucher.redeemedAt).toLocaleString()}.`,
      voucher
    };
  }

  voucher.status = 'Canjeado';
  voucher.redeemedAt = new Date().toISOString();
  db.vouchers[index] = voucher;
  writeDb(db);

  return {
    success: true,
    message: `¡Pase Digital ALSI ${voucher.code} validado exitosamente!`,
    voucher
  };
}

function getVouchers() {
  const db = readDb();
  return db.vouchers;
}

module.exports = {
  createVoucher,
  validateAndRedeemVoucher,
  getVouchers,
  LEGAL_ANTI_FRAUD_DISCLAIMER
};
