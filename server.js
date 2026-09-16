require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { connectToWhatsApp, getWhatsAppStatus, resetWhatsAppConnection, reconnectWhatsApp, sendCustomWhatsAppMessage } = require('./whatsappBaileys');
const { processMessage } = require('./agentEngine');
const { 
  readDb, 
  writeDb, 
  resetDbToZero,
  getCompanyPaymentDetails, 
  writeCompanyPayments, 
  readCompanyPayments, 
  readPendingRequests, 
  resolvePendingRequest,
  updateAppointmentCrm,
  getHabitaOpsReports,
  addHabitaOpsReport,
  deleteHabitaOpsReport
} = require('./db');
const { validateAndRedeemVoucher, getVouchers } = require('./voucherService');
const { startReminderCron } = require('./reminderCron');
const { verifyWebhook: verifyInstagramWebhook, handleWebhook: handleInstagramWebhook } = require('./instagramService');

// API Key for server-to-server and admin authentication
const ALSI_API_KEY = process.env.ALSI_API_KEY || 'alsi-ordena-secure-key-2026';

function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!apiKey || apiKey !== ALSI_API_KEY) {
    return res.status(401).json({ success: false, message: 'Acceso no autorizado. API Key requerida.' });
  }
  next();
}

const app = express();
const server = http.createServer(app);

const cors = require('cors');
app.use(cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Webhooks de Instagram Direct Messages (Meta Graph API)
app.get('/webhook/instagram', verifyInstagramWebhook);
app.post('/webhook/instagram', handleInstagramWebhook);

// Estado de WhatsApp & QR
app.get('/api/status', (req, res) => {
  const status = getWhatsAppStatus();
  res.json(status);
});

app.get('/api/whatsapp/status', (req, res) => {
  const status = getWhatsAppStatus();
  res.json(status);
});

// Envío de mensaje personalizado de WhatsApp (integración con Ordena)
app.post('/api/send-whatsapp', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, message: "Faltan parámetros 'phone' o 'message'" });
    }
    const result = await sendCustomWhatsAppMessage(phone, message);
    res.json(result);
  } catch (err) {
    console.error('Error enviando WhatsApp desde ALSI:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reinicio manual de WhatsApp (para vincular nuevo WhatsApp Business)
app.post('/api/reset-whatsapp', async (req, res) => {
  try {
    const result = await resetWhatsAppConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/qr/reset', async (req, res) => {
  try {
    await resetWhatsAppConnection();
    res.redirect('/qr');
  } catch (e) {
    res.status(500).send("Error al reiniciar la conexión de WhatsApp: " + e.message);
  }
});

app.get('/qr/reconnect', async (req, res) => {
  try {
    await reconnectWhatsApp();
    res.redirect('/qr');
  } catch (e) {
    res.status(500).send("Error al reconectar WhatsApp: " + e.message);
  }
});

app.get('/qr', (req, res) => {
  const status = getWhatsAppStatus();
  if (status.isConnected) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>WhatsApp Conectado - ALSI Copropiedad</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #fff; text-align: center; padding: 50px; }
          .card { background: #1e293b; border-radius: 16px; padding: 40px; display: inline-block; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 540px; border: 1px solid #10b981; }
          .icon { font-size: 60px; margin-bottom: 20px; }
          h1 { color: #10b981; margin-bottom: 10px; }
          p { color: #94a3b8; font-size: 16px; line-height: 1.5; }
          .btn-reconnect { margin-top:20px; margin-right:10px; display:inline-block; background:#10b981; color:#fff; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px; }
          .btn-reset { margin-top:20px; display:inline-block; background:#ef4444; color:#fff; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>WhatsApp Business Conectado</h1>
          <p>El Agente de IA para ALSI Administración (Portada Norte VII) está vinculado y activo respondiendo mensajes 24/7 en WhatsApp.</p>
          <div style="margin-top:24px;">
            <a href="/qr/reconnect" class="btn-reconnect">🔄 Refrescar Conexión</a>
            <a href="/qr/reset" class="btn-reset" onclick="return confirm('¿Desconectar y vincular con un nuevo número?')">🔴 Desconectar / Cambiar Número</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  return res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Vincular WhatsApp Business - ALSI Copropiedad</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #fff; text-align: center; padding: 40px 20px; }
        .card { background: #1e293b; border-radius: 20px; padding: 30px; display: inline-block; box-shadow: 0 15px 35px rgba(0,0,0,0.6); max-width: 460px; border: 1px solid rgba(255,255,255,0.1); }
        h1 { font-size: 22px; color: #25D366; margin-bottom: 15px; }
        .steps { text-align: left; background: #0f172a; padding: 15px 20px; border-radius: 12px; font-size: 14px; margin-bottom: 20px; border-left: 4px solid #25D366; }
        .steps ol { margin: 0; padding-left: 20px; }
        .steps li { margin-bottom: 6px; color: #cbd5e1; }
        .qr-box { background: #ffffff; padding: 15px; border-radius: 16px; display: inline-block; }
        .qr-box img { width: 280px; height: 280px; display: block; }
        .btn-reset { margin-top: 15px; display: inline-block; background: #0284c7; color: #fff; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: bold; }
      </style>
      <script>
        let currentQr = "${status.qrCodeDataUrl || ''}";
        setInterval(async () => {
          try {
            const r = await fetch('/api/whatsapp/status');
            const d = await r.json();
            if (d.isConnected) {
              window.location.reload();
            } else if (d.qrCodeDataUrl && d.qrCodeDataUrl !== currentQr) {
              currentQr = d.qrCodeDataUrl;
              const img = document.getElementById('qr-img');
              if (img) img.src = d.qrCodeDataUrl;
            }
          } catch(e) {}
        }, 2000);
      </script>
    </head>
    <body>
      <div class="card">
        <h1>Vincular WhatsApp ALSI Copropiedad</h1>
        <div class="steps">
          <ol>
            <li>Abre <strong>WhatsApp</strong> en el teléfono de atención de ALSI.</li>
            <li>Toca <strong>Menú / Configuración</strong> > <strong>Dispositivos Vinculados</strong>.</li>
            <li>Selecciona <strong>Vincular un dispositivo</strong> y escanea el QR:</li>
          </ol>
        </div>
        <div class="qr-box">
          ${status.qrCodeDataUrl ? `<img id="qr-img" src="${status.qrCodeDataUrl}" alt="QR WhatsApp ALSI">` : '<p style="color:#0f172a; font-weight:bold;">Generando código QR...</p>'}
        </div>
        <div>
          <a href="/qr/reset" class="btn-reset">🔄 Volver a Generar QR</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Simulador de Chat en vivo
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], senderPhone = '+56977665544', pushName = 'Residente Pruebas' } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: "Falta parámetro 'message'" });
    }

    const response = await processMessage({
      message,
      history,
      senderPhone,
      pushName
    });

    res.json({ success: true, ...response });
  } catch (err) {
    console.error("Error en simulador /api/chat ALSI:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Citas & Reuniones Agendadas
app.get('/api/appointments', (req, res) => {
  const db = readDb();
  res.json({ success: true, appointments: db.appointments || [] });
});

app.post('/api/appointments', (req, res) => {
  try {
    const { clientName, clientPhone, unitNumber, asunto, dateTime, serviceType } = req.body;
    const db = readDb();
    const newAppointment = {
      id: `apt-${Date.now()}`,
      clientName: clientName || 'Residente',
      clientPhone: clientPhone || '+56977665544',
      unitNumber: unitNumber || 'Por Especificar',
      asunto: asunto || 'Reunión de Atención ALSI',
      summary: `Reunión: ${clientName || 'Residente'} - Depto ${unitNumber || ''} - Asunto: ${asunto || 'Atención'}`,
      serviceType: serviceType || 'Reunión Presencial de Administración ALSI',
      propertyAddress: 'Condominio Portada Norte VII',
      dateTime: dateTime || 'Lunes 14 de septiembre (10:00 a 10:30 hrs)',
      status: 'Confirmada',
      paymentStatus: 'Confirmada (Gratuita)',
      createdAt: new Date().toISOString()
    };
    db.appointments.unshift(newAppointment);
    writeDb(db);
    res.json({ success: true, appointment: newAppointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/appointments/:id/cancel', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const item = (db.appointments || []).find(a => a.id === id);
  if (item) {
    item.status = 'Cancelada';
    item.canceledAt = new Date().toISOString();
    writeDb(db);
    return res.json({ success: true, appointment: item });
  }
  res.status(404).json({ success: false, message: 'Cita no encontrada' });
});

// Seguimiento CRM de Reuniones (Quién tomó la reunión, estado y resolución)
app.post('/api/appointments/:id/crm', (req, res) => {
  const { id } = req.params;
  const result = updateAppointmentCrm(id, req.body);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

// Incidencias / Reportes de Comunidad
app.get('/api/incidents', (req, res) => {
  const db = readDb();
  res.json({ success: true, incidents: db.incidents || [] });
});

app.post('/api/incidents', (req, res) => {
  try {
    const { clientName, unitNumber, description, priority = 'Normal', fullText } = req.body;
    const db = readDb();
    const ticketId = `INC-${Math.floor(100000 + Math.random() * 900000)}`;
    const newIncident = {
      id: ticketId,
      condoName: 'Condominio Portada Norte VII',
      clientName: clientName || 'Residente Copropietario',
      unitNumber: unitNumber || 'Por Especificar',
      description: description || 'Reporte de comunidad',
      fullText: fullText || description || '',
      status: 'Pendiente',
      priority: priority || 'Normal',
      adminEmail: 'contactoalsiadministracion@gmail.com',
      industry: 'alsi',
      createdAt: new Date().toISOString()
    };
    db.incidents.unshift(newIncident);
    writeDb(db);
    res.json({ success: true, incident: newIncident });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/incidents/:id/resolve', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const item = (db.incidents || []).find(i => i.id === id);
  if (item) {
    item.status = 'Resuelto';
    item.resolvedAt = new Date().toISOString();
    writeDb(db);
    return res.json({ success: true, item });
  }
  res.status(404).json({ success: false, message: 'Incidencia no encontrada' });
});

// Pases / Vouchers QR
app.get('/api/vouchers', (req, res) => {
  const vouchers = getVouchers();
  res.json({ success: true, vouchers });
});

app.post('/api/vouchers/redeem', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: "Falta parámetro 'code'" });
  const result = validateAndRedeemVoucher(code);
  res.json(result);
});

// Datos de Transferencia Bancaria
app.get('/api/company-payments', (req, res) => {
  const info = getCompanyPaymentDetails();
  res.json({ success: true, company: info });
});

app.post('/api/company-payments', (req, res) => {
  const newDetails = req.body;
  const all = readCompanyPayments();
  all.alsi = {
    ...all.alsi,
    ...newDetails
  };
  writeCompanyPayments(all);
  res.json({ success: true, company: all.alsi });
});

// Solicitudes Pendientes
app.get('/api/pending-requests', (req, res) => {
  const pending = readPendingRequests();
  res.json({ success: true, pendingRequests: pending });
});

app.post('/api/pending-requests/:id/resolve', (req, res) => {
  const { id } = req.params;
  const result = resolvePendingRequest(id);
  res.json(result);
});

// Informes de Operaciones HabitaOps (Google Drive & Rondas)
app.get('/api/habitaops', (req, res) => {
  const reports = getHabitaOpsReports();
  res.json({ success: true, reports });
});

app.post('/api/habitaops', (req, res) => {
  try {
    const { title, reportDate, category, driveUrl, observations, status, uploadedBy } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: "El título del informe es requerido" });
    }
    const newReport = addHabitaOpsReport({
      title,
      reportDate,
      category,
      driveUrl,
      observations,
      status,
      uploadedBy
    });
    res.json({ success: true, report: newReport });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/habitaops/:id', (req, res) => {
  const { id } = req.params;
  const result = deleteHabitaOpsReport(id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

// Informe Ejecutivo Consolidado para la Comunidad & Liberación de Factura
app.get('/api/reports/executive-summary', (req, res) => {
  const db = readDb();
  const appointments = db.appointments || [];
  const incidents = db.incidents || [];
  const habitaOpsReports = db.habitaOpsReports || [];
  const company = getCompanyPaymentDetails();

  // Métricas de Reuniones
  const totalAppointments = appointments.length;
  const resolvedAppointments = appointments.filter(a => a.status === 'Realizada' || a.followUpStatus === 'Realizada / Resuelta').length;
  const canceledAppointments = appointments.filter(a => a.status === 'Cancelada' || a.followUpStatus === 'Cancelada').length;
  const inProgressAppointments = appointments.filter(a => a.status === 'En Gestión' || a.followUpStatus === 'En Gestión').length;
  const pendingAppointments = totalAppointments - resolvedAppointments - canceledAppointments - inProgressAppointments;

  // Métricas de Incidencias
  const totalIncidents = incidents.length;
  const resolvedIncidents = incidents.filter(i => i.status === 'Resuelto').length;
  const pendingIncidents = totalIncidents - resolvedIncidents;
  const incidentResolutionRate = totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 100;

  // Métricas HabitaOps
  const totalHabitaOps = habitaOpsReports.length;

  res.json({
    success: true,
    condoName: "Condominio Portada Norte VII",
    administrationName: "ALSI Administración Copropiedad",
    rut: "77.654.321-K",
    adminEmail: "contactoalsiadministracion@gmail.com",
    metrics: {
      totalAppointments,
      resolvedAppointments,
      inProgressAppointments,
      pendingAppointments,
      canceledAppointments,
      appointmentResolutionRate: (totalAppointments - canceledAppointments) > 0 
        ? Math.round((resolvedAppointments / (totalAppointments - canceledAppointments)) * 100) 
        : 100,
      totalIncidents,
      resolvedIncidents,
      pendingIncidents,
      incidentResolutionRate,
      totalHabitaOps
    },
    appointments,
    incidents,
    habitaOpsReports,
    company
  });
});

// Endpoint administrativo para reiniciar la base de datos a 0 (inicio oficial)
app.all('/api/admin/reset-database-zero', (req, res) => {
  const confirm = req.query.confirm || (req.body && req.body.confirm);
  if (confirm !== 'alsi2026') {
    return res.status(403).json({
      success: false,
      message: 'Confirmación requerida. Envíe ?confirm=alsi2026 para proceder con el reinicio a 0.'
    });
  }
  const clean = resetDbToZero();
  res.json({
    success: true,
    message: 'Base de datos reiniciada exitosamente a 0 para inicio oficial de Condominio Portada Norte VII.',
    db: clean
  });
});

process.on('uncaughtException', (err) => {
  console.error('💥 Excepción no capturada en ALSI Server:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Promesa rechazada no manejada:', reason);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n===================================================`);
  console.log(`🚀 SERVIDOR ALSI COPROPIEDAD INICIADO EN PUERTO ${PORT}`);
  console.log(`🌐 Dashboard UI: http://0.0.0.0:${PORT}`);
  console.log(`📱 QR WhatsApp: http://0.0.0.0:${PORT}/qr`);
  console.log(`===================================================\n`);

  try {
    startReminderCron();
    await connectToWhatsApp();
  } catch (initErr) {
    console.error('Error al inicializar servicios de fondo:', initErr.message);
  }
});
