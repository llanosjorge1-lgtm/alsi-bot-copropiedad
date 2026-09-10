/**
 * Servicio de Integración Oficial con Instagram Messaging (Meta Graph API)
 * para ALSI Administración Copropiedad
 */
const { processMessage } = require('./agentEngine');

const INSTAGRAM_VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || 'alsi_copropiedad_secret_2026';
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || null;

// Memoria de historial de conversación por usuario de Instagram
const igHistories = new Map();

function getIgHistory(userId) {
  if (!igHistories.has(userId)) {
    igHistories.set(userId, []);
  }
  return igHistories.get(userId);
}

function updateIgHistory(userId, userMsg, botReply) {
  let h = getIgHistory(userId);
  h.push({ role: 'user', content: userMsg });
  h.push({ role: 'assistant', content: botReply });
  if (h.length > 20) {
    h = h.slice(-20);
  }
  igHistories.set(userId, h);
}

/**
 * 1. Verificación inicial del Webhook por Meta (GET)
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === INSTAGRAM_VERIFY_TOKEN) {
    console.log('✅ Webhook de Instagram verificado exitosamente por Meta!');
    return res.status(200).send(challenge);
  } else {
    console.warn('⚠️ Intento fallido de verificación de Webhook Instagram. Token no coincide.');
    return res.sendStatus(403);
  }
}

/**
 * 2. Recepción de mensajes directos (DM) de Instagram (POST)
 */
async function handleWebhook(req, res) {
  const body = req.body;

  // Responder 200 OK de inmediato a Meta para evitar reintentos duplicados
  res.status(200).send('EVENT_RECEIVED');

  if (body.object !== 'instagram' && body.object !== 'page') {
    return;
  }

  for (const entry of body.entry || []) {
    // Procesar eventos de mensajería
    const messagingEvents = entry.messaging || [];
    for (const event of messagingEvents) {
      const senderId = event.sender?.id;
      const message = event.message;

      // Ignorar echos (mensajes enviados por la propia página) o mensajes vacíos
      if (!senderId || !message || message.is_echo) continue;

      const text = message.text || '';
      if (!text.trim()) continue;

      console.log(`📩 Mensaje entrante Instagram DM de [${senderId}]: "${text}"`);

      try {
        const history = getIgHistory(senderId);

        // Procesar con el mismo motor de IA de ALSI
        const result = await processMessage({
          message: text,
          history,
          senderPhone: `IG-${senderId}`,
          pushName: 'Residente Instagram'
        });

        if (result && result.reply) {
          updateIgHistory(senderId, text, result.reply);

          // Enviar respuesta por Instagram DM
          await sendTextMessage(senderId, result.reply);

          // Si se generó un pase digital QR, enviar aviso con el código
          if (result.voucher && result.voucher.code) {
            await sendTextMessage(senderId, 
              `🎟️ *Pase Digital ALSI Copropiedad*\n` +
              `• Código de Atención: ${result.voucher.code}\n` +
              `• Condominio: Condominio Portada Norte VII\n\n` +
              `Presenta este código al momento de tu atención. ¡Te esperamos puntualmente! 🏢✨`
            );
          }
        }
      } catch (err) {
        console.error('Error procesando DM de Instagram:', err.message);
      }
    }
  }
}

/**
 * 3. Enviar mensaje de texto a Instagram DM vía Meta Graph API
 */
async function sendTextMessage(recipientId, text) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.warn('⚠️ INSTAGRAM_ACCESS_TOKEN no configurado en Railway. No se puede enviar el DM.');
    return;
  }

  try {
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;
    const payload = {
      recipient: { id: recipientId },
      message: { text: text }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.error) {
      console.error('Error de Graph API enviando DM de Instagram:', data.error.message);
    } else {
      console.log(`📤 DM enviado exitosamente por Instagram a [${recipientId}]`);
    }
  } catch (e) {
    console.error('Fallo en petición a Meta Graph API:', e.message);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
  sendTextMessage
};
