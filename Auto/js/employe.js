const API_URL = './api'; 

const State = {
    token: localStorage.getItem('ag_token') || null,
    user: JSON.parse(localStorage.getItem('ag_user')) || null,
    vehicles: [],
    currentVehicle: null
};

const App = {
    init() {
        if (State.token && State.user) {
            if (State.user.role === 'admin') {
                window.location.href = 'index.html';
                return;
            }
            this.showDashboard();
        } else {
            window.location.href = 'connexion.html'; 
        }
    },

    // --- NAVIGATION ---
    nav(viewId) {
        // Masquer toutes les vues
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        
        // Afficher la vue demandée
        const targetView = document.getElementById(`view-${viewId}`);
        if (targetView) targetView.classList.remove('hidden');

        // Mettre à jour l'état visuel du menu latéral
        document.querySelectorAll('.nav-link').forEach(btn => {
            btn.className = "nav-link w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#152844] text-slate-300 font-medium text-sm transition text-left";
        });
        const activeBtn = document.getElementById(`nav-${viewId}`);
        if (activeBtn) {
            activeBtn.className = "nav-link w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold text-sm transition shadow-md shadow-orange-500/20 text-left";
        }

        // Charger le contenu dynamique selon la vue
        if (viewId === 'dashboard' || viewId === 'fleet') {
            this.loadVehicles();
        } else if (viewId === 'history') {
            this.loadHistory();
        } else if (viewId === 'documents') {
            this.loadDocumentsView();
        } else if (viewId === 'guide') {
            this.loadGuide();
        }
    },

    showDashboard() {
        const header = document.getElementById('app-header');
        if (header) header.classList.remove('hidden');
        
        const userNameDisplay = document.getElementById('user-name-display');
        if (userNameDisplay) userNameDisplay.textContent = State.user.name;
        
        this.nav('dashboard');
    },

    // --- APPELS API ---
    async apiCall(endpoint, options = {}) {
        const headers = {};
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        if (State.token) headers['Authorization'] = `Bearer ${State.token}`;
        
        try {
            const response = await fetch(`${API_URL}/${endpoint}`, { ...options, headers });
            const rawText = await response.text(); 
            
            let data;
            try {
                // 1. On parse le JSON séparément
                data = JSON.parse(rawText);
            } catch (jsonError) {
                console.error(`🚨 ERREUR CRITIQUE sur l'appel : ${endpoint}`);
                console.error("Voici ce que le serveur a répondu au lieu d'un JSON valide :", rawText);
                throw new Error("Le serveur a renvoyé du texte ou une erreur PHP (voir la console F12).");
            }

            // 2. On lève l'erreur HTTP en dehors du bloc catch du JSON
            if (!response.ok) {
                throw new Error(data.error || 'Erreur serveur');
            }
            
            return data;
        } catch (error) {
            throw error;
        }
    },

    logout() {
        this.apiCall('auth.php?action=logout', { method: 'POST' }).catch(() => {});
        State.token = null;
        State.user = null;
        localStorage.removeItem('ag_token');
        localStorage.removeItem('ag_user');
        window.location.href = 'connexion.html';
    },

    // --- VÉHICULES ---
    async loadVehicles() {
        try {
            State.vehicles = await this.apiCall('vehicles.php');
            State.currentVehicle = State.vehicles.find(v => v.current_employee_id === State.user.id) || null;
            this.renderVehicles();
        } catch (err) {
            if (err.message && err.message.includes('Token')) this.logout();
            alert("Impossible de charger les véhicules : " + err.message);
        }
    },

    renderVehicles() {
        const myContainer = document.getElementById('my-vehicle-container');
        const fleetContainer = document.getElementById('fleet-container');

        if (myContainer) myContainer.innerHTML = '';
        if (fleetContainer) fleetContainer.innerHTML = '';

        let hasMyVehicle = false;

        if (!Array.isArray(State.vehicles)) State.vehicles = [];

        State.vehicles.forEach(v => {
            const isMine = State.user && v.current_employee_id === State.user.id;
            
            if (isMine && myContainer) {
                hasMyVehicle = true;
                myContainer.innerHTML = `
                    <div class="bg-white border rounded-2xl p-6 shadow-sm flex flex-col justify-between border-orange-200 bg-orange-50/30">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="font-extrabold text-xl uppercase text-slate-800">${v.make} ${v.model}</h3>
                                <span class="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Réservé</span>
                            </div>
                            <p class="text-sm text-slate-500 mb-3">Immatriculation : <span class="font-mono text-slate-800 font-bold">${v.license_plate}</span></p>
                            <p class="text-sm text-slate-600 border-l-2 border-orange-400 pl-3 mb-4 italic">${v.notes || 'Aucune consigne particulière'}</p>
                        </div>
                        <div class="flex gap-2 mt-4">
                            <button onclick="App.releaseVehicle(${v.id})" class="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-bold transition shadow-sm">Rendre le véhicule</button>
                        </div>
                    </div>
                `;
            } else if (v.status === 'disponible' && fleetContainer) {
                fleetContainer.innerHTML += `
                    <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                            <h3 class="font-bold text-lg uppercase text-slate-800">${v.make} ${v.model}</h3>
                            <p class="text-sm text-slate-500 mb-2">Immatriculation : <span class="font-mono text-slate-800 font-bold">${v.license_plate}</span></p>
                            <p class="text-sm text-slate-600 border-l-2 border-blue-400 pl-3 mb-4">${v.notes || 'Aucune remarque'}</p>
                        </div>
                        <button onclick="App.assignVehicle(${v.id})" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold transition shadow-sm">Réserver</button>
                    </div>
                `;
            }
        });

        if (!hasMyVehicle && myContainer) {
            myContainer.innerHTML = `<p class="text-slate-500 col-span-full">Vous n'avez aucun véhicule en cours d'utilisation.</p>`;
        }
        if (fleetContainer && fleetContainer.innerHTML === '') {
            fleetContainer.innerHTML = `<p class="text-slate-500 col-span-full">Aucun véhicule disponible pour le moment.</p>`;
        }
    },

    async assignVehicle(vehicleId) {
        if (!confirm("Voulez-vous vraiment réserver ce véhicule ?")) return;
        try {
            await this.apiCall(`vehicles.php?action=assign&id=${vehicleId}`, { method: 'POST' });
            await this.loadVehicles();
            this.nav('dashboard');
        } catch (err) {
            alert("Erreur lors de la réservation : " + err.message);
        }
    },

    async releaseVehicle(vehicleId) {
        if (!confirm("Voulez-vous vraiment rendre ce véhicule et terminer son utilisation ?")) return;
        try {
            await this.apiCall(`vehicles.php?action=release&id=${vehicleId}`, { method: 'POST' });
            await this.loadVehicles();
            this.nav('dashboard');
        } catch (err) {
            alert("Erreur lors de la restitution : " + err.message);
        }
    },

    // --- HISTORIQUE & PLEINS ---
    async loadHistory() {
        const container = document.getElementById('history-content');
        if (!container) return;

        if (!State.currentVehicle) {
            container.innerHTML = `<div class="p-6 bg-white rounded-2xl border border-slate-200 text-slate-500">Vous devez réserver un véhicule pour consulter et ajouter l'historique des pleins.</div>`;
            return;
        }

        container.innerHTML = '<p class="text-slate-500">Chargement de l\'historique...</p>';

        try {
            const logs = await this.apiCall(`history.php?vehicle_id=${State.currentVehicle.id}`);
            
            let html = `
                <form onsubmit="App.addHistoryEntry(event)" class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 class="font-bold text-lg text-slate-800 border-b pb-2">Ajouter un plein ou une intervention</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">Type</label>
                            <select id="hist-type" class="w-full p-2.5 border rounded-xl text-sm bg-slate-50">
                                <option value="plein">Plein de carburant</option>
                                <option value="lavage">Lavage</option>
                                <option value="entretien">Entretien / Réparation</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">Date</label>
                            <input type="date" id="hist-date" required value="${new Date().toISOString().split('T')[0]}" class="w-full p-2.5 border rounded-xl text-sm bg-slate-50">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">Kilométrage</label>
                            <input type="number" id="hist-mileage" placeholder="ex: 120000" required class="w-full p-2.5 border rounded-xl text-sm bg-slate-50">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">Coût (€)</label>
                            <input type="number" step="0.01" id="hist-cost" placeholder="ex: 65.50" class="w-full p-2.5 border rounded-xl text-sm bg-slate-50">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">Litres (si plein)</label>
                            <input type="number" step="0.01" id="hist-liters" placeholder="ex: 45" class="w-full p-2.5 border rounded-xl text-sm bg-slate-50">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">Station / Lieu</label>
                            <input type="text" id="hist-station" placeholder="ex: Total Station A6" class="w-full p-2.5 border rounded-xl text-sm bg-slate-50">
                        </div>
                    </div>
                    <button type="submit" class="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2.5 rounded-xl transition shadow-md shadow-orange-500/20">Enregistrer</button>
                </form>

                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <h3 class="font-bold text-lg text-slate-800 border-b pb-2">Historique récent (${State.currentVehicle.make} ${State.currentVehicle.model})</h3>
            `;

            if (!Array.isArray(logs) || logs.length === 0) {
                html += `<p class="text-slate-500 py-4">Aucune entrée enregistrée pour ce véhicule.</p>`;
            } else {
                html += `<div class="divide-y divide-slate-100">`;
                logs.forEach(item => {
                    html += `
                        <div class="py-3 flex justify-between items-center">
                            <div>
                                <span class="font-bold uppercase text-xs px-2 py-0.5 rounded ${item.type === 'plein' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}">${item.type}</span>
                                <span class="text-sm font-semibold text-slate-800 ml-2">${item.date}</span>
                                <p class="text-xs text-slate-500 mt-0.5">${item.mileage} km ${item.station ? '• ' + item.station : ''} ${item.liters ? '• ' + item.liters + ' L' : ''}</p>
                            </div>
                            <div class="font-bold text-slate-800">${item.cost ? item.cost + ' €' : '-'}</div>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            html += `</div>`;
            container.innerHTML = html;

        } catch (err) {
            container.innerHTML = `<p class="text-red-500 p-4 bg-white rounded-xl border border-red-200">${err.message}</p>`;
        }
    },

    async addHistoryEntry(e) {
        e.preventDefault();
        if (!State.currentVehicle) return;

        const body = {
            vehicle_id: State.currentVehicle.id,
            type: document.getElementById('hist-type').value,
            date: document.getElementById('hist-date').value,
            mileage: document.getElementById('hist-mileage').value,
            cost: document.getElementById('hist-cost').value,
            liters: document.getElementById('hist-liters').value,
            station: document.getElementById('hist-station').value
        };

        try {
            await this.apiCall('history.php', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            this.loadHistory();
        } catch (err) {
            alert("Erreur lors de l'enregistrement : " + err.message);
        }
    },

    // --- DOCUMENTS (Vue complète) ---
    async loadDocumentsView() {
        const container = document.getElementById('documents-content');
        if (!container) return;

        if (!State.currentVehicle) {
            container.innerHTML = `<div class="p-6 bg-white rounded-2xl border border-slate-200 text-slate-500">Vous devez réserver un véhicule pour consulter et ajouter des documents.</div>`;
            return;
        }

        container.innerHTML = '<p class="text-slate-500">Chargement des documents...</p>';

        try {
            const docs = await this.apiCall(`documents.php?vehicle_id=${State.currentVehicle.id}`);

            let html = `
                <form onsubmit="App.addDocumentFromView(event)" class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 class="font-bold text-lg text-slate-800 border-b pb-2">Ajouter un document pour ${State.currentVehicle.make} ${State.currentVehicle.model}</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">Nom du document</label>
                            <input type="text" id="doc-view-name" placeholder="ex: Carte Grise, Assurance" required class="w-full p-2.5 border rounded-xl text-sm bg-slate-50">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">Fichier</label>
                            <input type="file" id="doc-view-file" required class="w-full p-2 border rounded-xl text-sm bg-slate-50">
                        </div>
                    </div>
                    <button type="submit" class="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2.5 rounded-xl transition shadow-md shadow-orange-500/20">Envoyer le document</button>
                </form>

                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <h3 class="font-bold text-lg text-slate-800 border-b pb-2">Documents disponibles</h3>
            `;

            if (!Array.isArray(docs) || docs.length === 0) {
                html += `<p class="text-slate-500 py-4">Aucun document pour ce véhicule.</p>`;
            } else {
                html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
                docs.forEach(doc => {
                    html += `
                        <div class="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">
                            <div>
                                <p class="font-bold text-slate-800">${doc.name}</p>
                                <p class="text-xs text-slate-500">Catégorie : ${doc.category}</p>
                            </div>
                            <a href="${doc.file_path}" target="_blank" class="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold transition">
                                Ouvrir
                            </a>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            html += `</div>`;
            container.innerHTML = html;

        } catch (err) {
            container.innerHTML = `<p class="text-red-500 p-4 bg-white rounded-xl border border-red-200">${err.message}</p>`;
        }
    },

    async addDocumentFromView(e) {
        e.preventDefault();
        if (!State.currentVehicle) return;

        const nameInput = document.getElementById('doc-view-name');
        const fileInput = document.getElementById('doc-view-file');

        if (fileInput.files.length === 0) return;

        const formData = new FormData();
        formData.append('vehicle_id', State.currentVehicle.id);
        formData.append('name', nameInput.value);
        formData.append('category', 'autres');
        formData.append('file', fileInput.files[0]);

        try {
            await this.apiCall('documents.php', {
                method: 'POST',
                body: formData
            });
            this.loadDocumentsView();
        } catch (err) {
            alert("Erreur lors de l'envoi : " + err.message);
        }
    },

    // --- GUIDE D'ENTRETIEN ---
    async loadGuide() {
        const container = document.getElementById('guide-list');
        if (!container) return;

        container.innerHTML = '<p class="text-slate-500 col-span-full">Chargement des conseils d\'entretien...</p>';

        try {
            const articles = await this.apiCall('guide.php');

            // 1. On intègre le formulaire d'ajout en haut de la page (col-span-full pour prendre toute la largeur)
            let html = `
                <form onsubmit="App.addGuideEntry(event)" class="col-span-full bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 mb-2">
                    <h3 class="font-bold text-lg text-slate-800 border-b pb-2">Partager un conseil d'entretien</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">Titre *</label>
                            <input type="text" id="guide-title" placeholder="Ex: Pression des pneus" required class="w-full p-2.5 border rounded-xl text-sm bg-slate-50">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">Catégorie *</label>
                            <select id="guide-category" class="w-full p-2.5 border rounded-xl text-sm bg-slate-50">
                                <option value="Pneus">Pneus</option>
                                <option value="Moteur">Moteur</option>
                                <option value="Carrosserie">Carrosserie</option>
                                <option value="Intérieur">Intérieur</option>
                                <option value="Général">Général</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-600 mb-1">Temps de lecture (min)</label>
                            <input type="number" id="guide-read-time" value="3" min="1" class="w-full p-2.5 border rounded-xl text-sm bg-slate-50">
                        </div>
                        <div class="md:col-span-3">
                            <label class="block text-xs font-bold text-slate-600 mb-1">Contenu du conseil *</label>
                            <textarea id="guide-content-text" required rows="3" placeholder="Rédigez votre conseil ici..." class="w-full p-2.5 border rounded-xl text-sm bg-slate-50"></textarea>
                        </div>
                    </div>
                    <button type="submit" class="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2.5 rounded-xl transition shadow-md shadow-orange-500/20">Enregistrer le conseil</button>
                </form>
            `;

            // 2. On affiche ensuite la liste des articles
            if (!Array.isArray(articles) || articles.length === 0) {
                html += `
                    <div class="col-span-full p-6 bg-white rounded-2xl border border-slate-200 text-slate-500">
                        Aucun conseil d'entretien disponible pour le moment. Soyez le premier à en ajouter un !
                    </div>`;
            } else {
                articles.forEach(art => {
                    html += `
                        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-orange-300 transition">
                            <div>
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 uppercase">
                                        ${art.category || 'Général'}
                                    </span>
                                    <span class="text-xs text-slate-400 font-medium">⏱️ ${art.read_time || 3} min</span>
                                </div>
                                <h4 class="font-bold text-slate-800 text-base mb-2">${art.title}</h4>
                            </div>
                            <button onclick="App.openGuideModal(${art.id})" class="mt-4 w-full bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-700 py-2.5 rounded-xl text-sm font-bold transition">
                                Consulter le conseil
                            </button>
                        </div>
                    `;
                });
            }

            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<p class="col-span-full text-red-500 p-4 bg-white rounded-xl border border-red-200">${err.message}</p>`;
        }
    },

    // Nouvelle fonction pour gérer l'envoi du formulaire
    async addGuideEntry(e) {
        e.preventDefault();

        // Récupération des valeurs du formulaire
        const body = {
            title: document.getElementById('guide-title').value,
            category: document.getElementById('guide-category').value,
            read_time: document.getElementById('guide-read-time').value,
            content: document.getElementById('guide-content-text').value
        };

        try {
            // Envoi des données à guide.php via POST
            await this.apiCall('guide.php', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            
            // Recharger la vue pour afficher le nouveau conseil immédiatement
            this.loadGuide();
        } catch (err) {
            alert("Erreur lors de l'enregistrement : " + err.message);
        }
    },

    async openGuideModal(id) {
        try {
            const article = await this.apiCall(`guide.php?id=${id}`);
            
            let modal = document.getElementById('guide-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'guide-modal';
                document.body.appendChild(modal);
            }

            modal.className = "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4";
            modal.innerHTML = `
                <div class="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
                    <button onclick="document.getElementById('guide-modal').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl px-2">&times;</button>
                    <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 uppercase inline-block mb-2">
                        ${article.category || 'Général'}
                    </span>
                    <h3 class="font-extrabold text-xl text-slate-800 mb-1">${article.title}</h3>
                    <p class="text-xs text-slate-400 mb-4">Temps de lecture : ${article.read_time || 3} min</p>
                    <div class="border-t pt-4 text-slate-600 text-sm whitespace-pre-line leading-relaxed">
                        ${article.content}
                    </div>
                </div>
            `;
        } catch (err) {
            alert("Impossible de charger le conseil : " + err.message);
        }
    }

};

document.addEventListener('DOMContentLoaded', () => App.init());