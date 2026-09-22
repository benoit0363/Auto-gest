const API_BASE = './api'; // Ajustez si votre dossier API est placé différemment

// Gestion des onglets UI
function switchTab(tab) {
    const isLogin = tab === 'login';
    
    // Affichage des formulaires
    document.getElementById('form-login').classList.toggle('hidden', !isLogin);
    document.getElementById('form-register').classList.toggle('hidden', isLogin);
    
    // Style des onglets
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    
    if (isLogin) {
        tabLogin.className = "flex-1 py-4 text-orange-600 border-b-2 border-orange-500 bg-orange-50/50";
        tabRegister.className = "flex-1 py-4 text-slate-500 hover:text-slate-700 transition";
    } else {
        tabRegister.className = "flex-1 py-4 text-orange-600 border-b-2 border-orange-500 bg-orange-50/50";
        tabLogin.className = "flex-1 py-4 text-slate-500 hover:text-slate-700 transition";
    }
}

// Action : Se connecter et orienter (Employé ou Admin)
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    errorDiv.classList.add('hidden');
    btn.innerHTML = "Connexion en cours...";
    btn.disabled = true;

    try {
        // Appel à l'API PHP[cite: 39]
        const response = await fetch(`${API_BASE}/auth.php?action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Erreur lors de la connexion");
        }

        // Enregistrement de la session dans le LocalStorage
        localStorage.setItem('ag_token', data.token);
        localStorage.setItem('ag_user', JSON.stringify(data.user));

        // Redirection conditionnelle basée sur le rôle renvoyé par l'API[cite: 39]
        if (data.user.role === 'employee' || data.user.role === 'employe') {
            window.location.href = 'employe.html';
        } else {
            // L'administrateur est redirigé vers l'application principale
            window.location.href = 'index.html';
        }

    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
        btn.innerHTML = "Se connecter";
        btn.disabled = false;
    }
}

// Action : Créer une entreprise (Admin)
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const errorDiv = document.getElementById('register-error');
    const btn = document.getElementById('btn-register');

    errorDiv.classList.add('hidden');
    btn.innerHTML = "Création en cours...";
    btn.disabled = true;

    try {
        // Appel à l'API PHP en forçant le rôle 'admin' pour écraser la valeur par défaut[cite: 39]
        const response = await fetch(`${API_BASE}/auth.php?action=register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: name, 
                email: email, 
                password: password, 
                role: 'admin' // CRUCIAL : Informe l'API que l'on crée un compte administrateur
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erreur lors de la création");
        }

        // Auto-connexion après création
        localStorage.setItem('ag_token', data.token);
        localStorage.setItem('ag_user', JSON.stringify(data.user));
        
        // Redirection directe de l'admin vers index.html
        window.location.href = 'index.html';

    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
        btn.innerHTML = "Créer le compte Administrateur";
        btn.disabled = false;
    }
}

// Optionnel : Ajouter la gestion de la déconnexion[cite: 39]
async function handleLogout() {
    const token = localStorage.getItem('ag_token');
    if (token) {
        try {
            await fetch(`${API_BASE}/auth.php?action=logout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (e) {
            console.error("Erreur réseau lors de la déconnexion", e);
        }
    }
    localStorage.removeItem('ag_token');
    localStorage.removeItem('ag_user');
    window.location.href = 'employe.html';
}