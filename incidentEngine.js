const { readDb, writeDb } = require('./db');

const INCIDENT_MENU_CONDO = [
  { id: 1, label: "Falla de portón eléctrico", keywords: ["porton", "portón"] },
  { id: 2, label: "Falla en el sistema de CCTV (Cámaras de Seguridad)", keywords: ["cctv", "camara", "cámara", "seguridad"] },
  { id: 3, label: "Falta de conserje en su puesto", keywords: ["conserje", "conserjería", "conserjeria", "falta conserje"] },
  { id: 4, label: "Falla o sonido raro desde Sala de Bombas", keywords: ["bomba", "bombas", "sala de bombas", "sonido"] },
  { id: 5, label: "Falla en la piscina / Mantenimiento", keywords: ["falla piscina", "piscina"] },
  { id: 6, label: "Accidente o incidente en la piscina", keywords: ["accidente piscina", "incidente piscina"] },
  { id: 7, label: "Accidente o incidente de un trabajador", keywords: ["accidente trabajador", "incidente trabajador", "personal"] },
  { id: 8, label: "Falla en tolvas / ductos de basura de su torre", keywords: ["tolva", "tolvas", "ducto", "ductos", "basura"] },
  { id: 9, label: "Otro problema / Incidencia no contemplada", keywords: ["otro", "otra", "diferente"] }
];

function getIncidentMenuText(clientName, unitNumber) {
  const nameTag = clientName ? `@${clientName}` : 'Residente';
  const unitTag = (unitNumber && unitNumber !== 'Por Especificar') ? ` (Depto **${unitNumber}**)` : '';

  return `¡Hola **${nameTag}**${unitTag}! Con gusto registramos tu reporte de incidencia 🏢✨\n\n` +
    `Por favor selecciona el **tipo de incidencia** indicando el número u opción correspondiente:\n\n` +
    `1️⃣ **Falla de portón eléctrico**\n` +
    `2️⃣ **Falla en el sistema de CCTV (Cámaras de Seguridad)**\n` +
    `3️⃣ **Falta de conserje en su puesto**\n` +
    `4️⃣ **Falla o sonido raro desde Sala de Bombas**\n` +
    `5️⃣ **Falla en la piscina / Mantenimiento**\n` +
    `6️⃣ **Accidente o incidente en la piscina**\n` +
    `7️⃣ **Accidente o incidente de un trabajador**\n` +
    `8️⃣ **Falla en tolvas / ductos de basura de su torre**\n` +
    `9️⃣ **Otro problema (Describir el inconveniente)**\n\n` +
    `Por favor indícanos el número de opción (1 a 9) o describe brevemente la situación.`;
}

async function processIncidentFlow({ message, history = [], clientName, unitNumber, condoName = "Condominio Portada Norte VII", adminEmail = 'contactoalsiadministracion@gmail.com' }) {
  const incidentMenu = INCIDENT_MENU_CONDO;
  const textLower = message.trim().toLowerCase();
  const hasMeetingIntent = textLower.includes('reunion') || textLower.includes('reunión') || textLower.includes('agendar') || textLower.includes('coordinar') || textLower.includes('cita');
  
  if (hasMeetingIntent) {
    return { completed: false, cancelFlow: true, reply: null };
  }

  const db = readDb();
  if (!db.incidents) db.incidents = [];

  const lastBotMsg = (history && history.length > 0) 
    ? history.filter(h => h.role === 'assistant').slice(-1)[0]?.content || ''
    : '';

  const wasAskingName = lastBotMsg.includes('Nombre, Apellido') || lastBotMsg.includes('Número de tu Departamento');
  const wasShowingMenu = lastBotMsg.includes('tipo de incidencia') || lastBotMsg.includes('Falla de portón eléctrico');
  const wasAskingDescription = lastBotMsg.includes('describe el problema') || lastBotMsg.includes('inconveniente');

  if (!clientName || clientName === 'Residente Copropietario') {
    const textClean = message.replace(/(?:departamento|depto|dpto|unidad)\s*n?°?\s*\d+/gi, '').trim();
    const words = textClean.split(/\s+/).filter(w => w.length > 1 && !['reporte', 'incidencia', 'hola', 'buenas', 'tardes'].includes(w.toLowerCase()));
    if (words.length >= 2) {
      clientName = words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  if (!unitNumber || unitNumber === 'Por Especificar') {
    const depMatch = message.match(/(?:departamento|depto|dpto|unidad)\s*n?°?\s*([A-Za-z0-9\s.-]+?)(?=\s+y\s|\s+asunto|\s+para|\s+el\s|\s+a\s+las|$|,|\.)/i) || 
                     message.match(/\b(\d{1,4}[A-Za-z]?)\b/);
    if (depMatch && depMatch[1]) {
      unitNumber = depMatch[1].trim();
    }
  }

  if (!clientName || !unitNumber || unitNumber === 'Por Especificar') {
    return {
      completed: false,
      reply: `¡Hola! Con gusto te ayudamos a registrar tu reporte de incidencia 🏢✨\n\n` +
        `Por favor, indícanos primero tu **Nombre, Apellido** y el **Número de tu Departamento** para asociarlo a tu solicitud.`
    };
  }

  if (wasAskingName || (!wasShowingMenu && !wasAskingDescription)) {
    return {
      completed: false,
      reply: getIncidentMenuText(clientName, unitNumber)
    };
  }

  let selectedCategory = null;
  const numberMatch = textLower.match(/^([1-9])$/);
  if (numberMatch) {
    const optId = parseInt(numberMatch[1], 10);
    const cat = incidentMenu.find(m => m.id === optId);
    if (cat) selectedCategory = cat.label;
  }

  if (!selectedCategory) {
    for (const cat of incidentMenu) {
      if (cat.id === 9) continue;
      if (cat.keywords.some(k => textLower.includes(k))) {
        selectedCategory = cat.label;
        break;
      }
    }
  }

  if (numberMatch && parseInt(numberMatch[1], 10) === 9 && !wasAskingDescription) {
    return {
      completed: false,
      reply: `Por favor describe detalladamente el problema o situación que se presenta para notificar a la administración y a la supervisora.`
    };
  }

  if (!selectedCategory && !wasAskingDescription) {
    return {
      completed: false,
      reply: getIncidentMenuText(clientName, unitNumber)
    };
  }

  const finalDescription = selectedCategory || message;
  const ticketId = `INC-${Math.floor(100000 + Math.random() * 900000)}`;
  const emailSubject = `reporte de incidencia`;

  const newIncident = {
    id: ticketId,
    condoName,
    clientName: clientName || "Residente Copropietario",
    unitNumber: unitNumber || "Por Especificar",
    description: finalDescription,
    fullText: message,
    status: "Pendiente",
    priority: textLower.includes('urgente') || textLower.includes('agua') || textLower.includes('accidente') ? "Alta" : "Normal",
    adminEmail,
    industry: 'alsi',
    createdAt: new Date().toISOString()
  };

  db.incidents.unshift(newIncident);
  writeDb(db);

  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (n8nWebhookUrl) {
    try {
      await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'INCIDENT_REPORTED',
          emailSubject,
          ticketId,
          condoName,
          clientName: newIncident.clientName,
          unitNumber: newIncident.unitNumber,
          description: finalDescription,
          priority: newIncident.priority,
          adminEmail
        })
      });
      console.log(`🚨 Evento de Incidencia ${ticketId} despachado a n8n con asunto '${emailSubject}'!`);
    } catch (e) {
      console.error("Error enviando incidencia a n8n:", e.message);
    }
  }

  const nameTag = clientName ? `@${clientName}` : 'Residente';
  const unitTag = (unitNumber && unitNumber !== 'Por Especificar') ? ` (Depto **${unitNumber}**)` : '';

  const confirmationReply = `🚨 **REPORTADO CON ÉXITO A SUPERVISORA Y ADMINISTRACIÓN** 🛠️✨\n\n` +
    `Estimado/a **${nameTag}**${unitTag}:\n\n` +
    `Informamos que se ha notificado de manera exitosa a la **Supervisora y Administración** para manejar su reporte de **${finalDescription}** (Ticket ID: \`${ticketId}\`) y gestionar una solución a la brevedad.\n\n` +
    `Agradecemos enormemente su **aviso oportuno** y por **confiar en ALSI Administración**. ¡Que tenga un excelente día! 🏢✨`;

  return {
    completed: true,
    incident: newIncident,
    reply: confirmationReply
  };
}

module.exports = {
  processIncidentFlow,
  getIncidentMenuText
};
