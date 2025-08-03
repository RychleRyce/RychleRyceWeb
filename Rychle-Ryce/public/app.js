// Rychlé Rýče - Hlavní JavaScript soubor

// Kontrola přihlášení
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        
        if (data.authenticated) {
            showUserInfo(data.name, data.role);
            showContentForRole(data.role);
        } else {
            showAuthButtons();
            showGuestContent();
        }
    } catch (error) {
        console.error('Chyba při kontrole přihlášení:', error);
        showAuthButtons();
        showGuestContent();
    }
}

// Zobrazení informací o uživateli
function showUserInfo(name, role) {
    const userInfo = document.getElementById('user-info');
    const authButtons = document.getElementById('auth-buttons');
    const userNameSpan = document.getElementById('user-name');
    
    if (userInfo && authButtons && userNameSpan) {
        userNameSpan.textContent = name;
        userInfo.classList.remove('d-none');
        authButtons.classList.add('d-none');
    }
}

// Zobrazení tlačítek pro přihlášení
function showAuthButtons() {
    const userInfo = document.getElementById('user-info');
    const authButtons = document.getElementById('auth-buttons');
    
    if (userInfo && authButtons) {
        userInfo.classList.add('d-none');
        authButtons.classList.remove('d-none');
    }
}

// Zobrazení obsahu podle role
function showContentForRole(role) {
    // Skrytí všech obsahů
    const contents = ['guest-content', 'customer-content', 'worker-content', 'admin-content'];
    contents.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.classList.add('d-none');
    });
    
    // Zobrazení příslušného obsahu
    const contentId = role + '-content';
    const content = document.getElementById(contentId);
    if (content) {
        content.classList.remove('d-none');
    }
    
    // Pro brigádníky a adminy skryjeme výběr služeb
    const servicesSection = document.getElementById('services-section');
    if (servicesSection && (role === 'worker' || role === 'admin')) {
        servicesSection.style.display = 'none';
    }
}

// Zobrazení obsahu pro hosty
function showGuestContent() {
    const guestContent = document.getElementById('guest-content');
    if (guestContent) {
        guestContent.classList.remove('d-none');
    }
}

// Odhlášení
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            window.location.href = '/';
        } else {
            throw new Error('Chyba při odhlašování');
        }
    } catch (error) {
        console.error('Chyba při odhlašování:', error);
        alert('Chyba při odhlašování. Zkuste to znovu.');
    }
}

// Zobrazení notifikace
function showNotification(message, type = 'success') {
    // Odstraníme existující notifikace
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    // Vytvoříme novou notifikaci
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Přidáme na začátek body
    document.body.insertBefore(alertDiv, document.body.firstChild);
    
    // Automatické odstranění po 5 sekundách
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Formátování data
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Překlad typu práce
function translateWorkType(workType) {
    const translations = {
        'sekani_travy': 'Sekání trávy',
        'strhani_stromu': 'Stříhání stromů/keřů',
        'natrani_plotu': 'Natírání plotu',
        'jina_prace': 'Jiná práce'
    };
    return translations[workType] || workType;
}

// Překlad statusu objednávky
function translateStatus(status) {
    const translations = {
        'pending': 'Čeká na přijetí',
        'accepted': 'Přijato',
        'completed': 'Dokončeno',
        'cancelled': 'Zrušeno'
    };
    return translations[status] || status;
}

// Získání CSS třídy pro status
function getStatusClass(status) {
    const classes = {
        'pending': 'status-pending',
        'accepted': 'status-accepted',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
}

// Vytvoření hvězdiček pro hodnocení
function createStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star text-warning"></i>';
        } else {
            stars += '<i class="far fa-star text-muted"></i>';
        }
    }
    return stars;
}

// Validace formuláře
function validateForm(formData, requiredFields) {
    const errors = [];
    
    requiredFields.forEach(field => {
        if (!formData[field] || formData[field].trim() === '') {
            errors.push(`Pole "${field}" je povinné`);
        }
    });
    
    // Validace emailu
    if (formData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            errors.push('Neplatný formát emailu');
        }
    }
    
    // Validace telefonu
    if (formData.phone) {
        const phoneRegex = /^(\+420)?[0-9]{9}$/;
        if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
            errors.push('Neplatný formát telefonu (použijte formát +420123456789)');
        }
    }
    
    return errors;
}

// Zobrazení loading indikátoru
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p class="mt-3">Načítám...</p>
            </div>
        `;
    }
}

// Odstranění loading indikátoru
function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '';
    }
}

// Export funkcí pro globální použití
window.checkAuth = checkAuth;
window.logout = logout;
window.showNotification = showNotification;
window.formatDate = formatDate;
window.translateWorkType = translateWorkType;
window.translateStatus = translateStatus;
window.getStatusClass = getStatusClass;
window.createStarRating = createStarRating;
window.validateForm = validateForm;
window.showLoading = showLoading;
window.hideLoading = hideLoading;