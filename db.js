const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'data', 'store.json');
const COMPANY_PAYMENTS_PATH = path.join(__dirname, 'data', 'company_payments.json');

function ensureDataDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readDb() {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    const initialDb = {
      appointments: [],
      vouchers: [],
      clients: [],
      pendingRequests: [],
      incidents: [],
      receipts: [],
      settings: {}
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const db = JSON.parse(raw);
    db.pendingRequests = db.pendingRequests || [];
    db.incidents = db.incidents || [];
    db.receipts = db.receipts || [];
    return db;
  } catch (err) {
    console.error("Error leyendo store.json:", err);
    return { appointments: [], vouchers: [], clients: [], pendingRequests: [], incidents: [], receipts: [], settings: {} };
  }
}

function writeDb(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error escribiendo store.json:", err);
  }
}

function readCompanyPayments() {
  ensureDataDir();
  if (!fs.existsSync(COMPANY_PAYMENTS_PATH)) {
    const defaultPayments = {
      alsi: {
        companyId: "alsi",
        companyName: "ALSI Administración - Condominio Portada Norte VII",
        bankName: "Banco de Chile",
        accountType: "Cuenta Corriente",
        accountNumber: "99-12345-01",
        rut: "77.654.321-K",
        holderName: "ALSI Administración Copropiedad",
        emailNotification: "contactoalsiadministracion@gmail.com",
        instructions: "Transfiera el valor de su gasto común indicando su número de departamento en el asunto."
      }
    };
    fs.writeFileSync(COMPANY_PAYMENTS_PATH, JSON.stringify(defaultPayments, null, 2), 'utf-8');
    return defaultPayments;
  }

  try {
    const raw = fs.readFileSync(COMPANY_PAYMENTS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error leyendo company_payments.json:", err);
    return {};
  }
}

function writeCompanyPayments(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(COMPANY_PAYMENTS_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error escribiendo company_payments.json:", err);
  }
}

function getCompanyPaymentDetails() {
  const allPayments = readCompanyPayments();
  return allPayments.alsi || {
    companyId: "alsi",
    companyName: "ALSI Administración - Condominio Portada Norte VII",
    bankName: "Banco de Chile",
    accountType: "Cuenta Corriente",
    accountNumber: "99-12345-01",
    rut: "77.654.321-K",
    holderName: "ALSI Administración Copropiedad",
    emailNotification: "contactoalsiadministracion@gmail.com",
    instructions: "Transfiera el valor de su gasto común indicando su número de departamento en el asunto."
  };
}

function readPendingRequests() {
  const db = readDb();
  return db.pendingRequests || [];
}

function addPendingRequest(reqData) {
  const db = readDb();
  db.pendingRequests = db.pendingRequests || [];
  const newReq = {
    id: `req-${Date.now()}`,
    condoName: reqData.condoName || "Condominio Portada Norte VII",
    clientName: reqData.clientName || "Residente",
    unitNumber: reqData.unitNumber || "Por Especificar",
    requestType: reqData.requestType || "Atención de Copropiedad",
    details: reqData.details || "Solicitud de atención capturada",
    status: "Pendiente de Atención",
    createdAt: new Date().toISOString()
  };
  db.pendingRequests.unshift(newReq);
  writeDb(db);
  return newReq;
}

function resolvePendingRequest(id) {
  const db = readDb();
  db.pendingRequests = db.pendingRequests || [];
  const item = db.pendingRequests.find(r => r.id === id);
  if (item) {
    item.status = "Resuelto / Atendido";
    item.resolvedAt = new Date().toISOString();
    writeDb(db);
    return { success: true, item };
  }
  return { success: false, message: "Solicitud no encontrada" };
}

module.exports = {
  readDb,
  writeDb,
  readCompanyPayments,
  writeCompanyPayments,
  getCompanyPaymentDetails,
  readPendingRequests,
  addPendingRequest,
  resolvePendingRequest
};
