document.addEventListener('DOMContentLoaded', () => {
    
    // Verificación de seguridad silenciosa
    if (typeof i18next === 'undefined' || typeof i18nextHttpBackend === 'undefined') {
        return; // Si no carga, simplemente no hace nada (sin errores en consola)
    }

    i18next
        .use(i18nextHttpBackend)
        .init({
            lng: 'es', 
            fallbackLng: 'es',
            debug: false, // <--- ESTO ES LO QUE SILENCIA LOS MENSAJES DE LA LIBRERÍA
            backend: {
                loadPath: '/static/locales/{{lng}}.json'
            }
        }, function(err, t) {
            // Solo mostramos error si realmente falla la carga inicial
            if (err) return console.error('Error i18next:', err);
            
            updateContent();
            
            // Sincronizar el selector visualmente
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

// Función global para el botón
window.cambiarIdioma = function(lang) {
    if (!i18next.isInitialized) return;

    i18next.changeLanguage(lang, (err, t) => {
        if (err) return console.error("Error cambio idioma:", err);
        updateContent();
    });
};