
document.addEventListener('DOMContentLoaded', () => {

    // ── 1. CONFIG ─────────────────────────────────────────────
    var RADIUS             = 200;
    var CARD_W             = 100;
    var CARD_H             = 142;
    var SPIN_DEG_PER_FRAME = -(360 / (70 * 60)); // ~70s por vuelta (showroom)
    var ORBIT_SLOWDOWN     = 0;
    var clusterMode        = false; // false = showroom orbit | true = static prescription

    // Posiciones 3D del cluster de prescripción por número de tarjetas.
    // ry = rotateY(deg), tz = translateZ(px), sc = scale
    // tx = world-space horizontal offset (applied before rotateY so separation is in screen space)
    // ry = facing angle, tz = depth push in local frame, sc = scale
    var CLUSTER_SLOTS = {
        1: [{ tx:    0, ry:  0, tz: 70, sc: 1.10 }],
        2: [{ tx:    0, ry:  0, tz: 68, sc: 1.08 },
            { tx:  -90, ry:-18, tz: 40, sc: 0.86 }],
        3: [{ tx:    0, ry:  0, tz: 70, sc: 1.06 },
            { tx:  -95, ry:-18, tz: 42, sc: 0.85 },
            { tx:   95, ry: 18, tz: 42, sc: 0.85 }],
        4: [{ tx:    0, ry:  0, tz: 68, sc: 1.04 },
            { tx:  -90, ry:-16, tz: 44, sc: 0.87 },
            { tx:   90, ry: 16, tz: 44, sc: 0.87 },
            { tx:    0, ry:  0, tz: 10, sc: 0.72 }],
        5: [{ tx:    0, ry:  0, tz: 66, sc: 1.02 },
            { tx:  -88, ry:-15, tz: 44, sc: 0.86 },
            { tx:   88, ry: 15, tz: 44, sc: 0.86 },
            { tx: -162, ry:-28, tz: 24, sc: 0.72 },
            { tx:  162, ry: 28, tz: 24, sc: 0.72 }]
    };

    // ── 2. REFERENCIAS ────────────────────────────────────────
    var odrag          = document.getElementById('drag-container');
    var ospin          = document.getElementById('spin-container');
    var interactionZone = document.querySelector('.carousel-section');

    if (!odrag || !ospin) return;

    ospin.style.width  = CARD_W + 'px';
    ospin.style.height = CARD_H + 'px';
    ospin.style.animation = 'none';

    // ── 3. ESTADO ─────────────────────────────────────────────
    var spinAngle       = 0;
    var tX              = 0;
    var tY              = 8;
    var desX            = 0;
    var desY            = 0;
    var isSpinning      = true;
    var snapRafId       = null;
    var spinRafId       = null;
    var activePid       = null;
    var floatClock      = 0;
    var clusterTrans    = null; // { startTs, dur, items: [{card, fry, ftz, fsc, try_, ttz, tsc, slot}] }

    // ── 4. TARJETAS VISIBLES ──────────────────────────────────
    function cartasVisibles() {
        return Array.from(ospin.getElementsByClassName('card-3d'))
                    .filter(function(c) { return c.style.display !== 'none'; });
    }

    // ── 5. SHOWROOM — distribución equidistante ───────────────
    function distribuirAngulos(cards) {
        var n = cards.length;
        cards.forEach(function(card, i) {
            card.dataset.orbitAngle = n > 1 ? i * (360 / n) : 0;
        });
    }

    (function iniciarShowroom() {
        var cards = cartasVisibles();
        distribuirAngulos(cards);
        posicionarCartas();
    })();

    // ── 6. POSICIONAR EN ÓRBITA (showroom) ───────────────────
    function posicionarCartas() {
        if (clusterMode) return; // cluster se posiciona en su propio bloque
        var cards = cartasVisibles();
        if (!cards.length) return;
        cards.forEach(function(card) {
            var ang = parseFloat(card.dataset.orbitAngle);
            if (isNaN(ang)) ang = 0;
            card.style.transform =
                'rotateY(' + ang + 'deg) translateZ(' + RADIUS + 'px)';
        });
    }

    setTimeout(posicionarCartas, 60);

    function redimensionarGround() {
        var ground = document.getElementById('ground');
        if (!ground) return;
        var sz = clusterMode ? 400 : RADIUS * 3;
        ground.style.width  = sz + 'px';
        ground.style.height = sz + 'px';
    }
    redimensionarGround();

    // ── 7. PROFUNDIDAD coseno (showroom) ──────────────────────
    function actualizarProfundidadOrbit() {
        var cards = cartasVisibles();
        cards.forEach(function(card) {
            var ang   = parseFloat(card.dataset.orbitAngle || 0);
            var world = ((ang + spinAngle + tX) % 360 + 360) % 360;
            var cosA  = Math.cos(world * Math.PI / 180);
            var t     = (cosA + 1) / 2;

            var sc = (0.72 + 0.28 * t).toFixed(3);
            var op = (0.22 + 0.78 * t).toFixed(3);
            var br = (0.55 + 0.45 * t).toFixed(3);

            card.style.transform =
                'rotateY(' + ang + 'deg) translateZ(' + RADIUS + 'px) scale(' + sc + ')';
            card.style.opacity = op;
            card.style.filter  = 'brightness(' + br + ')';
        });
    }

    // ── 8. CLUSTER — posición estática + flotación + transición cinematic ──
    function _applyCardCluster(card, tx, ry, tz, sc, slot) {
        var isActive   = card.classList.contains('active-treatment');
        var phaseShift = slot * 1.1;
        var floatY     = isActive
            ? Math.sin(floatClock + phaseShift) * 2.4
            : Math.sin(floatClock + phaseShift) * 1.2;

        // translateX first = world-space separation; rotateY+translateZ = 3D facing/depth
        card.style.transform =
            'translateX(' + tx.toFixed(2) + 'px) ' +
            'rotateY(' + ry.toFixed(2) + 'deg) ' +
            'translateZ(' + tz.toFixed(2) + 'px) ' +
            'translateY(' + floatY.toFixed(2) + 'px) ' +
            'scale(' + sc.toFixed(3) + ')';

        // z-index: center card on top visually; side cards never fully occluded
        card.style.zIndex = isActive ? '500' : String(200 - slot * 40);

        var depthT = Math.max(0, Math.min(1, (tz + 20) / 100));
        card.style.opacity = isActive ? '1' : (0.72 + 0.28 * depthT).toFixed(3);
        card.style.filter  = isActive
            ? 'brightness(1.08)'
            : 'brightness(' + (0.72 + 0.28 * depthT).toFixed(3) + ')';

        card._clusterLive = { tx: tx, ry: ry, tz: tz, sc: sc };
    }

    function actualizarCluster() {
        floatClock += 0.012;

        if (clusterTrans) {
            var now = performance.now();
            if (!clusterTrans.startTs) clusterTrans.startTs = now;
            var p    = Math.min((now - clusterTrans.startTs) / clusterTrans.dur, 1);
            var ease = 1 - Math.pow(1 - p, 4); // quartic ease-out — cinematic deceleration

            clusterTrans.items.forEach(function(it) {
                var tx = it.ftx + (it.ttx - it.ftx) * ease;
                var ry = it.fry + (it.try_ - it.fry) * ease;
                var tz = it.ftz + (it.ttz - it.ftz) * ease;
                var sc = it.fsc + (it.tsc - it.fsc) * ease;
                _applyCardCluster(it.card, tx, ry, tz, sc, it.slot);
            });

            if (p >= 1) clusterTrans = null;
            return;
        }

        cartasVisibles().forEach(function(card) {
            var pos = card._clusterPos;
            if (!pos) return;
            _applyCardCluster(card, pos.tx, pos.ry, pos.tz, pos.sc, pos._slot);
        });
    }

    // ── 9. BUCLE RAF ─────────────────────────────────────────
    function aplicarTransformDrag() {
        if (tY > 10) tY = 10;
        if (tY < 0)  tY = 0;
        odrag.style.transform = 'rotateX(' + (-tY) + 'deg) rotateY(' + tX + 'deg)';
    }

    function tickSpin() {
        if (!clusterMode && isSpinning) {
            var spd = SPIN_DEG_PER_FRAME * (1 - ORBIT_SLOWDOWN);
            spinAngle = (spinAngle + spd) % 360;
            ospin.style.transform = 'rotateY(' + spinAngle + 'deg)';
        }
        if (clusterMode) {
            actualizarCluster();
        } else {
            actualizarProfundidadOrbit();
        }
        spinRafId = requestAnimationFrame(tickSpin);
    }
    spinRafId = requestAnimationFrame(tickSpin);

    // ── 10. ARRASTRE ─────────────────────────────────────────
    if (interactionZone) {
        interactionZone.onpointerdown = function(e) {
            if (clusterMode) return; // sin arrastre en modo prescripción
            clearInterval(odrag.timer);
            var sX = e.clientX, sY = e.clientY;

            document.onpointermove = function(e) {
                desX = e.clientX - sX;
                desY = e.clientY - sY;
                tX  += desX * 0.1;
                tY  += desY * 0.1;
                aplicarTransformDrag();
                sX = e.clientX; sY = e.clientY;
            };

            document.onpointerup = function() {
                isSpinning = false;
                odrag.timer = setInterval(function() {
                    desX *= 0.92; desY *= 0.92;
                    tX   += desX * 0.1;
                    tY   += desY * 0.1;
                    aplicarTransformDrag();
                    if (Math.abs(desX) < 0.3 && Math.abs(desY) < 0.3) {
                        clearInterval(odrag.timer);
                        isSpinning = true;
                    }
                }, 17);
                document.onpointermove = document.onpointerup = null;
            };
            return false;
        };
    }

    // ── 11. TRANSICIÓN ORBIT → CLUSTER ───────────────────────
    function transicionarACluster(cards, defaultPid) {
        isSpinning = false;
        ORBIT_SLOWDOWN = 0;
        if (snapRafId) cancelAnimationFrame(snapRafId);

        // Primero snap rápido del ospin a 0 y del drag a neutro
        var startSpin = spinAngle;
        var targetSpin = Math.round(spinAngle / 360) * 360;
        var startTX   = tX;
        var startTS   = null;
        var SNAP_MS   = 500;

        function snapToZero(ts) {
            if (!startTS) startTS = ts;
            var p    = Math.min((ts - startTS) / SNAP_MS, 1);
            var ease = 1 - Math.pow(1 - p, 3);
            spinAngle = startSpin + (targetSpin - startSpin) * ease;
            tX        = startTX  * (1 - ease);
            ospin.style.transform = 'rotateY(' + spinAngle + 'deg)';
            aplicarTransformDrag();
            if (p < 1) {
                snapRafId = requestAnimationFrame(snapToZero);
            } else {
                spinAngle = targetSpin;
                tX = 0;
                ospin.style.transform = 'rotateY(0deg)';
                aplicarTransformDrag();
                _aplicarPosicionesCluster(cards, defaultPid);
            }
        }
        snapRafId = requestAnimationFrame(snapToZero);
    }

    function _aplicarPosicionesCluster(cards, defaultPid) {
        var n      = Math.min(cards.length, 5);
        var slots  = CLUSTER_SLOTS[n] || CLUSTER_SLOTS[5];

        // Slot 0 → active/default, resto en orden
        var ordered = cards.slice();
        if (defaultPid) {
            var idx = ordered.findIndex(function(c) {
                return c.dataset.productId === defaultPid;
            });
            if (idx > 0) {
                var tmp = ordered.splice(idx, 1)[0];
                ordered.unshift(tmp);
            }
        }

        ordered.forEach(function(card, i) {
            var slot = slots[i] || slots[slots.length - 1];
            card._clusterPos = Object.assign({}, slot, { _slot: i });
        });

        // Activar clase y animar glow del default
        clusterMode = true;
        redimensionarGround();

        // Marcar el contenedor para el label "TRATAMIENTO PRESCRITO"
        if (interactionZone) interactionZone.classList.add('cluster-active');

        if (defaultPid) {
            setTimeout(function() { window.activarTratamiento(defaultPid); }, 80);
        }
    }

    // ── 12. ACTIVAR TRATAMIENTO ───────────────────────────────
    window.activarTratamiento = function(pid) {
        if (activePid === pid) return;
        activePid = pid;

        cartasVisibles().forEach(function(card) {
            card.classList.remove('active-treatment');
            if (card.dataset.productId === pid) card.classList.add('active-treatment');
        });

        if (window.cambiarProductoVisual) window.cambiarProductoVisual(pid);
    };

    // ── 13. CLICK EN TARJETA (en cluster) — recomposición cinematic ─────────
    window._clusterSelectProduct = function(pid) {
        if (!clusterMode) return false;
        if (activePid === pid) return true; // already center — no-op

        var cards  = cartasVisibles();
        var n      = Math.min(cards.length, 5);
        var slots  = CLUSTER_SLOTS[n] || CLUSTER_SLOTS[5];

        // Build new order: clicked pid → slot 0, rest keep relative sequence
        var ordered = cards.slice();
        var idx = ordered.findIndex(function(c) { return c.dataset.productId === pid; });
        if (idx > 0) {
            var moved = ordered.splice(idx, 1)[0];
            ordered.unshift(moved);
        }

        // Capture departure positions (live interpolated values or static target)
        var items = ordered.map(function(card, i) {
            var live = card._clusterLive || card._clusterPos || slots[0];
            var to   = slots[i] || slots[slots.length - 1];
            return {
                card: card,
                ftx:  live.tx !== undefined ? live.tx : 0,
                fry:  live.ry, ftz: live.tz, fsc: live.sc, // from
                ttx:  to.tx,   try_: to.ry,  ttz: to.tz,   tsc: to.sc, // to
                slot: i
            };
        });

        // Update static targets so steady-state render is correct after transition
        ordered.forEach(function(card, i) {
            var to = slots[i] || slots[slots.length - 1];
            card._clusterPos = Object.assign({}, to, { _slot: i });
        });

        clusterTrans = { startTs: null, dur: 620, items: items };

        window.activarTratamiento(pid);
        return true;
    };

    // ── 14. API PÚBLICA — aplicarConfigCarrusel ───────────────
    window.aplicarConfigCarrusel = function(uiConfig, carouselConfig) {
        if (!uiConfig) return;

        var allCards = Array.from(ospin.getElementsByClassName('card-3d'));
        var textNode = ospin.querySelector('p');

        var recom = [], resto = [];
        allCards.forEach(function(card) {
            var pid   = card.dataset.productId || '';
            var cfg   = uiConfig[pid] || {};
            var isRec = !!cfg.is_recommended;

            card.classList.toggle('ia-recomendado', isRec);
            card.classList.remove('active-treatment');

            if (cfg.glow_color) {
                card.style.setProperty('--glow-card',     cfg.glow_color + 'cc');
                card.style.setProperty('--glow-card-far', cfg.glow_color + '33');
            }

            (isRec ? recom : resto).push(card);
        });

        // Detectar default
        var defaultPid = null;
        Object.keys(uiConfig).forEach(function(pid) {
            if (uiConfig[pid].is_default_selected) defaultPid = pid;
        });

        // Fade-out de los no recomendados
        var FADE_MS = 420;
        resto.forEach(function(card) {
            card.style.transition    = 'opacity ' + FADE_MS + 'ms ease';
            card.style.opacity       = '0';
            card.style.pointerEvents = 'none';
            setTimeout(function() { card.style.display = 'none'; }, FADE_MS + 20);
        });

        // Reordenar DOM
        var frag = document.createDocumentFragment();
        recom.concat(resto).forEach(function(c) { frag.appendChild(c); });
        ospin.innerHTML = '';
        ospin.appendChild(frag);
        if (textNode) ospin.appendChild(textNode);

        // Después del fade, transicionar al cluster
        setTimeout(function() {
            var visible = cartasVisibles();
            transicionarACluster(visible, defaultPid);
        }, FADE_MS + 60);
    };

    // ── 15. RESET (vuelta al showroom) ────────────────────────
    window.resetCarrusel = function() {
        clusterMode  = false;
        activePid    = null;
        clusterTrans = null;
        RADIUS       = 200;
        floatClock   = 0;
        redimensionarGround();

        var cards = Array.from(ospin.getElementsByClassName('card-3d'));
        var n     = cards.length;
        cards.forEach(function(card, i) {
            card.style.display       = '';
            card.style.opacity       = '1';
            card.style.pointerEvents = '';
            card.classList.remove('ia-recomendado', 'active-treatment');
            delete card._clusterPos;
            delete card._clusterLive;
            card.dataset.orbitAngle  = n > 1 ? i * (360 / n) : 0;
        });

        spinAngle  = 0;
        tX         = 0;
        ospin.style.transform = 'rotateY(0deg)';
        aplicarTransformDrag();
        posicionarCartas();
        isSpinning = true;

        // Quitar label de prescripción
        if (interactionZone) interactionZone.classList.remove('cluster-active');
    };

});

// ── 16. CLIC EN TARJETA ───────────────────────────────────
function selectProduct(productId) {
    // En cluster mode: solo activar tratamiento (sin órbita)
    if (window._clusterSelectProduct && window._clusterSelectProduct(productId)) return;
    // En showroom: activar + rotar
    if (window.activarTratamiento) window.activarTratamiento(productId);
}
