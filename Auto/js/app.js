'use strict';

// ============================================================
//  AutoGest — Application SPA principale
// ============================================================

/* ---- Configuration ---- */
const API_BASE = './api';

/* ---- État global ---- */
const State = {
  user: null,
  token: null,
  vehicles: [],
  members: [],
  currentSection: 'dashboard',
  currentVehicle: null,
  guideArticles: [],
};

// ============================================================
//  API — Couche de communication
// ============================================================
const API = {
  headers() {
    return {
      'Authorization': `Bearer ${State.token}`,
      'Content-Type': 'application/json',
    };
  },

  async request(method, endpoint, body = null) {
    const opts = { method, headers: this.headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}/${endpoint}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  },

  async upload(endpoint, formData) {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${State.token}` },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  },

  get:    (ep) => API.request('GET', ep),
  post:   (ep, body) => API.request('POST', ep, body),
  put:    (ep, body) => API.request('PUT', ep, body),
  delete: (ep) => API.request('DELETE', ep),
};

// ============================================================
//  AUTH — Authentification
// ============================================================
const Auth = {
  async login(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const data = await this.apiCall('auth.php?action=login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        // Enregistrement de la session
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Redirection en fonction du rôle
        if (data.user.role === 'employee') {
            window.location.href = 'employe.html';
        } else {
            window.location.href = 'admin.html';
        }

    } catch (err) {
        alert(err.message);
    }
  },

  async register(evt) {
    evt.preventDefault();
    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl    = document.getElementById('register-error');
    const btn      = document.getElementById('btn-register');
    errEl.classList.add('hidden');
    UI.btnLoading(btn, true);
    try {
      const data = await fetch(`${API_BASE}/auth.php?action=register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      }).then(r => r.json().then(d => { if (!r.ok) throw new Error(d.error); return d; }));
      Auth._saveSession(data);
      await App.launch();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    } finally {
      UI.btnLoading(btn, false);
    }
  },

  async logout() {
    try { await fetch(`${API_BASE}/auth.php?action=logout`, { method: 'POST', headers: API.headers() }); } catch {}
    Auth._clearSession();
    App.showAuth();
  },

  _saveSession(data) {
    State.user  = data.user;
    State.token = data.token;
    localStorage.setItem('ag_token', data.token);
    localStorage.setItem('ag_user',  JSON.stringify(data.user));
  },

  _clearSession() {
    State.user  = null;
    State.token = null;
    State.vehicles = [];
    State.members  = [];
    localStorage.removeItem('ag_token');
    localStorage.removeItem('ag_user');
  },

  loadFromStorage() {
    State.token = localStorage.getItem('ag_token');
    const u = localStorage.getItem('ag_user');
    if (u) try { State.user = JSON.parse(u); } catch {}
  },

  isLoggedIn: () => !!(State.token && State.user),
};

// ============================================================
//  UI — Helpers interface
// ============================================================
const UI = {
  switchAuthTab(tab) {
    document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  },

  btnLoading(btn, loading) {
    btn.disabled = loading;
    if (loading) {
      btn._orig = btn.innerHTML;
      btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin:0"></span>';
    } else {
      btn.innerHTML = btn._orig || btn.innerHTML;
    }
  },

  updateSidebarUser() {
    const u = State.user;
    if (!u) return;
    document.getElementById('sidebar-name').textContent = u.name;
    document.getElementById('sidebar-avatar').textContent = u.name.charAt(0).toUpperCase();
    
    const roleEl = document.getElementById('sidebar-role');
    if (roleEl) {
      roleEl.textContent = u.role === 'admin' ? 'Administrateur' : 'Employé';
    }
  },

  setActiveNav(section) {
    document.querySelectorAll('.nav-item[data-section], .bottom-nav-item[data-section]').forEach(el => {
      el.classList.toggle('active', el.dataset.section === section);
    });
  },

  setHeaderTitle(title) {
    document.getElementById('header-title').textContent = title;
  },

  showVehicleSelector(show) {
    const sel = document.getElementById('vehicle-selector');
    sel.classList.toggle('hidden', !show);
    if (show) this.populateVehicleSelector();
  },

  populateVehicleSelector() {
    const sel = document.getElementById('vehicle-selector');
    const cur = State.currentVehicle?.id || '';
    sel.innerHTML = '<option value="">— Choisir un véhicule —</option>' +
      State.vehicles.map(v =>
        `<option value="${v.id}" ${v.id == cur ? 'selected' : ''}>${v.make} ${v.model} (${v.license_plate})</option>`
      ).join('');
  },

  showAddBtn(show, label = '+ Ajouter') {
    const btn = document.getElementById('btn-add-primary');
    btn.textContent = label;
    btn.classList.toggle('hidden', !show);
    btn.onclick = () => App.onAddPrimary && App.onAddPrimary();
  },

  setContent(html) {
    document.getElementById('app-content').innerHTML = html;
  },

  openModal(title, bodyHtml, footerHtml = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML  = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  openGuideModal(title, bodyHtml) {
    document.getElementById('guide-modal-title').textContent = title;
    document.getElementById('guide-modal-body').innerHTML   = bodyHtml;
    document.getElementById('guide-modal-overlay').classList.remove('hidden');
  },

  closeGuideModal() {
    document.getElementById('guide-modal-overlay').classList.add('hidden');
  },

  toast(message, type = 'default') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
      el.style.animation = 'fadeOut .3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  },

  confirm(message) {
    return window.confirm(message);
  },

  openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('visible');
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('visible');
  },

  /* --- Rendu des avatars --- */
  avatar(name, color, size = 32) {
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return `<div class="user-avatar" style="width:${size}px;height:${size}px;background:${color};font-size:${size*0.38}px">${initials}</div>`;
  },

  /* --- Formatage --- */
  fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  fmtMileage: (m) => m ? Number(m).toLocaleString('fr-FR') + ' km' : '—',
  fmtCost:    (c) => c != null ? Number(c).toFixed(2) + ' €' : '—',
  fmtLiters:  (l) => l != null ? Number(l).toFixed(2) + ' L' : '—',
};

// ============================================================
//  ROUTER — Navigation entre sections
// ============================================================
const Router = {
  sections: {
    dashboard: { title: 'Tableau de Bord',   render: () => Dashboard.render() },
    garage:    { title: 'Mon Garage',         render: () => Garage.render()    },
    history:   { title: 'Historique',         render: () => History.render()   },
    glovebox:  { title: 'Boîte à Gants',      render: () => Glovebox.render()  },
    guide:     { title: 'Le Guide',           render: () => Guide.render()     },
    members:   { title: 'Ma Famille',         render: () => Members.render()   },
  },

  async navigate(section) {
    if (!Auth.isLoggedIn()) return;
    State.currentSection = section;
    UI.setActiveNav(section);
    UI.closeSidebar();

    const s = this.sections[section];
    if (!s) return;
    UI.setHeaderTitle(s.title);

    // Réinitialisation des contrôles header
    UI.showVehicleSelector(['history', 'glovebox'].includes(section));
    UI.showAddBtn(false);
    //document.getElementById('btn-add-primary').onclick = null;

    UI.setContent(`<div class="section-loader"><div class="spinner"></div><p>Chargement…</p></div>`);
    await s.render();
  },

  onVehicleChange() {
    const id = document.getElementById('vehicle-selector').value;
    State.currentVehicle = id ? State.vehicles.find(v => v.id == id) : null;
    Router.navigate(State.currentSection);
  },
};

// ============================================================
//  APP — Démarrage / orchestration
// ============================================================
const App = {
  async launch() {
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) authScreen.classList.add('hidden');

    const appScreen = document.getElementById('app-screen');
    if (appScreen) appScreen.classList.remove('hidden');

    UI.updateSidebarUser();
    await this.loadCoreData();
    Router.navigate('dashboard');
  },

  async loadCoreData() {
    try {
      const [vehicles, members] = await Promise.all([
        API.get('vehicles.php'),
        API.get('members.php'),
      ]);
      // CORRECTION: Force des tableaux même si l'API renvoie null ou un objet d'erreur
      State.vehicles = Array.isArray(vehicles) ? vehicles : [];
      State.members  = Array.isArray(members) ? members : [];
    } catch (e) {
      UI.toast('Erreur de chargement des données', 'danger');
    }
  },

  showAuth() {
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
  },

  onAddPrimary: () => {},
};

// ============================================================
//  DASHBOARD — Tableau de bord
// ============================================================
const Dashboard = {
  async render() {
    if (!State.vehicles.length) {
      UI.setContent(`
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v5"/>
            <path d="M17 21H7a2 2 0 01-2-2V7a2 2 0 012-2h7l5 5v9a2 2 0 01-2 2z"/>
          </svg>
          <h3>Aucun véhicule enregistré</h3>
          <p>Ajoutez votre premier véhicule dans <strong>Mon Garage</strong> pour commencer.</p>
          <br>
          <button class="btn btn-primary" onclick="Router.navigate('garage')">Aller dans Mon Garage</button>
        </div>
      `);
      return;
    }

    // Charger les clés de tous les véhicules
    const keyPromises = State.vehicles.map(v =>
      API.get(`keys.php?vehicle_id=${v.id}`).catch(() => [])
    );
    const allKeys = await Promise.all(keyPromises);

    const cards = State.vehicles.map((v, i) => this.renderVehicleCard(v, allKeys[i])).join('');
    UI.setContent(`<div class="dashboard-grid">${cards}</div>`);
  },

  renderVehicleCard(v, keys) {
    // CORRECTION: S'assurer que keys est bien un tableau avant d'utiliser .find() et .sort()
    const safeKeys = Array.isArray(keys) ? keys : [];

    const colorDot = v.color
      ? `<div class="vehicle-color-dot" style="background:${v.color}" title="${v.color}"></div>`
      : '';

    const fuelLabel = { essence: '⛽ Essence', diesel: '🛢 Diesel', électrique: '⚡ Électrique', hybride: '🔋 Hybride', gpl: '🔵 GPL' };

    const keysHtml = [1, 2].map(n => {
      const k = safeKeys.find(k => k.key_number == n);
      const holderName = k?.holder_type === 'member' && k.member_name
        ? k.member_name
        : (State.user?.name || 'Propriétaire');
      const loc = k?.location_text || '—';
      return `
        <div class="key-row" onclick="Keys.showKeyModal(${v.id}, ${n})" title="Modifier la clé ${n}">
          <div class="key-badge">C${n}</div>
          <div class="key-holder">
            <div class="key-holder-name">${htmlEscape(holderName)}</div>
            <div class="key-location">${htmlEscape(loc)}</div>
          </div>
          <svg class="key-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>`;
    }).join('');

    const lastKey = safeKeys.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
    const updatedTxt = lastKey ? `Mis à jour ${UI.fmtDate(lastKey.updated_at)}` : '';

    return `
      <div class="vehicle-card">
        <div class="vehicle-card-header">
          <div class="vehicle-card-identity">
            <div class="vehicle-make-model">${htmlEscape(v.make)} ${htmlEscape(v.model)}</div>
            <div class="vehicle-year">${v.year} &mdash; ${fuelLabel[v.fuel_type] || v.fuel_type}</div>
          </div>
          <div style="display:flex;align-items:center;gap:.5rem">
            ${colorDot}
            <div class="vehicle-plate">${htmlEscape(v.license_plate)}</div>
          </div>
        </div>
        <div class="vehicle-card-body">
          <div class="vehicle-info-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${UI.fmtMileage(v.mileage)}
          </div>
          <div class="keys-section">
            <div class="keys-section-title">🔑 Suivi des clés</div>
            ${keysHtml}
            ${updatedTxt ? `<div style="font-size:.7rem;color:var(--text-light);margin-top:.35rem;">${updatedTxt}</div>` : ''}
          </div>
        </div>
        <div class="vehicle-card-footer">
          <button class="btn btn-secondary btn-sm" onclick="Router.navigate('history');setTimeout(()=>{document.getElementById('vehicle-selector').value='${v.id}';Router.onVehicleChange()},200)">Historique</button>
          <button class="btn btn-secondary btn-sm" onclick="Router.navigate('glovebox');setTimeout(()=>{document.getElementById('vehicle-selector').value='${v.id}';Router.onVehicleChange()},200)">Documents</button>
          <button class="btn btn-ghost btn-sm" onclick="Garage.showEditForm(${v.id})">Modifier</button>
        </div>
      </div>`;
  },
};

// ============================================================
//  GARAGE — Gestion des véhicules
// ============================================================
const Garage = {
  async render() {
    UI.showAddBtn(true, '+ Ajouter un véhicule');
    App.onAddPrimary = () => Garage.showAddForm();

    if (!State.vehicles.length) {
      UI.setContent(`
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <h3>Votre garage est vide</h3>
          <p>Ajoutez votre premier véhicule pour commencer.</p>
          <br>
          <button class="btn btn-primary" onclick="Garage.showAddForm()">+ Ajouter un véhicule</button>
        </div>
      `);
      return;
    }

    const items = State.vehicles.map(v => this.renderGarageItem(v)).join('');
    UI.setContent(`<div class="garage-list">${items}</div>`);
  },

  renderGarageItem(v) {
    const color = v.color || '#64748B';
    const fuelLabel = { essence: 'Essence', diesel: 'Diesel', électrique: 'Électrique', hybride: 'Hybride', gpl: 'GPL' };
    
    // Affichage dynamique du statut basé sur les colonnes de votre base de données
    let statusBadge = `<span class="tag tag-fuel" style="background:#E2E8F0; color:#1E293B;">Disponible</span>`;
    if (v.status === 'en_utilisation') {
      const assignedName = v.employee_name ? htmlEscape(v.employee_name) : 'un employé';
      statusBadge = `<span class="tag tag-fuel" style="background:#FEF3C7; color:#B45309;">En utilisation par ${assignedName}</span>`;
    }

    return `
      <div class="garage-item">
        <div class="garage-item-color" style="background:${color}"></div>
        <div class="garage-item-body">
          <div class="garage-item-info">
            <div class="garage-item-name">${htmlEscape(v.make)} ${htmlEscape(v.model)}</div>
            <div class="garage-item-meta">${v.year} &mdash; ${htmlEscape(v.license_plate)} &mdash; ${UI.fmtMileage(v.mileage)}</div>
            <div class="garage-item-tags">
              <span class="tag tag-fuel">${fuelLabel[v.fuel_type] || v.fuel_type}</span>
              ${statusBadge}
              ${v.vin ? `<span class="tag">VIN: ${htmlEscape(v.vin)}</span>` : ''}
            </div>
          </div>
          <div class="garage-item-actions">
            <button class="btn btn-secondary btn-sm" onclick="Garage.showEditForm(${v.id})">Modifier</button>
            <button class="btn btn-danger btn-sm" onclick="Garage.deleteVehicle(${v.id})">Supprimer</button>
          </div>
        </div>
      </div>`;
  },

  showAddForm() {
    UI.openModal('Ajouter un véhicule', this._vehicleForm(), `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="Garage.submitAdd()">Enregistrer</button>
    `);
  },

  async showEditForm(vehicleId) {
    const v = State.vehicles.find(x => x.id == vehicleId);
    if (!v) return;
    UI.openModal('Modifier le véhicule', this._vehicleForm(v), `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="Garage.submitEdit(${vehicleId})">Enregistrer</button>
    `);
  },

  _vehicleForm(v = {}) {
    const fuelOpts = ['essence','diesel','électrique','hybride','gpl']
      .map(f => `<option value="${f}" ${v.fuel_type === f ? 'selected' : ''}>${{essence:'Essence',diesel:'Diesel',électrique:'Électrique',hybride:'Hybride',gpl:'GPL'}[f]}</option>`)
      .join('');
    return `
      <div style="display:flex;flex-direction:column;gap:1rem;">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Marque *</label>
            <input id="v-make" class="form-input" value="${htmlEscape(v.make||'')}" placeholder="Renault, Peugeot…" required />
          </div>
          <div class="form-group">
            <label class="form-label">Modèle *</label>
            <input id="v-model" class="form-input" value="${htmlEscape(v.model||'')}" placeholder="Clio, 308…" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Année *</label>
            <input id="v-year" class="form-input" type="number" min="1950" max="${new Date().getFullYear()+1}" value="${v.year||new Date().getFullYear()}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Immatriculation *</label>
            <input id="v-plate" class="form-input" value="${htmlEscape(v.license_plate||'')}" placeholder="AA-123-BB" style="text-transform:uppercase" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kilométrage</label>
            <input id="v-mileage" class="form-input" type="number" min="0" value="${v.mileage||0}" />
          </div>
          <div class="form-group">
            <label class="form-label">Carburant</label>
            <select id="v-fuel" class="form-select">${fuelOpts}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Couleur</label>
            <input id="v-color" class="form-input" type="color" value="${v.color||'#1E3A5F'}" style="height:42px;padding:.25rem .5rem" />
          </div>
          <div class="form-group">
            <label class="form-label">N° VIN</label>
            <input id="v-vin" class="form-input" value="${htmlEscape(v.vin||'')}" placeholder="17 caractères" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea id="v-notes" class="form-textarea" placeholder="Informations complémentaires…">${htmlEscape(v.notes||'')}</textarea>
        </div>
        <div id="vehicle-form-error" class="form-error hidden"></div>
      </div>`;
  },

  _collectForm() {
    const make = document.getElementById('v-make')?.value.trim();
    const model = document.getElementById('v-model')?.value.trim();
    const year = document.getElementById('v-year')?.value;
    const plate = document.getElementById('v-plate')?.value.trim();
    const mileage = document.getElementById('v-mileage')?.value;
    const fuel = document.getElementById('v-fuel')?.value;
    const color = document.getElementById('v-color')?.value;
    const vin = document.getElementById('v-vin')?.value.trim();
    const notes = document.getElementById('v-notes')?.value.trim();

    const errEl = document.getElementById('vehicle-form-error');

    // Vérification des champs requis
    if (!make || !model || !year || !plate) {
      errEl.textContent = 'Les champs Marque, Modèle, Année et Immatriculation sont requis.';
      errEl.classList.remove('hidden');
      return null;
    }
    
    errEl.classList.add('hidden');

    // Formatage des données pour l'API
    return {
      make: make,
      model: model,
      year: parseInt(year),
      license_plate: plate,
      mileage: parseInt(mileage) || 0,
      fuel_type: fuel,
      color: color,
      vin: vin,
      notes: notes
    };
  },  

  async submitAdd() {
    const data = this._collectForm();
    if (!data) return;
    try {
      const vehicle = await API.post('vehicles.php', data);
      State.vehicles.unshift(vehicle);
      UI.closeModal();
      UI.toast('Véhicule ajouté avec succès !', 'success');
      await this.render();
    } catch (e) {
      document.getElementById('vehicle-form-error').textContent = e.message;
      document.getElementById('vehicle-form-error').classList.remove('hidden');
    }
  },

  async submitEdit(id) {
    const data = this._collectForm();
    if (!data) return;
    try {
      const vehicle = await API.put(`vehicles.php?id=${id}`, data);
      const idx = State.vehicles.findIndex(v => v.id == id);
      if (idx >= 0) State.vehicles[idx] = vehicle;
      UI.closeModal();
      UI.toast('Véhicule mis à jour !', 'success');
      await this.render();
    } catch (e) {
      document.getElementById('vehicle-form-error').textContent = e.message;
      document.getElementById('vehicle-form-error').classList.remove('hidden');
    }
  },

  async deleteVehicle(id) {
    if (!UI.confirm('Supprimer ce véhicule ? Cette action supprimera aussi tout l\'historique et les documents associés.')) return;
    try {
      await API.delete(`vehicles.php?id=${id}`);
      State.vehicles = State.vehicles.filter(v => v.id != id);
      UI.toast('Véhicule supprimé.', 'success');
      await this.render();
    } catch (e) {
      UI.toast(e.message, 'danger');
    }
  },
};

// ============================================================
//  HISTORY — Historique d'entretien
// ============================================================
const History = {
  entries: [],

  async render() {
    if (!State.vehicles.length) {
      UI.setContent(`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><h3>Aucun véhicule</h3><p>Ajoutez d'abord un véhicule dans Mon Garage.</p></div>`);
      return;
    }

    if (!State.currentVehicle) {
      UI.setContent(`<div class="empty-state" style="padding-top:5rem"><p style="font-size:1rem;font-weight:600">Sélectionnez un véhicule ci-dessus pour consulter son historique.</p></div>`);
      return;
    }

    UI.showAddBtn(true, '+ Ajouter une entrée');
    App.onAddPrimary = () => History.showAddForm();

    try {
      this.entries = await API.get(`history.php?vehicle_id=${State.currentVehicle.id}`);
    } catch { this.entries = []; }

    UI.setContent(this._renderContent());
  },

  _renderContent() {
    const stats = this._computeStats();
    const statsHtml = `
      <div class="history-stats">
        <div class="stat-card"><div class="stat-label">Entrées</div><div class="stat-value">${this.entries.length}</div></div>
        <div class="stat-card"><div class="stat-label">Total dépensé</div><div class="stat-value">${UI.fmtCost(stats.totalCost)}</div><div class="stat-sub">tous postes</div></div>
        <div class="stat-card"><div class="stat-label">Carburant</div><div class="stat-value">${UI.fmtCost(stats.fuelCost)}</div><div class="stat-sub">${UI.fmtLiters(stats.totalLiters)} consommés</div></div>
        <div class="stat-card"><div class="stat-label">Consommation moy.</div><div class="stat-value">${stats.avgConsumption ? stats.avgConsumption + ' L/100' : '—'}</div><div class="stat-sub">sur les pleins enregistrés</div></div>
      </div>`;

    if (!this.entries.length) {
      return statsHtml + `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><h3>Aucun historique</h3><p>Ajoutez une entrée pour commencer à suivre l'entretien de votre véhicule.</p><br><button class="btn btn-primary" onclick="History.showAddForm()">+ Ajouter une entrée</button></div>`;
    }

    const timeline = this.entries.map(e => this._renderEntry(e)).join('');
    return statsHtml + `<div class="timeline">${timeline}</div>`;
  },

  _computeStats() {
    let totalCost = 0, fuelCost = 0, totalLiters = 0;
    const fuelEntries = this.entries.filter(e => e.type === 'carburant' && e.mileage && e.liters);

    this.entries.forEach(e => {
      if (e.cost) totalCost += parseFloat(e.cost);
      if (e.type === 'carburant') {
        if (e.cost)   fuelCost   += parseFloat(e.cost);
        if (e.liters) totalLiters += parseFloat(e.liters);
      }
    });

    // Calcul consommation moyenne (L/100km) entre les pleins consécutifs
    let avgConsumption = null;
    if (fuelEntries.length >= 2) {
      const sorted = [...fuelEntries].sort((a, b) => new Date(a.date) - new Date(b.date) || a.mileage - b.mileage);
      let totalKm = 0, totalL = 0;
      for (let i = 1; i < sorted.length; i++) {
        const km = sorted[i].mileage - sorted[i-1].mileage;
        if (km > 0) { totalKm += km; totalL += parseFloat(sorted[i].liters); }
      }
      if (totalKm > 0) avgConsumption = (totalL / totalKm * 100).toFixed(1);
    }

    return {
      totalCost: totalCost || null,
      fuelCost:  fuelCost  || null,
      totalLiters: totalLiters || null,
      avgConsumption,
    };
  },

  _typeIcon(type) {
    const icons = {
      carburant:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 22V7a2 2 0 012-2h4a2 2 0 012 2v15"/><path d="M11 7h3l4 4v11"/><line x1="3" y1="22" x2="17" y2="22"/></svg>`,
      entretien:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
      reparation:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      controle_technique:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
      autre:             `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
    };
    return icons[type] || icons.autre;
  },

  _typeLabel(type) {
    return { carburant:'Carburant', entretien:'Entretien', reparation:'Réparation', controle_technique:'Contrôle technique', autre:'Autre' }[type] || type;
  },

  _renderEntry(e) {
    const extraMeta = [];
    if (e.liters)  extraMeta.push(`<span class="timeline-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 22V7a2 2 0 012-2h4a2 2 0 012 2v15"/></svg>${UI.fmtLiters(e.liters)}</span>`);
    if (e.station) extraMeta.push(`<span class="timeline-meta-item">📍 ${htmlEscape(e.station)}</span>`);
    if (e.cost)    extraMeta.push(`<span class="timeline-meta-item" style="color:var(--success);font-weight:600">${UI.fmtCost(e.cost)}</span>`);

    return `
      <div class="timeline-item">
        <div class="timeline-icon ti-${e.type}">${this._typeIcon(e.type)}</div>
        <div class="timeline-body">
          <div class="timeline-title">${this._typeLabel(e.type)}</div>
          <div class="timeline-date">${UI.fmtDate(e.date)} &mdash; ${UI.fmtMileage(e.mileage)}</div>
          ${e.description ? `<div class="timeline-desc">${htmlEscape(e.description)}</div>` : ''}
          ${extraMeta.length ? `<div class="timeline-meta">${extraMeta.join('')}</div>` : ''}
        </div>
        <div class="timeline-actions">
          <button class="btn btn-ghost btn-sm" onclick="History.showEditForm(${e.id})">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="History.deleteEntry(${e.id})">🗑</button>
        </div>
      </div>`;
  },

  showAddForm() {
    const v = State.currentVehicle;
    if (!v) return UI.toast('Sélectionnez un véhicule d\'abord', 'warning');
    UI.openModal('Nouvelle entrée d\'historique', this._entryForm(), `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="History.submitAdd(${v.id})">Enregistrer</button>
    `);
    this._updateFormFields();
  },

  showEditForm(entryId) {
    const e = this.entries.find(x => x.id == entryId);
    if (!e) return;
    UI.openModal('Modifier l\'entrée', this._entryForm(e), `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="History.submitEdit(${entryId})">Enregistrer</button>
    `);
    this._updateFormFields();
  },

  _entryForm(e = {}) {
    const today = new Date().toISOString().split('T')[0];
    const types = ['carburant','entretien','reparation','controle_technique','autre'];
    const typeLabels = { carburant:'Carburant', entretien:'Entretien', reparation:'Réparation', controle_technique:'Contrôle technique', autre:'Autre' };
    const typeOpts = types.map(t => `<option value="${t}" ${e.type === t ? 'selected' : ''}>${typeLabels[t]}</option>`).join('');
    return `
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Type *</label>
            <select id="h-type" class="form-select" onchange="History._updateFormFields()">${typeOpts}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input id="h-date" class="form-input" type="date" value="${e.date || today}" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Kilométrage *</label>
          <input id="h-mileage" class="form-input" type="number" min="0" value="${e.mileage || State.currentVehicle?.mileage || ''}" required />
        </div>
        <div id="h-fuel-fields" style="display:none;flex-direction:column;gap:1rem">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Litres</label>
              <input id="h-liters" class="form-input" type="number" step="0.01" min="0" value="${e.liters || ''}" placeholder="45.00" />
            </div>
            <div class="form-group">
              <label class="form-label">Station</label>
              <input id="h-station" class="form-input" value="${htmlEscape(e.station || '')}" placeholder="Total, BP…" />
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Coût (€)</label>
          <input id="h-cost" class="form-input" type="number" step="0.01" min="0" value="${e.cost || ''}" placeholder="0.00" />
        </div>
        <div class="form-group">
          <label class="form-label">Description / Notes</label>
          <textarea id="h-desc" class="form-textarea" placeholder="Détails de l'opération…">${htmlEscape(e.description || '')}</textarea>
        </div>
        <div id="history-form-error" class="form-error hidden"></div>
      </div>`;
  },

  _updateFormFields() {
    const type = document.getElementById('h-type')?.value;
    const fuelFields = document.getElementById('h-fuel-fields');
    if (fuelFields) fuelFields.style.display = type === 'carburant' ? 'flex' : 'none';
  },

  _collectForm() {
    const type    = document.getElementById('h-type')?.value;
    const date    = document.getElementById('h-date')?.value;
    const mileage = document.getElementById('h-mileage')?.value;
    const errEl   = document.getElementById('history-form-error');
    if (!type || !date || !mileage) {
      errEl.textContent = 'Type, date et kilométrage sont requis.';
      errEl.classList.remove('hidden');
      return null;
    }
    errEl.classList.add('hidden');
    const cost    = document.getElementById('h-cost')?.value;
    const liters  = document.getElementById('h-liters')?.value;
    return {
      type, date,
      mileage: parseInt(mileage),
      cost:    cost    ? parseFloat(cost)   : null,
      liters:  liters  ? parseFloat(liters) : null,
      station:     document.getElementById('h-station')?.value.trim() || '',
      description: document.getElementById('h-desc')?.value.trim()    || '',
    };
  },

  async submitAdd(vehicleId) {
    const data = this._collectForm();
    if (!data) return;
    try {
      const entry = await API.post('history.php', { vehicle_id: vehicleId, ...data });
      this.entries.unshift(entry);
      UI.closeModal();
      UI.toast('Entrée ajoutée !', 'success');
      UI.setContent(this._renderContent());
    } catch (e) {
      document.getElementById('history-form-error').textContent = e.message;
      document.getElementById('history-form-error').classList.remove('hidden');
    }
  },

  async submitEdit(id) {
    const data = this._collectForm();
    if (!data) return;
    try {
      const entry = await API.put(`history.php?id=${id}`, data);
      const idx = this.entries.findIndex(x => x.id == id);
      if (idx >= 0) this.entries[idx] = entry;
      UI.closeModal();
      UI.toast('Entrée mise à jour !', 'success');
      UI.setContent(this._renderContent());
    } catch (e) {
      document.getElementById('history-form-error').textContent = e.message;
      document.getElementById('history-form-error').classList.remove('hidden');
    }
  },

  async deleteEntry(id) {
    if (!UI.confirm('Supprimer cette entrée ?')) return;
    try {
      await API.delete(`history.php?id=${id}`);
      this.entries = this.entries.filter(x => x.id != id);
      UI.toast('Entrée supprimée.', 'success');
      UI.setContent(this._renderContent());
    } catch (e) {
      UI.toast(e.message, 'danger');
    }
  },
};

// ============================================================
//  GLOVEBOX — Boîte à gants / Documents
// ============================================================
const Glovebox = {
  docs: [],
  currentCategory: 'all',

  async render() {
    if (!State.vehicles.length) {
      UI.setContent(`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><h3>Aucun véhicule</h3><p>Ajoutez d'abord un véhicule dans Mon Garage.</p></div>`);
      return;
    }
    if (!State.currentVehicle) {
      UI.setContent(`<div class="empty-state" style="padding-top:5rem"><p style="font-size:1rem;font-weight:600">Sélectionnez un véhicule ci-dessus pour accéder à ses documents.</p></div>`);
      return;
    }
    UI.showAddBtn(true, '+ Ajouter un document');
    App.onAddPrimary = () => Glovebox.showUploadForm();
    try {
      this.docs = await API.get(`documents.php?vehicle_id=${State.currentVehicle.id}`);
    } catch { this.docs = []; }
    UI.setContent(this._renderContent());
  },

  _catLabel: {
    assurance:         '🛡 Assurance',
    controle_technique:'🔍 Contrôle technique',
    carnet_entretien:  '📋 Carnet d\'entretien',
    factures:          '🧾 Factures',
    autres:            '📁 Autres',
  },

  _catBg: {
    assurance:'#DBEAFE', controle_technique:'#FEF3C7', carnet_entretien:'#D1FAE5', factures:'#FCE7F3', autres:'#F3F4F6',
  },

  _renderContent() {
    const categories = ['all', ...Object.keys(this._catLabel)];
    const catBtns = categories.map(c => `
      <button class="doc-cat-btn ${this.currentCategory === c ? 'active' : ''}"
        onclick="Glovebox.filterCategory('${c}')">
        ${c === 'all' ? 'Tous' : this._catLabel[c]}
      </button>`).join('');

    const filtered = this.currentCategory === 'all' ? this.docs : this.docs.filter(d => d.category === this.currentCategory);

    if (!filtered.length) {
      return `
        <div class="doc-categories">${catBtns}</div>
        <div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><h3>Aucun document</h3><p>Ajoutez votre premier document.</p><br><button class="btn btn-primary" onclick="Glovebox.showUploadForm()">+ Ajouter un document</button></div>`;
    }

    const docCards = filtered.map(d => this._renderDocCard(d)).join('');
    return `<div class="doc-categories">${catBtns}</div><div class="doc-grid">${docCards}</div>`;
  },

  _renderDocCard(d) {
    const isPdf = d.file_type?.includes('pdf');
    const isImg = d.file_type?.startsWith('image/');
    const preview = isPdf ? '📄' : isImg ? '🖼' : '📎';
    const bg = this._catBg[d.category] || '#F3F4F6';

    let expiryHtml = '';
    if (d.expiry_date) {
      const days = Math.ceil((new Date(d.expiry_date) - Date.now()) / 86400000);
      if (days < 0)  expiryHtml = `<div class="doc-card-expiry expiry-expired">Expiré le ${UI.fmtDate(d.expiry_date)}</div>`;
      else if (days <= 30) expiryHtml = `<div class="doc-card-expiry expiry-soon">Expire dans ${days}j</div>`;
      else expiryHtml = `<div class="doc-card-expiry expiry-ok">Expire le ${UI.fmtDate(d.expiry_date)}</div>`;
    }

    return `
      <div class="doc-card">
        <div class="doc-card-preview" style="background:${bg}">${preview}</div>
        <div class="doc-card-body">
          <div class="doc-card-name" title="${htmlEscape(d.name)}">${htmlEscape(d.name)}</div>
          <div class="doc-card-meta">${this._catLabel[d.category] || d.category}</div>
          <div class="doc-card-meta" style="margin-top:.2rem">${UI.fmtDate(d.uploaded_at)}</div>
          ${expiryHtml}
          <div class="doc-card-actions">
            <a href="${htmlEscape(d.file_path)}" target="_blank" class="btn btn-secondary btn-sm">Voir</a>
            <button class="btn btn-danger btn-sm" onclick="Glovebox.deleteDoc(${d.id})">Supprimer</button>
          </div>
        </div>
      </div>`;
  },

  filterCategory(cat) {
    this.currentCategory = cat;
    UI.setContent(this._renderContent());
  },

  showUploadForm() {
    if (!State.currentVehicle) return UI.toast('Sélectionnez un véhicule', 'warning');
    const catOpts = Object.entries(this._catLabel).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');
    UI.openModal('Ajouter un document', `
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="form-group">
          <label class="form-label">Nom du document *</label>
          <input id="doc-name" class="form-input" placeholder="Ex: Carte verte 2025" required />
        </div>
        <div class="form-group">
          <label class="form-label">Catégorie *</label>
          <select id="doc-cat" class="form-select">${catOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Date d'expiration</label>
          <input id="doc-expiry" class="form-input" type="date" />
          <div class="form-hint">Optionnel — vous serez alerté avant expiration</div>
        </div>
        <div class="form-group">
          <label class="form-label">Fichier (PDF / Image) *</label>
          <input id="doc-file" class="form-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" required />
        </div>
        <div id="doc-form-error" class="form-error hidden"></div>
      </div>`, `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="Glovebox.submitUpload()">Uploader</button>
    `);
  },

  async submitUpload() {
    const name   = document.getElementById('doc-name')?.value.trim();
    const cat    = document.getElementById('doc-cat')?.value;
    const expiry = document.getElementById('doc-expiry')?.value;
    const file   = document.getElementById('doc-file')?.files[0];
    const errEl  = document.getElementById('doc-form-error');
    if (!name || !file) {
      errEl.textContent = 'Nom et fichier sont requis.';
      errEl.classList.remove('hidden');
      return;
    }
    const formData = new FormData();
    formData.append('vehicle_id', State.currentVehicle.id);
    formData.append('name', name);
    formData.append('category', cat);
    if (expiry) formData.append('expiry_date', expiry);
    formData.append('file', file);
    try {
      const doc = await API.upload('documents.php', formData);
      this.docs.unshift(doc);
      UI.closeModal();
      UI.toast('Document uploadé !', 'success');
      UI.setContent(this._renderContent());
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  },

  async deleteDoc(id) {
    if (!UI.confirm('Supprimer ce document ?')) return;
    try {
      await API.delete(`documents.php?id=${id}`);
      this.docs = this.docs.filter(d => d.id != id);
      UI.toast('Document supprimé.', 'success');
      UI.setContent(this._renderContent());
    } catch (e) { UI.toast(e.message, 'danger'); }
  },
};

// ============================================================
//  GUIDE — Articles pratiques
// ============================================================
const Guide = {
  articles: [],
  currentCategory: 'all',
  searchQuery: '',

  async render() {
    // 1. Activation du bouton d'en-tête et liaison à la fonction d'ajout
    UI.showAddBtn(true, '+ Ajouter un conseil');
    App.onAddPrimary = () => Guide.showAddForm();

    if (!this.articles.length) {
      try { this.articles = await API.get('guide.php'); } catch { this.articles = []; }
    }
    UI.setContent(this._renderContent());
  },

  _catColors: {
    Moteur:         'cat-moteur',
    Pneus:          'cat-pneus',
    Freins:         'cat-freins',
    Réglementation: 'cat-reglementation',
    Économies:      'cat-economies',
    Saisons:        'cat-saisons',
  },

  _renderContent() {
    const categories = ['all', ...new Set(this.articles.map(a => a.category))];
    const catBtns = categories.map(c => `
      <button class="doc-cat-btn guide-cat-btn ${this.currentCategory === c ? 'active' : ''}"
        onclick="Guide.filterCategory('${c}')">
        ${c === 'all' ? 'Tous les sujets' : c}
      </button>`).join('');

    let filtered = this.articles;
    if (this.currentCategory !== 'all') filtered = filtered.filter(a => a.category === this.currentCategory);
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(a => a.title.toLowerCase().includes(q) || (a.tags || '').toLowerCase().includes(q));
    }

    const cards = filtered.map(a => this._renderCard(a)).join('');
    const emptyHtml = !filtered.length ? `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 014 4v14a3 3 0 013-3h7z"/></svg><h3>Aucun article trouvé</h3></div>` : '';

    return `
      <div class="guide-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="guide-search-input" placeholder="Rechercher un sujet…" value="${htmlEscape(this.searchQuery)}" oninput="Guide.onSearch(this.value)" />
      </div>
      <div class="guide-categories" style="margin-bottom:1.5rem">${catBtns}</div>
      ${filtered.length ? `<div class="guide-grid">${cards}</div>` : emptyHtml}`;
  },

  _renderCard(a) {
    const catClass = this._catColors[a.category] || 'cat-default';
    const excerpt = (a.content || '').replace(/\*\*/g, '').replace(/\n/g, ' ').slice(0, 100);
    return `
      <div class="guide-card" onclick="Guide.openArticle(${a.id})">
        <div class="guide-card-cat ${catClass}">${a.category}</div>
        <div class="guide-card-title">${htmlEscape(a.title)}</div>
        <div class="guide-card-excerpt">${htmlEscape(excerpt)}…</div>
        <div class="guide-card-footer">
          <span class="guide-card-read-time">⏱ ${a.read_time || 3} min de lecture</span>
          <svg class="guide-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
      </div>`;
  },

  async openArticle(id) {
    let article = this.articles.find(a => a.id == id);
    if (!article || !article.content) {
      try { article = await API.get(`guide.php?id=${id}`); } catch { return; }
    }
    const catClass = this._catColors[article.category] || 'cat-default';
    const contentHtml = this._markdownToHtml(article.content || '');
    UI.openGuideModal(article.title, `
      <div style="margin-bottom:1rem">
        <span class="guide-card-cat ${catClass}" style="display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;font-weight:600;padding:.3rem .7rem;border-radius:20px">${article.category}</span>
        <span style="font-size:.8rem;color:var(--text-muted);margin-left:.75rem">⏱ ${article.read_time || 3} min de lecture</span>
      </div>
      <div class="guide-article-content">${contentHtml}</div>
    `);
  },

  _markdownToHtml(md) {
    return md
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>(\n|$))+/g, match => `<ul>${match}</ul>`)
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/^/, '<p>').replace(/$/, '</p>')
      .replace(/<p><ul>/g, '<ul>').replace(/<\/ul><\/p>/g, '</ul>');
  },

  // Fenêtre modale pour créer un nouvel article
  showAddForm() {
    const categories = ['Moteur', 'Pneus', 'Freins', 'Réglementation', 'Économies', 'Saisons'];
    const catOptions = categories.map(c => `<option value="${c}">${c}</option>`).join('');

    UI.openModal('Ajouter un conseil d\'entretien', `
      <div style="display:flex;flex-direction:column;gap:1rem;">
        <div class="form-group">
          <label class="form-label">Titre *</label>
          <input id="g-title" class="form-input" placeholder="Ex: Vérifier le niveau de liquide de frein" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Catégorie *</label>
            <select id="g-category" class="form-select">${catOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Temps de lecture (min)</label>
            <input id="g-readtime" class="form-input" type="number" min="1" value="3" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Contenu du conseil *</label>
          <textarea id="g-content" class="form-textarea" style="height:120px" placeholder="Détaillez vos explications..." required></textarea>
        </div>
        <div id="guide-form-error" class="form-error hidden"></div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="Guide.submitAdd()">Enregistrer</button>
    `);
  },

  // Envoi des données vers le fichier PHP
  async submitAdd() {
    const title = document.getElementById('g-title')?.value.trim();
    const category = document.getElementById('g-category')?.value;
    const read_time = parseInt(document.getElementById('g-readtime')?.value) || 3;
    const content = document.getElementById('g-content')?.value.trim();
    const errEl = document.getElementById('guide-form-error');

    if (!title || !content) {
      if (errEl) {
        errEl.textContent = 'Le titre et le contenu sont requis.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    try {
      const newArticle = await API.post('guide.php', { title, category, read_time, content });
      this.articles.unshift(newArticle || { id: Date.now(), title, category, read_time, content });
      UI.closeModal();
      UI.toast('Conseil ajouté avec succès !', 'success');
      await this.render();
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message;
        errEl.classList.remove('hidden');
      } else {
        UI.toast(e.message, 'danger');
      }
    }
  },

  filterCategory(cat) {
    this.currentCategory = cat;
    UI.setContent(this._renderContent());
  },

  onSearch(q) {
    this.searchQuery = q;
    UI.setContent(this._renderContent());
  },
};

// ============================================================
//  MEMBERS — Membres de la famille
// ============================================================
const Members = {
  async render() {
    UI.showAddBtn(true, '+ Ajouter un membre');
    App.onAddPrimary = () => Members.showAddForm();
    UI.setContent(this._renderContent());
  },

  _COLORS: ['#3B82F6','#EF4444','#10B981','#F97316','#8B5CF6','#EC4899','#14B8A6','#F59E0B'],

  _renderContent() {
    const cards = State.members.map(m => this._renderMemberCard(m)).join('');
    return `
      <h2 class="section-title">Membres de ma famille</h2>
      <p class="section-subtitle" style="margin-bottom:1.5rem">Les membres peuvent être assignés comme détenteurs de clés de vos véhicules.</p>
      <div class="members-grid">
        ${cards}
        <div class="member-add-card" onclick="Members.showAddForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          Ajouter un membre
        </div>
      </div>`;
  },

  _renderMemberCard(m) {
    const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return `
      <div class="member-card">
        <div class="member-avatar" style="background:${m.avatar_color}">${initials}</div>
        <div class="member-name">${htmlEscape(m.name)}</div>
        ${m.phone ? `<div class="member-phone">📞 ${htmlEscape(m.phone)}</div>` : ''}
        <div class="member-actions">
          <button class="btn btn-secondary btn-sm" onclick="Members.showEditForm(${m.id})">Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="Members.deleteMember(${m.id})">Supprimer</button>
        </div>
      </div>`;
  },

  _memberForm() {
    return `
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nom *</label>
            <input id="m-name" class="form-input" placeholder="Dupont" required />
          </div>
          <div class="form-group">
            <label class="form-label">Prénom *</label>
            <input id="m-firstname" class="form-input" placeholder="Jean" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Adresse E-mail * (Identifiant de connexion)</label>
          <input id="m-email" class="form-input" type="email" placeholder="jean.dupont@entreprise.com" required />
        </div>
        <div class="form-group">
          <label class="form-label">Téléphone</label>
          <input id="m-phone" class="form-input" type="tel" placeholder="06 12 34 56 78" />
        </div>
        <div class="form-group">
          <label class="form-label">Mot de passe temporaire *</label>
          <input id="m-password" class="form-input" type="password" placeholder="Minimum 6 caractères" required minlength="6" />
        </div>
        <div id="member-form-error" class="form-error hidden"></div>
      </div>`;
  },

  selectColor(color) {
    document.getElementById('m-color').value = color;
    document.querySelectorAll('#color-pickers [data-color]').forEach(el => {
      el.style.borderColor = el.dataset.color === color ? '#0F172A' : 'transparent';
    });
  },

  showAddForm() {
    UI.openModal('Ajouter un membre', this._memberForm(), `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="Members.submitAdd()">Ajouter</button>
    `);
  },

  showEditForm(id) {
    const m = State.members.find(x => x.id == id);
    if (!m) return;
    UI.openModal('Modifier le membre', this._memberForm(m), `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="Members.submitEdit(${id})">Enregistrer</button>
    `);
  },

  _collectForm() {
    // 1. Récupération de tous les champs
    const name = document.getElementById('m-name')?.value.trim();
    const firstname = document.getElementById('m-firstname')?.value.trim();
    const email = document.getElementById('m-email')?.value.trim();
    const phone = document.getElementById('m-phone')?.value.trim();
    const password = document.getElementById('m-password')?.value;
    
    const errEl = document.getElementById('member-form-error');
    
    // 2. Vérification des champs obligatoires (calquée sur le backend)
    if (!name || !firstname || !email || !password) { 
        errEl.textContent = 'Nom, prénom, email et mot de passe sont requis.'; 
        errEl.classList.remove('hidden'); 
        return null; 
    }
    
    errEl.classList.add('hidden');
    
    // 3. Envoi de l'objet complet à l'API
    return { 
        name, 
        firstname,
        email,
        phone,
        password,
        avatar_color: document.getElementById('m-color')?.value || this._COLORS[0] 
    };
  },

  async submitAdd() {
    const data = this._collectForm();
    if (!data) return;
    try {
      const member = await API.post('members.php', data);
      State.members.push(member);
      UI.closeModal();
      UI.toast('Membre ajouté !', 'success');
      UI.setContent(this._renderContent());
    } catch (e) {
      document.getElementById('member-form-error').textContent = e.message;
      document.getElementById('member-form-error').classList.remove('hidden');
    }
  },

  async submitEdit(id) {
    const data = this._collectForm();
    if (!data) return;
    try {
      const member = await API.put(`members.php?id=${id}`, data);
      const idx = State.members.findIndex(x => x.id == id);
      if (idx >= 0) State.members[idx] = member;
      UI.closeModal();
      UI.toast('Membre mis à jour !', 'success');
      UI.setContent(this._renderContent());
    } catch (e) {
      document.getElementById('member-form-error').textContent = e.message;
      document.getElementById('member-form-error').classList.remove('hidden');
    }
  },

  async deleteMember(id) {
    if (!UI.confirm('Supprimer ce membre ? Les clés qui lui sont assignées seront remises au propriétaire.')) return;
    try {
      await API.delete(`members.php?id=${id}`);
      State.members = State.members.filter(x => x.id != id);
      UI.toast('Membre supprimé.', 'success');
      UI.setContent(this._renderContent());
    } catch (e) { UI.toast(e.message, 'danger'); }
  },
};

// ============================================================
//  KEYS — Suivi des clés
// ============================================================
const Keys = {
  async showKeyModal(vehicleId, keyNumber) {
    const v = State.vehicles.find(x => x.id == vehicleId);
    if (!v) return;

    let allKeys = [];
    try { 
      // On récupère toutes les clés via la nouvelle API
      const res = await API.get('keys.php');
      allKeys = Array.isArray(res) ? res : (res.data || []);
    } catch (e) {
      UI.toast('Erreur lors du chargement des clés', 'danger');
      return;
    }
    
    // On cherche la clé correspondante pour ce véhicule
    const key = allKeys.find(k => k.vehicle_id == vehicleId && k.key_number == keyNumber);

    if (!key) {
      UI.toast('Clé introuvable dans le système.', 'warning');
      return;
    }

    const isAvailable = key.status === 'disponible';
    
    // Mise en forme du statut
    const statusText = isAvailable 
      ? '<span style="color:var(--success); font-weight:bold;">Disponible (Au garage)</span>'
      : `<span style="color:var(--orange); font-weight:bold;">En utilisation (Employé ID: ${key.current_employee_id})</span>`;

    UI.openModal(`Clé ${keyNumber} — ${v.make} ${v.model}`, `
      <div style="display:flex; flex-direction:column; gap:1rem">
        
        <!-- Bloc Info Administrateur -->
        <div style="background:var(--bg); border-radius:var(--radius-sm); padding:1.5rem; text-align:center; border: 1px solid var(--border);">
          <div style="font-size:2.5rem; margin-bottom:.5rem">🔑</div>
          <div style="font-weight:600; color:var(--text-main); font-size:1.1rem;">Statut actuel :</div>
          <div style="font-size:1.2rem; margin-top:0.5rem;">${statusText}</div>
          ${key.updated_at ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.5rem">Dernière activité le : ${key.updated_at}</div>` : ''}
        </div>

        <hr style="border:0; border-top:1px solid var(--border); margin:0;">

        <!-- Bloc Explicatif -->
        <div style="text-align:center; color:var(--text-muted); font-size:0.95rem; margin-bottom: 0.5rem; padding: 0 1rem;">
          ${isAvailable 
            ? 'Cette clé est au garage. Les employés peuvent la réserver directement depuis leur application.' 
            : 'Cette clé est actuellement détenue par un employé. S\'il a oublié de la rendre sur l\'application, vous pouvez forcer sa restitution ci-dessous.'}
        </div>

        <!-- Boutons d'action -->
        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Fermer</button>
          ${!isAvailable ? `
            <button type="button" class="btn btn-danger" onclick="Keys.forceReturn(${key.id})">
              Forcer la restitution
            </button>
          ` : ''}
        </div>
      </div>
    `);
  },

  async forceReturn(keyId) {
    if (!confirm("Voulez-vous vraiment forcer la restitution de cette clé ? Elle sera immédiatement retirée à l'employé.")) return;
    
    try {
      // Appel à la nouvelle API avec l'action POST pour rendre la clé
      await API.post(`keys.php?action=return&id=${keyId}`);
      
      UI.closeModal();
      UI.toast('La clé a été marquée comme restituée.', 'success');
      
      // Rafraîchissement des vues si elles sont actives
      if (State.currentSection === 'dashboard' && typeof Dashboard !== 'undefined') Dashboard.render();
      if (State.currentSection === 'garage' && typeof Garage !== 'undefined') Garage.render();
      
    } catch (e) { 
      UI.toast(e.message || 'Erreur lors de la restitution', 'danger'); 
    }
  }
};

// ============================================================
//  UTILITAIRES
// ============================================================
function htmlEscape(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
//  INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  Auth.loadFromStorage();
  if (Auth.isLoggedIn()) {
    await App.launch();
  }
  // Fermeture modal sur Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      UI.closeModal();
      UI.closeGuideModal();
      UI.closeSidebar();
    }
  });
});