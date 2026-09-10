# 📸 Guía de Integración Instagram DMs — ALSI Administración Copropiedad

Esta guía detalla los pasos para conectar los Mensajes Directos (DM) de la cuenta de Instagram de **ALSI Copropiedad** al servidor de IA en Railway.

---

## 1. Datos del Webhook para Meta

- **Callback URL (URL de Webhook)**:
  `https://alsi-bot-copropiedad-production.up.railway.app/webhook/instagram`
- **Verify Token**:
  `alsi_copropiedad_secret_2026`
- **Campos a suscribir en el Webhook**:
  `messages`, `messaging_postbacks`

---

## 2. Variables de Entorno en Railway

En Railway (pestaña **Variables** del servicio `alsi-bot-copropiedad`), agrega:

```env
INSTAGRAM_VERIFY_TOKEN=alsi_copropiedad_secret_2026
INSTAGRAM_ACCESS_TOKEN=TU_PAGE_ACCESS_TOKEN_DE_META
```

---

## 3. Pasos en Meta for Developers (Facebook Developers)

### Paso A: Vincular Instagram con Página de Facebook
1. Abre Instagram en tu celular -> Perfil -> Editar Perfil -> **Página**.
2. Asegúrate de que la cuenta de Instagram esté vinculada a la **Página de Facebook de ALSI Copropiedad**.

### Paso B: Permitir acceso a mensajes en Instagram
1. En la app de Instagram de ALSI:
2. Ve a **Configuración y Privacidad** ➔ **Mensajes y respuestas a historias** ➔ **Herramientas para mensajes**.
3. Activa el interruptor: **"Permitir acceso a los mensajes"** (esto autoriza a la API de Meta a leer y responder los DMs).

### Paso C: Crear la App en Meta for Developers
1. Ingresa a [developers.facebook.com](https://developers.facebook.com/) con tu cuenta de Facebook.
2. Haz clic en **Mis apps** ➔ **Crear app**.
3. Tipo de caso de uso: selecciona **Otro** ➔ Tipo: **Empresa** (o Negocios).
4. Asigna un nombre a la app: `ALSI Copropiedad Bot`.

### Paso D: Agregar el producto "Messenger" / "Instagram Graph API"
1. En el panel de la App, busca **Messenger** o **Instagram** y haz clic en **Configurar**.
2. En la sección **Webhooks**:
   - **Callback URL**: `https://alsi-bot-copropiedad-production.up.railway.app/webhook/instagram`
   - **Verify Token**: `alsi_copropiedad_secret_2026`
   - Haz clic en **Verificar y guardar** (responderá en verde de inmediato).
   - En la lista de suscripciones, suscribe el campo **`messages`**.

### Paso E: Generar el Access Token
1. En la sección **Generación de tokens de acceso**:
2. Selecciona la Página de Facebook de ALSI vinculada a tu Instagram.
3. Haz clic en **Generar Token**.
4. Copia ese token largo y pégalo en Railway como la variable `INSTAGRAM_ACCESS_TOKEN`.
5. Haz clic en **Deploy** en Railway.

---

## 4. ¡Listo para probar!
Envía un mensaje directo (DM) desde cualquier cuenta de Instagram a la cuenta de ALSI:
> *"Hola, buenas tardes, quiero coordinar una reunión"*

El bot responderá de forma autónoma por Instagram con el mismo flujo, registrará la cita en Google Calendar y te enviará el correo por n8n.
