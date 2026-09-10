document.addEventListener('DOMContentLoaded', () => {
  // Navigation handling
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');

  const tabMeta = {
    'tab-status': { title: 'Conexión de WhatsApp Business', subtitle: 'Escanea el código QR para vinculación directa del número exclusivo de Condominio Portada Norte VII' },
    'tab-chat': { title: 'Simulador Interactivo de Chat', subtitle: 'Prueba en vivo el motor de atención de residentes y agendamiento' },
    'tab-appointments': { title: 'Reuniones de Atención Agendadas', subtitle: 'Listado de citas sincronizadas autónomamente con Google Calendar' },
    'tab-incidents': { title: 'Reportes de Incidencias de Comunidad', subtitle: 'Gestión de tickets de fallas en portón, conserjería, bombas, etc.' },
    'tab-vouchers': { title: 'Pases Digitales QR', subtitle: 'Emisión y validación de comprobantes de ingreso a reuniones' },
    'tab-banking': { title: 'Datos Bancarios Oficiales', subtitle: 'Configuración de cuenta corriente para recepción de gastos comunes' }
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      
      navItems.forEach(n => n.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(targetTab).classList.add('active');

      if (tabMeta[targetTab]) {
        pageTitle.textContent = tabMeta[targetTab].title;
        pageSubtitle.textContent = tabMeta[targetTab].subtitle;
      }

      if (targetTab === 'tab-appointments') loadAppointments();
      if (targetTab === 'tab-incidents') loadIncidents();
      if (targetTab === 'tab-vouchers') loadVouchers();
      if (targetTab === 'tab-banking') loadBanking();
    });
  });

  let statusPollTimer = null;

  async function checkStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      const badge = document.getElementById('global-status-badge');
      const text = document.getElementById('global-status-text');
      const qrWrapper = document.getElementById('qr-wrapper');
      const qrImage = document.getElementById('qr-image');
      const qrPlaceholder = document.getElementById('qr-placeholder');

      if (data.isConnected) {
        badge.className = 'connection-status-badge Connected';
        text.textContent = 'Conectado a WhatsApp Business';
        qrImage.style.display = 'none';
        qrPlaceholder.innerHTML = '<i class="fa-solid fa-circle-check text-success fa-4x"></i><p class="mt-3"><strong>¡WhatsApp ALSI Copropiedad Conectado Exitosamente!</strong></p>';
        qrPlaceholder.style.display = 'block';
      } else {
        badge.className = 'connection-status-badge Disconnected';
        text.textContent = 'Esperando escaneo QR...';

        if (data.qrCodeDataUrl) {
          qrImage.src = data.qrCodeDataUrl;
          qrImage.style.display = 'block';
          qrPlaceholder.style.display = 'none';
        } else {
          qrImage.style.display = 'none';
          qrPlaceholder.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin fa-3x"></i><p class="mt-3">Generando Código QR...</p>';
          qrPlaceholder.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('Error comprobando estado ALSI:', err);
    }
  }

  checkStatus();
  statusPollTimer = setInterval(checkStatus, 3000);

  document.getElementById('btn-reset-qr')?.addEventListener('click', async () => {
    if (confirm('¿Deseas reiniciar la sesión de WhatsApp y generar un nuevo código QR?')) {
      try {
        const res = await fetch('/api/reset-whatsapp', { method: 'POST' });
        const result = await res.json();
        alert(result.message || 'Sesión reiniciada');
        checkStatus();
      } catch (err) {
        alert('Error al reiniciar sesión');
      }
    }
  });

  document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
    checkStatus();
    loadAppointments();
    loadIncidents();
    loadVouchers();
  });

  const chatWindow = document.getElementById('chat-window');
  const chatInput = document.getElementById('chat-input');
  const btnSendChat = document.getElementById('btn-send-chat');

  let chatHistory = [];

  async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    appendChatMessage('user', message);
    chatInput.value = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: chatHistory
        })
      });
      const data = await res.json();

      if (data.success && data.reply) {
        chatHistory.push({ role: 'user', content: message });
        chatHistory.push({ role: 'assistant', content: data.reply });
        appendChatMessage('bot', data.reply, data.voucher?.qrCodeDataUrl);
      }
    } catch (err) {
      appendChatMessage('bot', '❌ Error comunicándose con el servidor');
    }
  }

  function appendChatMessage(role, text, qrUrl = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}-message`;
    
    let html = `<div class="message-content">${formatMarkdown(text)}`;
    if (qrUrl) {
      html += `<div class="mt-2 text-center"><img src="${qrUrl}" alt="Pase QR" style="max-width: 180px; border-radius: 8px;"></div>`;
    }
    html += `</div><span class="message-time">${role === 'user' ? 'Tú' : 'ALSI Bot'}</span>`;

    msgDiv.innerHTML = html;
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function formatMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  btnSendChat?.addEventListener('click', sendChatMessage);
  chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  async function loadAppointments() {
    try {
      const res = await fetch('/api/appointments');
      const data = await res.json();
      const tbody = document.querySelector('#table-appointments tbody');

      if (!data.appointments || data.appointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay reuniones agendadas aún.</td></tr>';
        return;
      }

      tbody.innerHTML = data.appointments.map(apt => `
        <tr>
          <td><code class="code-tag">${apt.id}</code></td>
          <td><strong>${apt.clientName}</strong></td>
          <td>${apt.unitNumber || 'Por Especificar'}</td>
          <td>${apt.asunto || apt.serviceType}</td>
          <td><span class="badge badge-info">${apt.dateTime}</span></td>
          <td><span class="badge badge-success">${apt.status}</span></td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error cargando citas ALSI:', err);
    }
  }

  async function loadIncidents() {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      const tbody = document.querySelector('#table-incidents tbody');

      if (!data.incidents || data.incidents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay incidencias reportadas.</td></tr>';
        return;
      }

      tbody.innerHTML = data.incidents.map(inc => `
        <tr>
          <td><code class="code-tag">${inc.id}</code></td>
          <td><strong>${inc.clientName}</strong></td>
          <td>${inc.unitNumber}</td>
          <td>${inc.description}</td>
          <td><span class="badge ${inc.priority === 'Alta' ? 'badge-danger' : 'badge-info'}">${inc.priority}</span></td>
          <td><span class="badge ${inc.status === 'Resuelto' ? 'badge-success' : 'badge-warning'}">${inc.status}</span></td>
          <td>
            ${inc.status !== 'Resuelto' 
              ? `<button class="btn btn-sm btn-outline resolve-incident" data-id="${inc.id}"><i class="fa-solid fa-check"></i> Resolver</button>`
              : '<span class="text-muted">Resuelto</span>'}
          </td>
        </tr>
      `).join('');

      document.querySelectorAll('.resolve-incident').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          await fetch(`/api/incidents/${id}/resolve`, { method: 'POST' });
          loadIncidents();
        });
      });
    } catch (err) {
      console.error('Error cargando incidencias ALSI:', err);
    }
  }

  async function loadVouchers() {
    try {
      const res = await fetch('/api/vouchers');
      const data = await res.json();
      const container = document.getElementById('vouchers-container');

      if (!data.vouchers || data.vouchers.length === 0) {
        container.innerHTML = '<p class="text-center">No hay pases digitales emitidos aún.</p>';
        return;
      }

      container.innerHTML = data.vouchers.map(v => `
        <div class="voucher-card">
          <div class="voucher-header">
            <strong>${v.voucherType}</strong>
            <code class="code-tag">${v.code}</code>
          </div>
          <div class="voucher-body">
            <p><strong>Residente:</strong> ${v.clientName}</p>
            <p><strong>Detalle:</strong> ${v.discountOrAmount}</p>
            <p><strong>Estado:</strong> <span class="badge ${v.status === 'Canjeado' ? 'badge-warning' : 'badge-success'}">${v.status}</span></p>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Error cargando vouchers ALSI:', err);
    }
  }

  document.getElementById('btn-redeem-code')?.addEventListener('click', async () => {
    const code = document.getElementById('redeem-code-input').value.trim();
    if (!code) return alert('Por favor ingrese un código');

    try {
      const res = await fetch('/api/vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      const resultDiv = document.getElementById('redeem-result');
      resultDiv.style.display = 'block';

      if (data.success) {
        resultDiv.className = 'redeem-result alert alert-success';
        resultDiv.innerHTML = `<strong>✅ ${data.message}</strong><br><p>Residente: ${data.voucher?.clientName}</p>`;
      } else {
        resultDiv.className = 'redeem-result alert alert-danger';
        resultDiv.innerHTML = `<strong>⚠️ ${data.message}</strong>`;
      }
      loadVouchers();
    } catch (err) {
      alert('Error al validar código');
    }
  });

  async function loadBanking() {
    try {
      const res = await fetch('/api/company-payments');
      const data = await res.json();
      if (data.company) {
        document.getElementById('bank-holder').value = data.company.holderName || '';
        document.getElementById('bank-rut').value = data.company.rut || '';
        document.getElementById('bank-name').value = data.company.bankName || '';
        document.getElementById('bank-type').value = data.company.accountType || '';
        document.getElementById('bank-number').value = data.company.accountNumber || '';
        document.getElementById('bank-email').value = data.company.emailNotification || '';
        document.getElementById('bank-instructions').value = data.company.instructions || '';
      }
    } catch (err) {}
  }

  document.getElementById('form-banking')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      holderName: document.getElementById('bank-holder').value,
      rut: document.getElementById('bank-rut').value,
      bankName: document.getElementById('bank-name').value,
      accountType: document.getElementById('bank-type').value,
      accountNumber: document.getElementById('bank-number').value,
      emailNotification: document.getElementById('bank-email').value,
      instructions: document.getElementById('bank-instructions').value
    };

    try {
      const res = await fetch('/api/company-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Datos bancarios guardados exitosamente');
      }
    } catch (err) {
      alert('Error guardando datos bancarios');
    }
  });
});
