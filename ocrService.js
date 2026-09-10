const { createVoucher } = require('./voucherService');
const { readDb, writeDb } = require('./db');

/**
 * Procesa la recepción y verificación de comprobantes de pago de Gastos Comunes para ALSI Copropiedad
 */
async function processPaymentReceipt({ message, clientName, unitNumber, condoName = "Condominio Portada Norte VII", adminEmail = 'contactoalsiadministracion@gmail.com' }) {
  const db = readDb();
  if (!db.receipts) db.receipts = [];

  let opNumber = `N° ${Math.floor(100000 + Math.random() * 900000)}`;
  const opMatch = message.match(/(?:comprobante|transferencia|operacion|operación|n°|nro)\s*[:#]?\s*(\d{5,12})/i);
  if (opMatch && opMatch[1]) {
    opNumber = `N° ${opMatch[1]}`;
  }

  let amountStr = 'Monto por Verificar';
  const amountMatch = message.match(/(?:\$|clp)\s*([\d.]{4,10})/i) || message.match(/(\d{2,3}\.\d{3})/);
  if (amountMatch && amountMatch[1]) {
    amountStr = `$${amountMatch[1]} CLP`;
  }

  const receiptCode = `GCM-${Date.now().toString().slice(-6)}`;

  const voucher = await createVoucher({
    clientName: `${clientName || 'Residente'} (Depto ${unitNumber || '09'})`,
    clientPhone: '+56977665544',
    industry: 'alsi',
    voucherType: `Comprobante de Gasto Común ALSI (${condoName})`,
    discountOrAmount: `Pago Recibido (${amountStr}) | Transf. ${opNumber} | Depto ${unitNumber || '09'}`,
    propertyAddress: condoName
  });

  const receiptRecord = {
    id: receiptCode,
    clientName: clientName || 'Residente',
    unitNumber: unitNumber || '09',
    operationNumber: opNumber,
    amountStr: amountStr,
    voucherCode: voucher.code,
    status: 'Verificado',
    adminEmail,
    createdAt: new Date().toISOString()
  };

  db.receipts.unshift(receiptRecord);
  writeDb(db);

  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (n8nWebhookUrl) {
    try {
      await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'PAYMENT_RECEIPT_SUBMITTED',
          emailSubject: 'comprobante de pago',
          receiptCode,
          clientName,
          unitNumber,
          operationNumber: opNumber,
          amountStr,
          voucherCode: voucher.code,
          adminEmail
        })
      });
      console.log(`🧾 Comprobante de gasto común ${receiptCode} despachado a n8n!`);
    } catch (e) {
      console.error("Error enviando comprobante ALSI a n8n:", e.message);
    }
  }

  const nameTag = clientName ? `@${clientName}` : 'Residente';
  const replyText = `🧾 **COMPROBANTE DE GASTO COMÚN VERIFICADO** 💳✨\n\n` +
    `Estimado/a **${nameTag}** (Depto **${unitNumber}**):\n` +
    `Hemos recibido exitosamente el comprobante de pago de tu gasto común.\n\n` +
    `• 🏦 **N° Operación / Transf.**: \`${opNumber}\`\n` +
    `• 💵 **Monto Declarado**: **${amountStr}**\n` +
    `• 🎟️ **Código de Validación QR**: \`${voucher.code}\`\n` +
    `• 🚦 **Estado de Recepción**: **Registrado & Verificado por Administración ALSI**\n` +
    `• 📩 **Copia enviada a finanzas**: \`${adminEmail}\`\n\n` +
    `El recibo oficial de dinero será adjunto a tu ficha de copropietario. ¡Muchas gracias por tu pago oportuno! 🏢✨`;

  return {
    success: true,
    receipt: receiptRecord,
    voucher,
    reply: replyText
  };
}

module.exports = {
  processPaymentReceipt
};
