const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { processMessage } = require('./agentEngine');

let currentQrDataUrl = null;
let isConnected = false;
let waSocket = null;

const sessionHistories = new Map();

function getSessionHistory(sessionId) {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, []);
  }
  return sessionHistories.get(sessionId);
}

function updateSessionHistory(sessionId, userMessage, assistantReply) {
  let history = getSessionHistory(sessionId);
  history.push({ role: 'user', content: userMessage });
  history.push({ role: 'assistant', content: assistantReply });
  if (history.length > 20) {
    history = history.slice(-20);
  }
  sessionHistories.set(sessionId, history);
}

function clearAuthInfo() {
  const authDir = path.join(__dirname, 'baileys_auth_info');
  if (fs.existsSync(authDir)) {
    try {
      const files = fs.readdirSync(authDir);
      for (const file of files) {
        try {
          fs.rmSync(path.join(authDir, file), { recursive: true, force: true });
        } catch (fErr) {}
      }
      console.log('🧹 Archivos internos de baileys_auth_info eliminados con éxito.');
    } catch (e) {
      console.error('Error eliminando archivos de baileys_auth_info:', e.message);
    }
  }
}

let isConnecting = false;

async function connectToWhatsApp(forceClean = false) {
  if (isConnecting && !forceClean) {
    console.log('⏳ Conexión a WhatsApp ALSI ya en progreso, omitiendo llamada duplicada...');
    return;
  }
  isConnecting = true;

  const credsFile = path.join(__dirname, 'baileys_auth_info', 'creds.json');
  if (forceClean) {
    clearAuthInfo();
  } else if (fs.existsSync(credsFile)) {
    try {
      const credsData = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
      if (!credsData.me) {
        console.log('🧹 Limpiando sesión previa ALSI sin autenticar para forzar emisión de nuevo QR...');
        clearAuthInfo();
      }
    } catch (e) {
      clearAuthInfo();
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');

  if (waSocket) {
    try {
      waSocket.ev.removeAllListeners();
    } catch (e) {}
  }

  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1043857760] }));

  waSocket = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000
  });

  waSocket.ev.on('creds.update', saveCreds);

  waSocket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n===================================================');
      console.log('📱 CÓDIGO QR GENERADO PARA ALSI COPROPIEDAD WHATSAPP:');
      qrcodeTerminal.generate(qr, { small: true });
      console.log('===================================================\n');

      try {
        currentQrDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 350 });
      } catch (e) {
        console.error('Error convirtiendo QR ALSI:', e.message);
      }
    }

    if (connection === 'close') {
      isConnecting = false;
      isConnected = false;
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403;

      console.log(`🔴 Conexión WhatsApp ALSI cerrada. Código: ${statusCode}. ¿Cerrada por usuario (Logout)?: ${isLoggedOut}`);

      if (isLoggedOut) {
        console.log('⚠️ Sesión cerrada por WhatsApp (Logout definitivo). Limpiando credenciales para generar nuevo QR...');
        currentQrDataUrl = null;
        clearAuthInfo();
        setTimeout(() => connectToWhatsApp(true), 3000);
      } else {
        // En cualquier otra desconexión (428, 515 restart, 408 timeout, caída de red): RECONECTAR AUTOMÁTICAMENTE
        const delay = statusCode === 515 ? 1500 : 4000;
        console.log(`⏳ Reconectando automáticamente a WhatsApp en ${delay / 1000}s usando credenciales del volumen...`);
        setTimeout(() => {
          connectToWhatsApp(false);
        }, delay);
      }
    } else if (connection === 'open') {
      isConnecting = false;
      console.log('\n===================================================');
      console.log('✅ WHATSAPP ALSI COPROPIEDAD CONECTADO EXITOSAMENTE VÍA CÓDIGO QR!');
      console.log('===================================================\n');
      isConnected = true;
      currentQrDataUrl = null;
    }
  });

  waSocket.ev.on('messages.upsert', async (m) => {
    try {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.endsWith('@g.us')) continue;

        const textMessage = msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          '';

        if (!textMessage.trim()) continue;

        const rawPhone = remoteJid.replace('@s.whatsapp.net', '');
        const senderPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
        const pushName = msg.pushName || 'Residente ALSI';

        console.log(`📩 Mensaje entrante WhatsApp ALSI de [${senderPhone}] (${pushName}): "${textMessage}"`);

        const history = getSessionHistory(remoteJid);
        const result = await processMessage({
          message: textMessage,
          history,
          senderPhone,
          pushName
        });

        if (result && result.reply) {
          updateSessionHistory(remoteJid, textMessage, result.reply);

          try {
            await waSocket.sendMessage(remoteJid, { text: result.reply });
            console.log(`📤 Respuesta enviada por WhatsApp ALSI a [${senderPhone}]!`);
          } catch (sendErr) {
            console.error(`Error enviando mensaje de texto a [${senderPhone}]:`, sendErr.message);
          }

          const qrData = result.voucher?.qrCodeDataUrl || result.voucher?.qrDataUrl;
          if (result.voucher && qrData) {
            try {
              const base64Data = qrData.replace(/^data:image\/\w+;base64,/, "");
              const buffer = Buffer.from(base64Data, 'base64');
              await waSocket.sendMessage(remoteJid, {
                image: buffer,
                caption: `🎟️ *Pase Digital de Atención ALSI Copropiedades*\n\n` +
                  `• Código: *${result.voucher.code}*\n` +
                  `• Condominio: *Condominio Portada Norte VII*\n` +
                  `• Titular: *${result.voucher.clientName}*\n\n` +
                  `Presenta este código QR al momento de tu atención en la administración. 🏢✨`
              });
              console.log(`🖼️ Código QR enviado exitosamente a [${senderPhone}]!`);
            } catch (qrErr) {
              console.error("Error enviando imagen QR:", qrErr.message);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error procesando mensaje de WhatsApp ALSI:', err);
    }
  });

  return waSocket;
}

function getWhatsAppStatus() {
  return {
    isConnected,
    qrCodeDataUrl: currentQrDataUrl
  };
}

async function reconnectWhatsApp() {
  console.log('🔄 Reconectando WhatsApp ALSI manteniendo sesión existente...');
  isConnecting = false;
  isConnected = false;
  if (waSocket) {
    try {
      waSocket.ev.removeAllListeners();
      waSocket.end(new Error('Manual reconnect'));
    } catch (e) {}
    waSocket = null;
  }
  await connectToWhatsApp(false);
  return { success: true, message: 'Reconexión iniciada con credenciales del volumen.' };
}

async function resetWhatsAppConnection() {
  console.log('🔄 Reiniciando sesión de WhatsApp ALSI...');
  isConnecting = false;
  isConnected = false;
  currentQrDataUrl = null;
  if (waSocket) {
    try {
      waSocket.ev.removeAllListeners();
      waSocket.end(new Error('Manual reset'));
    } catch (e) {}
    waSocket = null;
  }
  clearAuthInfo();
  await connectToWhatsApp(true);
  return { success: true, message: 'Sesión reiniciada. Escanee el nuevo QR.' };
}

module.exports = {
  connectToWhatsApp,
  getWhatsAppStatus,
  reconnectWhatsApp,
  resetWhatsAppConnection
};
