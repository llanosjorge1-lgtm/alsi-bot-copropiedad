const { readDb, writeDb, getCompanyPaymentDetails } = require('./db');
const { createVoucher } = require('./voucherService');
const { fetchGoogleCalendarBusySlots } = require('./googleCalendarService');

const ALSI_SYSTEM_PROMPT = `Eres el Asistente Virtual Oficial con Inteligencia Artificial de ALSI Administración, atendiendo exclusivamente a los residentes, copropietarios y arrendatarios de Condominio Portada Norte VII (Antofagasta, Chile).

TU PERSONALIDAD Y TONO:
- Eres cálido, empático, educado, resolutivo y profesional (trato respetuoso y formal propio de Chile, utilizando "Estimado/a vecino/a", "Don/Doña", "Con mucho gusto", etc.).
- Respuestas directas, claras y bien estructuradas para WhatsApp (puedes usar emojis con sobriedad y negritas).
- Evita sonar como un contestador telefónico o un menú numérico. Conversa de manera fluida y humana.
- Si el vecino menciona su nombre o departamento, utilízalo en tu saludo.

DATOS OPERATIVOS OFICIALES DE CONDOMINIO PORTADA NORTE VII:
- Administrador: ALSI Administración Copropiedad (Representante: Jorge Llanos).
- Correo oficial: contactoalsiadministracion@gmail.com (con copia a portadadelnortevii@gmail.com).
- Horarios de reuniones de atención (presencial o virtual): Lunes a viernes en bloques de 30 minutos (09:00 a 13:00 hrs y 15:00 a 17:00 hrs). No se atiende fines de semana ni festivos.
- Datos bancarios oficiales para Gastos Comunes:
  * Banco: Banco Santander
  * Tipo de cuenta: Cuenta Corriente
  * Número de cuenta: 6346927-0
  * RUT: 53.313.111-5
  * Titular: Condominio Portada Siete
  * Correo para comprobante: contactoalsiadministracion@gmail.com con copia a portadadelnortevii@gmail.com (indicando siempre número de departamento y torre).

USO DE HERRAMIENTAS (FUNCTION CALLING):
Dispones de herramientas para realizar acciones reales en el sistema del condominio:
1. 'consultarHorariosDisponibles': Úsala cuando el residente pregunte qué horarios o días hay disponibles para reunirse.
2. 'agendarReunion': Úsala cuando el residente desee coordinar una reunión y se cuente con: Nombre completo, Departamento, Día y Bloque Horario (ID de 1 a 11), y motivo. Si falta algún dato, pídelo amablemente antes de agendar. Al agendarse, el sistema generará automáticamente un Pase QR Digital oficial y lo registrará en Google Calendar y n8n.
3. 'reportarIncidencia': Úsala cuando el residente reporte una avería técnica (portón, bombas de agua, piscina, tolvas de basura, cámaras CCTV), falta de conserje, ruidos molestos u otra anomalía. Si involucra filtración de agua o riesgo de seguridad, asígnale prioridad "Alta" o "Urgente".
4. 'obtenerDatosBancarios': Úsala cuando soliciten la cuenta para pagar gastos comunes o transferencias.
5. 'cancelarReunion': Úsala cuando un residente necesite anular su cita previamente coordinada.`;

const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "consultarHorariosDisponibles",
        description: "Consulta los bloques horarios libres (de 30 min) para un día hábil específico (lunes a viernes).",
        parameters: {
          type: "OBJECT",
          properties: {
            dia: {
              type: "STRING",
              description: "Día solicitado para la reunión (ej: lunes, martes, miércoles, jueves, viernes, o fecha específica)."
            }
          },
          required: ["dia"]
        }
      },
      {
        name: "agendarReunion",
        description: "Agenda formalmente una reunión de atención en el condominio, genera el pase digital QR, registra en Google Calendar y notifica por n8n a los correos correspondientes.",
        parameters: {
          type: "OBJECT",
          properties: {
            nombre: { type: "STRING", description: "Nombre y apellido del residente o solicitante" },
            depto: { type: "STRING", description: "Número de departamento o unidad (ej: 402, 105, Torre B 301)" },
            dia: { type: "STRING", description: "Día de la semana o fecha de la reunión (ej: lunes, martes 22 de septiembre)" },
            bloqueId: { 
              type: "INTEGER", 
              description: "ID del bloque de 30 min (1: 09:00 a 09:30, 2: 09:30 a 10:00, 3: 10:00 a 10:30, 4: 10:30 a 11:00, 5: 11:30 a 12:00, 6: 12:00 a 12:30, 7: 12:30 a 13:00, 8: 15:00 a 15:30, 9: 15:30 a 16:00, 10: 16:00 a 16:30, 11: 16:30 a 17:00)" 
            },
            motivo: { type: "STRING", description: "Asunto o motivo de la reunión (ej: revisión de gasto común, consulta de estacionamiento, etc.)" }
          },
          required: ["nombre", "depto", "dia", "bloqueId", "motivo"]
        }
      },
      {
        name: "reportarIncidencia",
        description: "Registra formalmente una incidencia, falla en áreas comunes, emergencia o reporte en el CRM del condominio y despacha alerta urgente por correo vía n8n.",
        parameters: {
          type: "OBJECT",
          properties: {
            nombre: { type: "STRING", description: "Nombre del residente reportante" },
            depto: { type: "STRING", description: "Número de departamento o área común afectada" },
            descripcion: { type: "STRING", description: "Detalle descriptivo del problema o falla" },
            prioridad: { 
              type: "STRING", 
              description: "Nivel de urgencia de la incidencia (Normal, Alta o Urgente. Filtraciones o emergencias deben ser Alta o Urgente)" 
            }
          },
          required: ["nombre", "depto", "descripcion"]
        }
      },
      {
        name: "obtenerDatosBancarios",
        description: "Entrega los datos de transferencia bancaria de la cuenta corriente de Banco Santander para pago de gastos comunes."
      },
      {
        name: "cancelarReunion",
        description: "Cancela una reunión previamente coordinada en el sistema, liberando el bloque de atención y notificando a n8n.",
        parameters: {
          type: "OBJECT",
          properties: {
            depto: { type: "STRING", description: "Número de departamento" },
            nombre: { type: "STRING", description: "Nombre del residente" }
          },
          required: ["depto"]
        }
      }
    ]
  }
];

// Helper para obtener días hábiles y bloques horarios
function getBusinessDateFromStr(diaStr) {
  const { getNextBusinessDays, formatBusinessDate } = require('./agentEngine');
  const days = getNextBusinessDays(5);
  const lower = (diaStr || '').toLowerCase();
  
  const dayNames = ["domingo", "lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado"];
  for (const d of days) {
    const dName = dayNames[d.getDay()];
    if (lower.includes(dName) || (dName === 'miércoles' && lower.includes('miercoles'))) {
      return { dateObj: d, formatted: formatBusinessDate(d) };
    }
  }

  for (const d of days) {
    const dayNum = String(d.getDate());
    if (new RegExp(`\\b${dayNum}\\b`).test(lower)) {
      return { dateObj: d, formatted: formatBusinessDate(d) };
    }
  }

  // Por defecto el primer día hábil
  return { dateObj: days[0], formatted: formatBusinessDate(days[0]) };
}

// Ejecución interna de herramientas invocadas por Gemini
async function executeGeminiTool(functionName, args, context = {}) {
  const { MEETING_SLOTS, getAvailableSlots } = require('./agentEngine');
  const condoName = "Condominio Portada Norte VII";
  const adminEmail = "contactoalsiadministracion@gmail.com";
  const residentPhone = context.senderPhone || '+56977665544';

  if (functionName === 'consultarHorariosDisponibles') {
    const target = getBusinessDateFromStr(args.dia);
    let busySlots = [];
    try {
      busySlots = await fetchGoogleCalendarBusySlots(target.dateObj);
    } catch (e) {}

    const freeSlots = getAvailableSlots(target.dateObj, busySlots);
    return {
      success: true,
      dia: target.formatted,
      totalDisponibles: freeSlots.length,
      bloques: freeSlots.map(s => ({
        id: s.id,
        horario: s.label,
        bloque: s.block
      }))
    };
  }

  if (functionName === 'agendarReunion') {
    const { nombre, depto, dia, bloqueId, motivo } = args;
    const target = getBusinessDateFromStr(dia);
    const slot = MEETING_SLOTS.find(s => s.id === parseInt(bloqueId, 10)) || MEETING_SLOTS[0];

    const year = target.dateObj.getFullYear();
    const month = String(target.dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(target.dateObj.getDate()).padStart(2, '0');

    const startHStr = String(slot.hour).padStart(2, '0');
    const startMStr = String(slot.minute).padStart(2, '0');
    const startIso = `${year}-${month}-${day}T${startHStr}:${startMStr}:00-03:00`;

    let endHour = slot.hour;
    let endMinute = slot.minute + 30;
    if (endMinute >= 60) { endHour += 1; endMinute -= 60; }
    const endHStr = String(endHour).padStart(2, '0');
    const endMStr = String(endMinute).padStart(2, '0');
    const endIso = `${year}-${month}-${day}T${endHStr}:${endMStr}:00-03:00`;

    const summary = `Reunión: ${nombre} - Depto ${depto} - Asunto: ${motivo}`;

    const db = readDb();
    const newAppointment = {
      id: `apt-${Date.now()}`,
      clientName: nombre,
      clientPhone: residentPhone,
      unitNumber: depto,
      asunto: motivo,
      summary,
      industry: 'alsi',
      serviceType: summary,
      propertyAddress: condoName,
      dateTime: `${target.formatted} de ${year} (${slot.label})`,
      slotId: slot.id,
      startIso,
      endIso,
      nightsCount: 0,
      pricePerNight: 0,
      subtotal: 0,
      ivaOrFee: 0,
      totalAmount: 0,
      paymentStatus: 'Confirmada (Gratuita)',
      status: 'Confirmada',
      createdAt: new Date().toISOString()
    };
    db.appointments.unshift(newAppointment);
    writeDb(db);

    const voucher = await createVoucher({
      clientName: `${nombre} (Depto ${depto})`,
      clientPhone: residentPhone,
      industry: 'alsi',
      voucherType: `Pase Digital de Atención ALSI (${condoName})`,
      discountOrAmount: `${summary} | ${target.formatted} ${slot.label} | Gratuita ($0)`,
      propertyAddress: condoName
    });

    // Despacho a n8n para notificación por correo y Google Calendar
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      try {
        fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'MEETING_BOOKED',
            emailSubject: `coordinación de reunión - ${summary}`,
            clientName: nombre,
            unitNumber: depto,
            meetingReason: motivo,
            dateTime: `${target.formatted} (${slot.label})`,
            startIso,
            endIso,
            summary,
            adminEmail,
            qrCodeUrl: voucher.qrCodeDataUrl,
            voucherCode: voucher.code
          })
        }).catch(err => console.error("Error despachando reunión a n8n:", err.message));
      } catch (e) {}
    }

    // Almacenar en contexto para adjuntar el QR en WhatsApp
    context.generatedVoucher = voucher;

    return {
      success: true,
      mensaje: "Reunión agendada exitosamente en el sistema.",
      appointmentId: newAppointment.id,
      dia: target.formatted,
      horario: slot.label,
      voucherCode: voucher.code,
      titular: nombre,
      depto: depto,
      motivo: motivo
    };
  }

  if (functionName === 'reportarIncidencia') {
    const { nombre, depto, descripcion, prioridad } = args;
    const ticketId = `INC-${Math.floor(100000 + Math.random() * 900000)}`;
    const finalPriority = prioridad || (descripcion.toLowerCase().includes('agua') || descripcion.toLowerCase().includes('urgente') ? 'Alta' : 'Normal');

    const db = readDb();
    if (!db.incidents) db.incidents = [];

    const newIncident = {
      id: ticketId,
      condoName,
      clientName: nombre || "Residente Copropietario",
      unitNumber: depto || "Por Especificar",
      description: descripcion,
      fullText: descripcion,
      status: "Pendiente",
      priority: finalPriority,
      adminEmail,
      industry: 'alsi',
      createdAt: new Date().toISOString()
    };
    db.incidents.unshift(newIncident);
    writeDb(db);

    // Despacho urgente a n8n
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      try {
        fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'INCIDENT_REPORTED',
            emailSubject: `reporte de incidencia - Depto ${depto} - ${ticketId}`,
            ticketId,
            condoName,
            clientName: newIncident.clientName,
            unitNumber: newIncident.unitNumber,
            description: descripcion,
            priority: finalPriority,
            adminEmail
          })
        }).catch(err => console.error("Error despachando incidencia a n8n:", err.message));
      } catch (e) {}
    }

    return {
      success: true,
      ticketId,
      nombre,
      depto,
      descripcion,
      prioridad: finalPriority,
      mensaje: "Incidencia registrada y notificada a administración."
    };
  }

  if (functionName === 'obtenerDatosBancarios') {
    const paymentInfo = getCompanyPaymentDetails('alsi') || {
      bankName: "Banco Santander",
      accountType: "Cuenta Corriente",
      accountNumber: "6346927-0",
      rut: "53.313.111-5",
      holderName: "Condominio Portada Siete",
      emailNotification: "contactoalsiadministracion@gmail.com"
    };

    return {
      success: true,
      banco: paymentInfo.bankName,
      tipoCuenta: paymentInfo.accountType,
      numeroCuenta: paymentInfo.accountNumber,
      rut: paymentInfo.rut,
      titular: paymentInfo.holderName,
      correoEnvioComprobante: "contactoalsiadministracion@gmail.com",
      correoCopia: "portadadelnortevii@gmail.com",
      instrucciones: "Enviar el comprobante indicando número de departamento y torre para asociar el pago de gastos comunes."
    };
  }

  if (functionName === 'cancelarReunion') {
    const { depto, nombre } = args;
    const db = readDb();
    const apts = db.appointments || [];
    const deptoClean = String(depto || '').replace(/\D/g, '');

    const found = apts.find(a => {
      if (a.status === 'Cancelada') return false;
      if (deptoClean && String(a.unitNumber || '').includes(deptoClean)) return true;
      if (nombre && a.clientName && a.clientName.toLowerCase().includes(nombre.toLowerCase())) return true;
      return false;
    });

    if (found) {
      found.status = 'Cancelada';
      found.canceledAt = new Date().toISOString();
      writeDb(db);

      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      if (n8nWebhookUrl) {
        try {
          fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'MEETING_CANCELED',
              emailSubject: `cancelación de reunión - Depto ${found.unitNumber}`,
              clientName: found.clientName,
              appointmentId: found.id,
              adminEmail
            })
          }).catch(() => {});
        } catch (e) {}
      }

      return {
        success: true,
        mensaje: `La reunión agendada para el ${found.dateTime} ha sido cancelada exitosamente.`
      };
    }

    return {
      success: false,
      mensaje: "No se encontró ninguna reunión activa registrada para ese departamento o nombre."
    };
  }

  return { success: false, mensaje: "Herramienta no implementada." };
}

function getTimeOfDayGreeting() {
  const now = new Date();
  try {
    const chileHourStr = new Intl.DateTimeFormat('es-CL', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Santiago'
    }).format(now);
    const hour = parseInt(chileHourStr, 10);
    if (hour >= 6 && hour < 12) return "Buenos días";
    if (hour >= 12 && hour < 20) return "Buenas tardes";
    return "Buenas noches";
  } catch (e) {
    const h = (now.getUTCHours() - 3 + 24) % 24;
    if (h >= 6 && h < 12) return "Buenos días";
    if (h >= 12 && hour < 20) return "Buenas tardes";
    return "Buenas noches";
  }
}

function extractResidentName(message, pushName) {
  if (message) {
    const m = message.match(/(?:soy|me llamo|mi nombre es)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+)?)/i);
    if (m && m[1]) return m[1].trim();
  }
  if (pushName && typeof pushName === 'string') {
    const clean = pushName.trim();
    if (clean && !clean.toLowerCase().includes('user') && !clean.toLowerCase().includes('whatsapp') && clean.length >= 3) {
      return clean;
    }
  }
  return null;
}

function isPureGreeting(text) {
  const clean = (text || '').toLowerCase().trim().replace(/[!¡?¿.,]/g, '');
  const greetings = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hola buenas', 'hola buenas tardes', 'hola buenas noches', 'hola buenos dias', 'saludos', 'hola que tal', 'buen dia', 'buen día'];
  return greetings.includes(clean);
}

// Procesa el mensaje conversacional utilizando Google Gemini
async function processWithGemini({ message, history = [], senderPhone = null, pushName = null }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return { active: false, reason: "NO_API_KEY" };
  }

  const greeting = getTimeOfDayGreeting();
  const resName = extractResidentName(message, pushName);
  const nameTag = resName ? ` **${resName}**` : '';

  // Si el residente solo envía un saludo general sin consultar nada en particular
  if (isPureGreeting(message)) {
    return {
      active: true,
      reply: `¡${greeting}! Estimado/a${nameTag}, le saluda su Asistente Virtual de ALSI Administración para Condominio Portada Norte VII 🏢✨.\n\n¿En qué le podemos ayudar hoy?`,
      toolExecuted: null,
      voucher: null,
      industry: 'alsi'
    };
  }

  const msgLower = (message || '').toLowerCase();
  const isTransferReq = msgLower.includes('transferencia') || 
                        msgLower.includes('bancari') || 
                        msgLower.includes('santander') ||
                        (msgLower.includes('datos') && (msgLower.includes('cuenta') || msgLower.includes('pagar') || msgLower.includes('gasto') || msgLower.includes('transferir'))) ||
                        (msgLower.includes('cuenta') && (msgLower.includes('pagar') || msgLower.includes('transferir'))) ||
                        (msgLower.includes('gasto') && (msgLower.includes('pagar') || msgLower.includes('cuenta') || msgLower.includes('donde')));

  if (isTransferReq) {
    const bankDetails = await executeGeminiTool('obtenerDatosBancarios', {}, { senderPhone, pushName });
    return {
      active: true,
      introMessage: `¡${greeting}! Estimado/a${nameTag}, le saluda su Asistente Virtual de ALSI Administración para Condominio Portada Norte VII 🏢✨.\n\nCon mucho gusto, en breve le comparto los datos oficiales para realizar su transferencia bancaria.`,
      delayMs: 5000,
      reply: `Aquí tiene los datos para realizar la transferencia:\n` +
        `🏛️ **Banco:** Banco Santander\n` +
        `📋 **Tipo de Cuenta:** Cuenta Corriente\n` +
        `🔢 **Número de Cuenta:** 6346927-0\n` +
        `🆔 **RUT:** 53.313.111-5\n` +
        `👤 **Titular:** Condominio Portada Siete\n\n` +
        `Por favor, recuerde enviar el comprobante de su transferencia a:\n` +
        `📧 \ncontactoalsiadministracion@gmail.com\n\n` +
        `Con copia a: \nportadadelnortevii@gmail.com\n\n` +
        `Es muy importante que en el asunto o cuerpo del correo indique siempre su número de departamento y torre para poder asociar correctamente su pago.\n\n` +
        `Si tiene alguna otra consulta, no dude en preguntar.`,
      toolExecuted: { name: 'obtenerDatosBancarios', result: bankDetails },
      voucher: null,
      industry: 'alsi'
    };
  }

  const candidateModels = [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'].filter(Boolean);
  // Eliminar duplicados
  const modelsToTry = [...new Set(candidateModels)];

  // Formatear historial asegurando alternancia user -> model -> user
  const contents = [];
  if (Array.isArray(history) && history.length > 0) {
    for (const h of history) {
      if (!h.content || typeof h.content !== 'string') continue;
      const role = h.role === 'assistant' ? 'model' : 'user';
      // Evitar dos roles idénticos seguidos en Gemini
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += `\n${h.content}`;
      } else {
        contents.push({ role, parts: [{ text: h.content }] });
      }
    }
  }

  // Turno actual del usuario
  const userText = pushName ? `[Residente: ${pushName}, Tel: ${senderPhone || 'Desconocido'}]\n${message}` : message;
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts[0].text += `\n${userText}`;
  } else {
    contents.push({ role: 'user', parts: [{ text: userText }] });
  }

  const payload = {
    systemInstruction: {
      parts: [{ text: ALSI_SYSTEM_PROMPT }]
    },
    contents,
    tools: GEMINI_TOOLS,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 800
    }
  };

  const context = { senderPhone, pushName, generatedVoucher: null };

  try {
    let res = null;
    let chosenModel = modelsToTry[0];
    let errText = '';

    for (const m of modelsToTry) {
      chosenModel = m;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        break; // Éxito con este modelo
      }

      errText = await res.text();
      if (res.status === 404) {
        console.warn(`Modelo Gemini '${m}' no disponible (404), probando siguiente...`);
        continue;
      } else {
        // Otro error (ej: 400, 403, 429)
        break;
      }
    }

    if (!res || !res.ok) {
      console.error(`⚠️ Gemini API error (${res?.status}):`, errText);
      return { active: false, reason: `API_ERROR_${res?.status}`, errorDetails: errText, attemptedModel: chosenModel };
    }

    const data = await res.json();
    const candidate = data.candidates && data.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts) {
      return { active: false, reason: "EMPTY_GEMINI_RESPONSE" };
    }

    const functionCallPart = candidate.content.parts.find(p => p.functionCall);

    // Verificar si Gemini decidió invocar una función (Tool Calling)
    if (functionCallPart) {
      const call = functionCallPart.functionCall;
      console.log(`🤖 Gemini invocó Tool: ${call.name} con args:`, JSON.stringify(call.args));

      const toolResult = await executeGeminiTool(call.name, call.args, context);

      // Segunda llamada a Gemini con el resultado de la función para obtener redacción humana y empática
      const followUpContents = [
        ...contents,
        {
          role: 'model',
          parts: candidate.content.parts
        },
        {
          role: 'function',
          parts: [{
            functionResponse: {
              name: call.name,
              response: toolResult
            }
          }]
        }
      ];

      const followUpPayload = {
        systemInstruction: {
          parts: [{ text: ALSI_SYSTEM_PROMPT }]
        },
        contents: followUpContents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 800
        }
      };

      try {
        const followUpApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:generateContent?key=${apiKey}`;
        const followUpRes = await fetch(followUpApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(followUpPayload)
        });

        if (followUpRes.ok) {
          const followUpData = await followUpRes.json();
          const parts = followUpData.candidates?.[0]?.content?.parts || [];
          const fullText = parts.filter(p => p.text).map(p => p.text).join('\n').trim();
          if (fullText) {
            return {
              active: true,
              reply: fullText,
              toolExecuted: { name: call.name, result: toolResult },
              voucher: context.generatedVoucher,
              industry: 'alsi'
            };
          }
        }
      } catch (fErr) {
        console.warn("Segunda llamada a Gemini falló, usando respuesta estructurada de respaldo:", fErr.message);
      }

      // Respuesta de respaldo si la segunda llamada no responde
      let fallbackText = toolResult.mensaje || "Operación realizada exitosamente.";
      if (call.name === 'obtenerDatosBancarios') {
        fallbackText = `¡Estimado/a vecino/a! Con mucho gusto le compartimos los datos oficiales para la transferencia de gastos comunes de **Condominio Portada Norte VII** 🏢✨:\n\n` +
          `• 🏦 **Banco**: ${toolResult.banco}\n` +
          `• 📋 **Tipo de Cuenta**: ${toolResult.tipoCuenta}\n` +
          `• 🔢 **Número de Cuenta**: \`${toolResult.numeroCuenta}\`\n` +
          `• 🆔 **RUT**: \`${toolResult.rut}\`\n` +
          `• 👤 **Titular**: **${toolResult.titular}**\n\n` +
          `📧 **Envío de Comprobante**:\n` +
          `Una vez efectuada la transferencia, por favor envíe el comprobante a:\n` +
          `• \`${toolResult.correoEnvioComprobante}\`\n` +
          `• Con copia a: \`${toolResult.correoCopia}\`\n\n` +
          `⚠️ *Importante*: Indicar siempre el **número de departamento y torre** en el asunto del correo para asociar su pago oportunamente. ¡Muchas gracias!`;
      } else if (context.generatedVoucher) {
        fallbackText += `\n\n🎟️ Código de Pase QR: \`${context.generatedVoucher.code}\``;
      }

      return {
        active: true,
        reply: fallbackText,
        toolExecuted: { name: call.name, result: toolResult },
        voucher: context.generatedVoucher,
        industry: 'alsi'
      };
    }

    // Respuesta textual estándar de Gemini
    const allText = candidate.content.parts.filter(p => p.text).map(p => p.text).join('\n').trim();
    if (allText) {
      return {
        active: true,
        reply: allText,
        toolExecuted: null,
        voucher: null,
        industry: 'alsi'
      };
    }

    return { active: false, reason: "NO_USABLE_PART" };
  } catch (err) {
    console.error("💥 Error conectando con Gemini API:", err.message);
    return { active: false, reason: err.message, errorDetails: err.stack };
  }
}

module.exports = {
  processWithGemini,
  executeGeminiTool,
  ALSI_SYSTEM_PROMPT
};
