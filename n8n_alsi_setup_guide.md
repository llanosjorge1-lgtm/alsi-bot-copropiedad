# 🏢 Guía de Configuración e Integración n8n - ALSI Copropiedad (Portada Norte VII)

Esta guía detalla el procedimiento para importar y conectar el flujo de automatización de **ALSI Administración Copropiedad** en n8n y Railway.

---

## 1. Archivo de Flujo n8n
El archivo listo para importar se encuentra en el directorio raíz del repositorio:
📌 `n8n_workflow_alsi.json`

---

## 2. Pasos para la Importación en n8n

1. Accede a tu instancia de **n8n**.
2. Haz clic en **Workflows** -> **Import from File**.
3. Selecciona el archivo `n8n_workflow_alsi.json`.
4. El workflow cargará los siguientes 3 nodos:
   - **1. Webhook Evento ALSI** (Escucha los eventos enviados por el Bot Node.js).
   - **2. Crear Evento en Google Calendar (ALSI)** (Agenda automáticamente la cita en Google Calendar).
   - **3. Enviar Correo a contactoalsiadministracion@gmail.com** (Notifica a la administración).

---

## 3. Configuración en Railway.app

1. Sube este proyecto a tu repositorio de GitHub `alsi-bot-copropiedad`.
2. En Railway.app, crea un **Volume** montado en `/app/baileys_auth_info` para mantener viva la sesión de WhatsApp.
3. Configura la variable de entorno `N8N_WEBHOOK_URL` con la URL de producción del webhook en n8n:
   ```env
   N8N_WEBHOOK_URL=https://tu-n8n.com/webhook/alsi-copropiedad-event
   ```
4. Abre `https://tu-app-railway.up.railway.app/qr` y escanea el código QR una sola vez.
