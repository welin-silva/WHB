
document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. CONFIGURACIÓN (TAMAÑO MEDIANO)
    // ==========================================
    var radius = 260;
    var autoRotate = true;   
    var rotateSpeed = -60;   
    var imgWidth = 140;
    var imgHeight = 190;

    // ==========================================
    // 2. INICIALIZACIÓN
    // ==========================================
    setTimeout(init, 100);

    var odrag = document.getElementById('drag-container');
    var ospin = document.getElementById('spin-container');
    var interactionZone = document.querySelector('.carousel-section');
    var aImg = ospin.getElementsByClassName('card-3d');
    var aEle = [...aImg]; 

    ospin.style.width = imgWidth + "px";
    ospin.style.height = imgHeight + "px";

    var ground = document.getElementById('ground');
    if (ground) {
        ground.style.width = radius * 3.5 + "px";
        ground.style.height = radius * 3.5 + "px";
    }

    function init(delayTime) {
        for (var i = 0; i < aEle.length; i++) {
            var transform = "rotateY(" + (i * (360 / aEle.length)) + "deg) translateZ(" + radius + "px)";
            aEle[i].style.transform = transform;
            aEle[i].style.transition = "transform 1s";
            aEle[i].style.transitionDelay = delayTime || (aEle.length - i) / 4 + "s";
        }
    }

    // ==========================================
    // 3. ANIMACIÓN Y ROTACIÓN
    // ==========================================
    function applyTranform(obj) {
        if(tY > 10) tY = 10; 
        if(tY < 0) tY = 0;   

        obj.style.transform = "rotateX(" + (-tY) + "deg) rotateY(" + (tX) + "deg)";
    }

    function playSpin(yes) {
        ospin.style.animationPlayState = (yes ? 'running' : 'paused');
    }

    var sX, sY, nX, nY, desX = 0,
        desY = 0,
        tX = 0,
        tY = 10; 

        if (autoRotate) {
        var animationName = (rotateSpeed > 0 ? 'spin' : 'spinRevert');
        ospin.style.animation = `${animationName} ${Math.abs(rotateSpeed)}s infinite linear`;
    }

    // ==========================================
    // 4. EVENTOS DE ARRASTRE
    // ==========================================
    if (interactionZone) {
        interactionZone.onpointerdown = function (e) {
            clearInterval(odrag.timer);
            e = e || window.event;
            var sX = e.clientX,
                sY = e.clientY;

            document.onpointermove = function (e) {
                e = e || window.event;
                var nX = e.clientX,
                    nY = e.clientY;
                
                desX = nX - sX;
                desY = nY - sY;
                
                tX += desX * 0.1;
                tY += desY * 0.1;
                
                applyTranform(odrag);
                sX = nX;
                sY = nY;
            };

            document.onpointerup = function (e) {
                odrag.timer = setInterval(function () {
                    desX *= 0.95;
                    desY *= 0.95;
                    tX += desX * 0.1;
                    tY += desY * 0.1;
                    applyTranform(odrag);
                    playSpin(false);
                    
                    if (Math.abs(desX) < 0.5 && Math.abs(desY) < 0.5) {
                        clearInterval(odrag.timer);
                        playSpin(true); 
                    }
                }, 17);
                document.onpointermove = document.onpointerup = null;
            };
            return false;
        };
    }
});

// ==========================================
// 5. FUNCIONES GLOBALES
// ==========================================
function selectProduct(productId) {
    console.log("Producto seleccionado:", productId);
}