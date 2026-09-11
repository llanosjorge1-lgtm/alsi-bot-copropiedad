const fs = require('fs');
const path = require('path');

const SEED_STORE_PATH = path.join(__dirname, 'data', 'store.json');
const SEED_PAYMENTS_PATH = path.join(__dirname, 'data', 'company_payments.json');

function getStoreDir() {
  const volumeDir = path.join(__dirname, 'baileys_auth_info');
  if (fs.existsSync(volumeDir)) {
    const volDbDir = path.join(volumeDir, 'db_storage');
    if (!fs.existsSync(volDbDir)) {
      try {
        fs.mkdirSync(volDbDir, { recursive: true });
      } catch (e) {}
    }
    return volDbDir;
  }
  const localDataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(localDataDir)) {
    try {
      fs.mkdirSync(localDataDir, { recursive: true });
    } catch (e) {}
  }
  return localDataDir;
}

function getStorePath() {
  return path.join(getStoreDir(), 'store.json');
}

function getCompanyPaymentsPath() {
  return path.join(getStoreDir(), 'company_payments.json');
}

function readDb() {
  const storePath = getStorePath();
  let db = null;

  if (fs.existsSync(storePath)) {
    try {
      const raw = fs.readFileSync(storePath, 'utf-8');
      db = JSON.parse(raw);
    } catch (err) {
      console.error("Error leyendo store.json persistente:", err);
    }
  }

  const isEmpty = !db || ((!db.appointments || db.appointments.length === 0) && (!db.incidents || db.incidents.length === 0));
  if (isEmpty && fs.existsSync(SEED_STORE_PATH)) {
    try {
      const seedRaw = fs.readFileSync(SEED_STORE_PATH, 'utf-8');
      const seedDb = JSON.parse(seedRaw);
      if (seedDb && ((seedDb.appointments && seedDb.appointments.length > 0) || (seedDb.incidents && seedDb.incidents.length > 0))) {
        db = seedDb;
        writeDb(db);
        return db;
      }
    } catch (seedErr) {
      console.error("Error cargando seed store:", seedErr);
    }
  }

  if (!db) {
    db = {
      appointments: [],
      vouchers: [],
      clients: [],
      pendingRequests: [],
      incidents: [],
      receipts: [],
      settings: {}
    };
    writeDb(db);
  }

  db.appointments = db.appointments || [];
  db.vouchers = db.vouchers || [];
  db.clients = db.clients || [];
  db.pendingRequests = db.pendingRequests || [];
  db.incidents = db.incidents || [];
  db.receipts = db.receipts || [];
  db.settings = db.settings || {};

  return db;
}

function writeDb(data) {
  try {
    const storePath = getStorePath();
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
    if (storePath !== SEED_STORE_PATH && fs.existsSync(path.join(__dirname, 'data'))) {
      try {
        fs.writeFileSync(SEED_STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
      } catch (e) {}
    }
  } catch (err) {
    console.error("Error escribiendo store.json:", err);
  }
}

function readCompanyPayments() {
  const payPath = getCompanyPaymentsPath();
  if (fs.existsSync(payPath)) {
    try {
      const raw = fs.readFileSync(payPath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error("Error leyendo company_payments persistente:", err);
    }
  }

  if (fs.existsSync(SEED_PAYMENTS_PATH)) {
    try {
      const raw = fs.readFileSync(SEED_PAYMENTS_PATH, 'utf-8');
      const data = JSON.parse(raw);
      writeCompanyPayments(data);
      return data;
    } catch (err) {}
  }

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
  writeCompanyPayments(defaultPayments);
  return defaultPayments;
}

function writeCompanyPayments(data) {
  try {
    const payPath = getCompanyPaymentsPath();
    fs.writeFileSync(payPath, JSON.stringify(data, null, 2), 'utf-8');
    if (payPath !== SEED_PAYMENTS_PATH && fs.existsSync(path.join(__dirname, 'data'))) {
      try {
        fs.writeFileSync(SEED_PAYMENTS_PATH, JSON.stringify(data, null, 2), 'utf-8');
      } catch (e) {}
    }
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
