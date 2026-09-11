document.addEventListener('DOMContentLoaded', () => {
  // Navigation handling
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');

  const tabMeta = {
    'tab-status': { title: 'Conexión de WhatsApp Business', subtitle: 'Escanea el código QR para vinculación directa del número exclusivo de Condominio Portada Norte VII' },
    'tab-chat': { title: 'Simulador Interactivo de Chat', subtitle: 'Prueba en vivo el motor de atención de residentes y agendamiento' },
    'tab-appointments': { title: 'Reuniones de Atención & Gestión CRM', subtitle: 'Seguimiento de reuniones con residentes, responsables asignados y acuerdos pactados' },
    'tab-incidents': { title: 'Reportes de Incidencias de Comunidad', subtitle: 'Gestión de tickets de fallas en portón, conserjería, bombas y áreas comunes' },
    'tab-habitaops': { title: 'Informes de Operaciones HabitaOps', subtitle: 'Vinculación de rondas, inspecciones y reportes técnicos desde Google Drive y correo' },
    'tab-reports': { title: 'Informe para la Comunidad & Liberación de Factura', subtitle: 'Rendición consolidada de cuentas para el Comité de Administración con formato imprimible en PDF' },
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
      if (targetTab === 'tab-habitaops') loadHabitaOps();
      if (targetTab === 'tab-reports') loadExecutiveReport();
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

  // Pre-cargar todas las secciones de datos inmediatamente
  loadAppointments();
  loadIncidents();
  loadHabitaOps();
  loadExecutiveReport();
  loadVouchers();
  loadBanking();

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
    loadHabitaOps();
    loadExecutiveReport();
    loadVouchers();
    loadBanking();
  });

  // Formularios manuales de Citas e Incidencias
  const btnToggleNewApt = document.getElementById('btn-toggle-new-apt');
  const btnCancelNewApt = document.getElementById('btn-cancel-new-apt');
  const formNewAptContainer = document.getElementById('form-new-apt-container');
  const formNewApt = document.getElementById('form-new-appointment');

  btnToggleNewApt?.addEventListener('click', () => {
    if (formNewAptContainer) {
      formNewAptContainer.style.display = formNewAptContainer.style.display === 'none' ? 'block' : 'none';
    }
  });

  btnCancelNewApt?.addEventListener('click', () => {
    if (formNewAptContainer) formNewAptContainer.style.display = 'none';
  });

  formNewApt?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      clientName: document.getElementById('apt-name').value.trim(),
      clientPhone: document.getElementById('apt-phone').value.trim(),
      unitNumber: document.getElementById('apt-unit').value.trim(),
      dateTime: document.getElementById('apt-datetime').value.trim(),
      asunto: document.getElementById('apt-subject').value.trim()
    };

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        formNewApt.reset();
        if (formNewAptContainer) formNewAptContainer.style.display = 'none';
        loadAppointments();
      } else {
        alert(data.message || 'Error al agendar reunión');
      }
    } catch (err) {
      alert('Error de conexión al agendar');
    }
  });

  const btnToggleNewInc = document.getElementById('btn-toggle-new-inc');
  const btnCancelNewInc = document.getElementById('btn-cancel-new-inc');
  const formNewIncContainer = document.getElementById('form-new-inc-container');
  const formNewInc = document.getElementById('form-new-incident');

  btnToggleNewInc?.addEventListener('click', () => {
    if (formNewIncContainer) {
      formNewIncContainer.style.display = formNewIncContainer.style.display === 'none' ? 'block' : 'none';
    }
  });

  btnCancelNewInc?.addEventListener('click', () => {
    if (formNewIncContainer) formNewIncContainer.style.display = 'none';
  });

  formNewInc?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      clientName: document.getElementById('inc-name').value.trim(),
      unitNumber: document.getElementById('inc-unit').value.trim(),
      priority: document.getElementById('inc-priority').value,
      description: document.getElementById('inc-desc').value.trim()
    };

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        formNewInc.reset();
        if (formNewIncContainer) formNewIncContainer.style.display = 'none';
        loadIncidents();
      } else {
        alert(data.message || 'Error al registrar reporte');
      }
    } catch (err) {
      alert('Error de conexión al registrar reporte');
    }
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
        // Sincronizar datos de reuniones e incidencias si cambiaron durante el chat
        loadAppointments();
        loadIncidents();
        loadHabitaOps();
        loadExecutiveReport();
        loadVouchers();
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

  // Variables y Lógica del Modal CRM
  let cachedAppointments = [];
  const modalCrmBackdrop = document.getElementById('modal-crm-backdrop');
  const btnCloseCrmModal = document.getElementById('btn-close-crm-modal');
  const btnCancelCrm = document.getElementById('btn-cancel-crm');
  const formCrmModal = document.getElementById('form-crm-modal');

  function openCrmModal(id) {
    const apt = cachedAppointments.find(a => a.id === id);
    if (!apt) return;

    document.getElementById('crm-apt-id').value = apt.id;
    document.getElementById('crm-modal-title').innerHTML = `<i class="fa-solid fa-user-check text-emerald"></i> Seguimiento CRM: ${apt.clientName}`;
    document.getElementById('crm-modal-subtitle').textContent = `ID: ${apt.id} • Depto: ${apt.unitNumber || 'Por Especificar'} • ${apt.dateTime}`;
    document.getElementById('crm-attended-by').value = apt.attendedBy || 'Jorge Llanos (Administrador)';
    document.getElementById('crm-followup-status').value = apt.followUpStatus || (apt.status === 'Realizada' ? 'Realizada / Resuelta' : apt.status || 'Agendada');
    document.getElementById('crm-resolution').value = apt.resolution || '';
    document.getElementById('crm-notes').value = apt.notes || '';

    if (modalCrmBackdrop) modalCrmBackdrop.style.display = 'flex';
  }

  function closeCrmModal() {
    if (modalCrmBackdrop) modalCrmBackdrop.style.display = 'none';
  }

  btnCloseCrmModal?.addEventListener('click', closeCrmModal);
  btnCancelCrm?.addEventListener('click', closeCrmModal);
  modalCrmBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalCrmBackdrop) closeCrmModal();
  });

  formCrmModal?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const aptId = document.getElementById('crm-apt-id').value;
    const payload = {
      attendedBy: document.getElementById('crm-attended-by').value.trim(),
      followUpStatus: document.getElementById('crm-followup-status').value,
      resolution: document.getElementById('crm-resolution').value.trim(),
      notes: document.getElementById('crm-notes').value.trim()
    };

    try {
      const res = await fetch(`/api/appointments/${aptId}/crm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        closeCrmModal();
        loadAppointments();
        loadExecutiveReport();
      } else {
        alert(data.message || 'Error al guardar seguimiento CRM');
      }
    } catch (err) {
      alert('Error de conexión al guardar seguimiento CRM');
    }
  });

  async function loadAppointments() {
    try {
      const res = await fetch('/api/appointments');
      const data = await res.json();
      const tbody = document.querySelector('#table-appointments tbody');
      cachedAppointments = data.appointments || [];

      if (!cachedAppointments || cachedAppointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay reuniones agendadas aún.</td></tr>';
        return;
      }

      tbody.innerHTML = cachedAppointments.map(apt => {
        const followStatus = apt.followUpStatus || (apt.status === 'Realizada' ? 'Realizada / Resuelta' : apt.status);
        let badgeClass = 'badge-info';
        if (followStatus === 'Realizada / Resuelta' || followStatus === 'Realizada') badgeClass = 'badge-success';
        else if (followStatus === 'Cancelada') badgeClass = 'badge-danger';
        else if (followStatus === 'En Gestión') badgeClass = 'badge-warning';

        return `
          <tr>
            <td><code class="code-tag">${apt.id}</code></td>
            <td><strong>${apt.clientName}</strong></td>
            <td>${apt.unitNumber || 'Por Especificar'}</td>
            <td>${apt.asunto || apt.serviceType}</td>
            <td><span class="badge badge-info">${apt.dateTime}</span></td>
            <td>
              ${apt.attendedBy 
                ? `<span class="badge badge-emerald"><i class="fa-solid fa-user-tie"></i> ${apt.attendedBy}</span>`
                : `<span class="text-muted"><i class="fa-regular fa-clock"></i> Por Asignar</span>`}
            </td>
            <td>
              <span class="badge ${badgeClass}">${followStatus}</span>
              ${apt.resolution 
                ? `<div style="font-size: 0.76rem; color: #94a3b8; margin-top: 5px; max-width: 250px; line-height: 1.25;"><i class="fa-solid fa-check text-emerald"></i> ${apt.resolution.slice(0, 95)}${apt.resolution.length > 95 ? '...' : ''}</div>` 
                : ''}
            </td>
            <td>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="btn btn-sm btn-primary open-crm-modal" data-id="${apt.id}" title="Gestionar Seguimiento y Resolución">
                  <i class="fa-solid fa-user-gear"></i> CRM / Caso
                </button>
                ${apt.status !== 'Cancelada'
                  ? `<button class="btn btn-sm btn-outline cancel-appointment" data-id="${apt.id}" title="Cancelar Reunión">
                      <i class="fa-solid fa-ban text-danger"></i>
                    </button>`
                  : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      document.querySelectorAll('.open-crm-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          openCrmModal(id);
        });
      });

      document.querySelectorAll('.cancel-appointment').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          if (confirm(`¿Deseas cancelar la reunión ${id}?`)) {
            await fetch(`/api/appointments/${id}/cancel`, { method: 'POST' });
            loadAppointments();
            loadExecutiveReport();
          }
        });
      });
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
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay incidencias reportadas.</td></tr>';
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
              ? `<button class="btn btn-sm btn-outline resolve-incident" data-id="${inc.id}"><i class="fa-solid fa-check text-success"></i> Resolver</button>`
              : '<span class="text-muted"><i class="fa-solid fa-check text-success"></i> Resuelto</span>'}
          </td>
        </tr>
      `).join('');

      document.querySelectorAll('.resolve-incident').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          await fetch(`/api/incidents/${id}/resolve`, { method: 'POST' });
          loadIncidents();
          loadExecutiveReport();
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

  // ==========================================
  // INFORMES HABITAOPS (GOOGLE DRIVE & CORREO)
  // ==========================================
  const btnToggleNewHop = document.getElementById('btn-toggle-new-habitaops');
  const btnCancelNewHop = document.getElementById('btn-cancel-new-hop');
  const formNewHopContainer = document.getElementById('form-new-hop-container');
  const formNewHop = document.getElementById('form-new-habitaops');

  btnToggleNewHop?.addEventListener('click', () => {
    if (formNewHopContainer) {
      const isHidden = formNewHopContainer.style.display === 'none';
      formNewHopContainer.style.display = isHidden ? 'block' : 'none';
      const dateInput = document.getElementById('hop-date');
      if (isHidden && dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }
    }
  });

  btnCancelNewHop?.addEventListener('click', () => {
    if (formNewHopContainer) formNewHopContainer.style.display = 'none';
  });

  formNewHop?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('hop-title').value.trim(),
      category: document.getElementById('hop-category').value,
      reportDate: document.getElementById('hop-date').value,
      status: document.getElementById('hop-status').value,
      driveUrl: document.getElementById('hop-url').value.trim(),
      observations: document.getElementById('hop-obs').value.trim()
    };

    try {
      const res = await fetch('/api/habitaops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        formNewHop.reset();
        if (formNewHopContainer) formNewHopContainer.style.display = 'none';
        loadHabitaOps();
        loadExecutiveReport();
      } else {
        alert(data.message || 'Error al guardar informe HabitaOps');
      }
    } catch (err) {
      alert('Error de red al guardar informe HabitaOps');
    }
  });

  async function loadHabitaOps() {
    try {
      const res = await fetch('/api/habitaops');
      const data = await res.json();
      const tbody = document.querySelector('#table-habitaops tbody');
      const reports = data.reports || [];

      if (!tbody) return;

      if (!reports || reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay informes de HabitaOps vinculados aún.</td></tr>';
        return;
      }

      tbody.innerHTML = reports.map(r => `
        <tr>
          <td><span class="badge badge-info">${r.reportDate}</span></td>
          <td><strong>${r.title}</strong></td>
          <td><span class="badge badge-emerald">${r.category}</span></td>
          <td>
            <span class="badge ${r.status === 'Conforme' ? 'badge-success' : r.status === 'Con Observaciones' ? 'badge-warning' : 'badge-danger'}">
              ${r.status}
            </span>
          </td>
          <td><div style="font-size: 0.8rem; color: #94a3b8; max-width: 250px; line-height: 1.3;">${r.observations || '-'}</div></td>
          <td>
            <a href="${r.driveUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="color: var(--accent-emerald);">
              <i class="fa-brands fa-google-drive"></i> Abrir en Drive
            </a>
          </td>
          <td>
            <button class="btn btn-sm btn-outline text-danger delete-hop" data-id="${r.id}" title="Eliminar informe">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');

      document.querySelectorAll('.delete-hop').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          if (confirm('¿Deseas desvincular este informe de HabitaOps?')) {
            await fetch(`/api/habitaops/${id}`, { method: 'DELETE' });
            loadHabitaOps();
            loadExecutiveReport();
          }
        });
      });
    } catch (err) {
      console.error('Error cargando informes HabitaOps:', err);
    }
  }

  // ======================================================================
  // INFORME EJECUTIVO CONSOLIDADO PARA LA COMUNIDAD & LIBERACIÓN DE FACTURA
  // ======================================================================
  async function loadExecutiveReport() {
    try {
      const res = await fetch('/api/reports/executive-summary');
      const data = await res.json();
      if (!data.success) return;

      const dateNowStr = new Date().toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const reportDateElem = document.getElementById('report-date-now');
      if (reportDateElem) reportDateElem.textContent = dateNowStr;

      const m = data.metrics || {};
      const kpiMeetings = document.getElementById('kpi-total-meetings');
      const kpiSubMeetings = document.getElementById('kpi-sub-meetings');
      const kpiIncidents = document.getElementById('kpi-total-incidents');
      const kpiSubIncidents = document.getElementById('kpi-sub-incidents');
      const kpiHabitaOps = document.getElementById('kpi-total-habitaops');
      const kpiEffectiveness = document.getElementById('kpi-effectiveness');

      if (kpiMeetings) kpiMeetings.textContent = m.totalAppointments || 0;
      if (kpiSubMeetings) kpiSubMeetings.textContent = `${m.resolvedAppointments || 0} resueltas (${m.appointmentResolutionRate || 100}%)`;
      if (kpiIncidents) kpiIncidents.textContent = m.totalIncidents || 0;
      if (kpiSubIncidents) kpiSubIncidents.textContent = `${m.resolvedIncidents || 0} resueltas (${m.incidentResolutionRate || 100}%)`;
      if (kpiHabitaOps) kpiHabitaOps.textContent = m.totalHabitaOps || 0;

      const totalItems = (m.totalAppointments || 0) + (m.totalIncidents || 0);
      const totalResolved = (m.resolvedAppointments || 0) + (m.resolvedIncidents || 0);
      const globalRate = totalItems > 0 ? Math.round((totalResolved / totalItems) * 100) : 100;
      if (kpiEffectiveness) kpiEffectiveness.textContent = `${globalRate}%`;

      // Tabla de reuniones del informe
      const meetingsTbody = document.querySelector('#report-table-meetings tbody');
      if (meetingsTbody) {
        if (!data.appointments || data.appointments.length === 0) {
          meetingsTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No se registraron reuniones en el período.</td></tr>';
        } else {
          meetingsTbody.innerHTML = data.appointments.map(a => `
            <tr>
              <td><strong>${a.dateTime || '-'}</strong></td>
              <td>${a.clientName}</td>
              <td>${a.unitNumber || 'Por Especificar'}</td>
              <td>${a.asunto || a.serviceType}</td>
              <td><strong>${a.attendedBy || 'Por Asignar'}</strong></td>
              <td>
                <span class="badge ${a.status === 'Realizada' ? 'badge-success' : a.status === 'Cancelada' ? 'badge-danger' : 'badge-warning'}">
                  ${a.followUpStatus || a.status}
                </span>
              </td>
              <td><em>${a.resolution || 'En proceso de atención y seguimiento.'}</em></td>
            </tr>
          `).join('');
        }
      }

      // Tabla de incidencias del informe
      const incidentsTbody = document.querySelector('#report-table-incidents tbody');
      if (incidentsTbody) {
        if (!data.incidents || data.incidents.length === 0) {
          incidentsTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No se registraron incidencias en el período.</td></tr>';
        } else {
          incidentsTbody.innerHTML = data.incidents.map(i => `
            <tr>
              <td><code>${i.id}</code></td>
              <td>${i.createdAt ? new Date(i.createdAt).toLocaleDateString('es-CL') : '-'}</td>
              <td><strong>${i.clientName}</strong> (Depto ${i.unitNumber})</td>
              <td>${i.description}</td>
              <td><span class="badge ${i.priority === 'Alta' ? 'badge-danger' : 'badge-info'}">${i.priority}</span></td>
              <td><span class="badge ${i.status === 'Resuelto' ? 'badge-success' : 'badge-warning'}">${i.status}</span></td>
            </tr>
          `).join('');
        }
      }

      // Tabla de HabitaOps del informe
      const hopTbody = document.querySelector('#report-table-habitaops tbody');
      if (hopTbody) {
        if (!data.habitaOpsReports || data.habitaOpsReports.length === 0) {
          hopTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No se vincularon informes de HabitaOps en el período.</td></tr>';
        } else {
          hopTbody.innerHTML = data.habitaOpsReports.map(h => `
            <tr>
              <td><strong>${h.reportDate}</strong></td>
              <td>${h.title}</td>
              <td><span class="badge badge-emerald">${h.category}</span></td>
              <td><span class="badge ${h.status === 'Conforme' ? 'badge-success' : 'badge-warning'}">${h.status}</span></td>
              <td>${h.observations || 'Sin observaciones adicionales.'}</td>
              <td>
                <a href="${h.driveUrl}" target="_blank" rel="noopener noreferrer" style="color: #047857; font-weight: 600; text-decoration: underline;">
                  Verificar en Drive
                </a>
              </td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Error cargando informe ejecutivo:', err);
    }
  }

  document.getElementById('btn-print-report')?.addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btn-refresh-report')?.addEventListener('click', () => {
    loadExecutiveReport();
  });
});
