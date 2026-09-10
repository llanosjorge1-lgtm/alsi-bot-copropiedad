# 🏢 Guía de Configuración n8n — ALSI Administración Copropiedad (Portada Norte VII)

## Archivo de Flujo

📌 `n8n_workflow_alsi.json` — Flujo completo con **7 nodos** y enrutamiento por tipo de evento.

---

## Arquitectura del Flujo

```
Webhook → Switch (por event type)
             ├─ MEETING_BOOKED    → Crear Evento Calendar → Correo ✅
             ├─ MEETING_CANCELED  → Correo 🚫
             ├─ INCIDENT_REPORTED → Correo 🚨
             └─ PAYMENT_RECEIPT   → Correo 🧾
```

---

## Paso 1: Importar el Workflow en n8n

1. Abre tu instancia de **n8n**.
2. Ve a **Workflows** → **Import from File**.
3. Selecciona `n8n_workflow_alsi.json`.
4. Verás **7 nodos** organizados en 4 ramas.

---

## Paso 2: Configurar Credenciales

### A) Google Calendar OAuth2

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear proyecto → Habilitar **Google Calendar API**
3. Crear credenciales **OAuth 2.0 Client ID** (tipo "Web Application")
4. Redirect URI: `https://TU-N8N/rest/oauth2-credential/callback`
5. En n8n → **Credentials** → **New** → **Google Calendar OAuth2 API**
6. Pegar Client ID y Client Secret → Autorizar con la cuenta `contactoalsiadministracion@gmail.com`
7. El nodo **"3a. Crear Evento Google Calendar"** usará esta credencial automáticamente.

### B) SMTP Gmail

1. En la cuenta Gmail de ALSI (`contactoalsiadministracion@gmail.com`), activar **Verificación en 2 pasos**
2. Ir a [App Passwords](https://myaccount.google.com/apppasswords)
3. Generar contraseña de aplicación → Seleccionar "Correo" → "Otro (n8n)"
4. En n8n → **Credentials** → **New** → **SMTP** con:
   - **Host**: `smtp.gmail.com`
   - **Port**: `465`
   - **SSL**: `true`
   - **User**: `contactoalsiadministracion@gmail.com`
   - **Password**: la App Password generada
5. Los nodos de correo (4a, 4b, 3c, 3d) usarán esta credencial.

---

## Paso 3: Activar el Workflow

1. Haz clic en el interruptor **Active** (esquina superior derecha en n8n).
2. El webhook quedará escuchando en: `https://TU-N8N/webhook/alsi-copropiedad-event`
3. Copia esa URL.

---

## Paso 4: Configurar la Variable de Entorno en Railway

En el servicio de Railway de ALSI, agrega la variable:

```env
N8N_WEBHOOK_URL=https://TU-N8N/webhook/alsi-copropiedad-event
```

Reemplaza `TU-N8N` con el dominio real de tu instancia n8n.

---

## Tipos de Evento que Procesa el Flujo

| Evento | Campo `event` | Acción |
|--------|--------------|--------|
| Reunión agendada | `MEETING_BOOKED` | Crea evento en Calendar + Correo con datos de la cita |
| Reunión cancelada | `MEETING_CANCELED` | Correo de notificación de cancelación |
| Incidencia reportada | `INCIDENT_REPORTED` | Correo con ticket ID, prioridad y descripción |
| Comprobante de pago | `PAYMENT_RECEIPT_SUBMITTED` | Correo con monto, Nº operación y código de recibo |

---

## Verificación

Para probar el webhook manualmente:

```bash
curl -X POST https://TU-N8N/webhook/alsi-copropiedad-event \
  -H "Content-Type: application/json" \
  -d '{"event":"MEETING_BOOKED","clientName":"Juan Pérez","unitNumber":"501","meetingReason":"Consulta gastos comunes","dateTime":"2026-09-15 10:00","startIso":"2026-09-15T10:00:00-03:00","endIso":"2026-09-15T10:30:00-03:00","voucherCode":"ALSI-TEST-001"}'
```
