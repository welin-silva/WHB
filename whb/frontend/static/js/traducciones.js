document.addEventListener('DOMContentLoaded', () => {
    
    if (typeof i18next === 'undefined' || typeof i18nextHttpBackend === 'undefined') {
        return;
    }

    i18next
        .use(i18nextHttpBackend)
        .init({
            lng: 'es', 
            fallbackLng: 'es',
            debug: false,
            backend: {
                loadPath: '/static/locales/{{lng}}.json'
            }
        }, function(err, t) {
            if (err) return console.error('Error i18next:', err);
            
            updateContent();
            
            const selector = document.getElementById('languageSwitcher');
            if(selector) selector.value = i18next.language; 
        });
});

function updateContent() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.innerHTML = i18next.t(key);
    });
}

window.cambiarIdioma = function(lang) {
    if (!i18next.isInitialized) return;

    i18next.changeLanguage(lang, (err, t) => {
        if (err) return console.error("Error cambio idioma:", err);
        updateContent();
    });
};