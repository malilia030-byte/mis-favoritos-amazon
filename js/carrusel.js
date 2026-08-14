/* =====================================================
   carrusel.js — Carrusel dinámico, multi-tipo, autoplay,
                 scroll suave, prev/next, soporte swipe.
   ===================================================== */

(function () {
    'use strict';

    const TIPOS_VALIDOS = [
        'mas_vendidos',
        'mas_populares',
        'gadgets_top',
        'nuevos',
        'ofertas',
        'destacados'
    ];

    const CONFIG = {
        autoplayMs: 4500,
        cardWidth: 240,
        gap: 16,
    };

    const Carousel = {
        instancia: null,
        autoplay: true,
        autoplayTimer: null,
        _products: [],
    };

    /* -------- HELPERS -------- */
    const $ = (s, c = document) => c.querySelector(s);

    const escapeHtml = (str = '') =>
        String(str).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));

    const fmtPrice = (n) => {
        const num = Number(n) || 0;
        return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const safeUrl = (url = '') => {
        const trimmed = String(url).trim();
        if (!trimmed) return '#';
        try {
            const u = new URL(trimmed);
            if (!/^https?:$/.test(u.protocol)) return '#';
            return u.toString();
        } catch { return '#'; }
    };

    function cardHTML(p) {
        const fallback =
            `https://placehold.co/600x600/FFE4EA/F25C86?text=${encodeURIComponent(p.nombre || 'Producto')}`;
        const img = (p.imagen_url && p.imagen_url.trim()) || fallback;
        const tagRaw = (p.carrusel_tipo || '').replace('_', ' ');

        return `
            <article class="product-card">
                <div class="image-wrap">
                    ${tagRaw ? `<span class="badge-tag">${escapeHtml(tagRaw)}</span>` : ''}
                    <img loading="lazy"
                         src="${escapeHtml(img)}"
                         alt="${escapeHtml(p.nombre || '')}"
                         onerror="this.src='${fallback}'">
                </div>
                <div class="info">
                    <div class="name">${escapeHtml(p.nombre || '')}</div>
                    <div class="price">${fmtPrice(p.precio)}</div>
                    <div class="actions">
                        <a class="btn-buy"
                           href="${safeUrl(p.link_amazon)}"
                           target="_blank" rel="noopener noreferrer sponsored">
                            Ver en Amazon →
                        </a>
                    </div>
                </div>
            </article>
        `;
    }

    /* -------- INIT -------- */
    function init(productos) {
        Carousel._products = Array.isArray(productos) ? productos : [];

        // Construir carruseles según los carrusel_tipo presentes
        TIPOS_VALIDOS.forEach(tipo => renderCarruselParaTipo(tipo));

        // Activar listeners en los carruseles renderizados
        $$('.carousel').forEach(bindCarrusel);
    }

    function renderCarruselParaTipo(tipo) {
        // Sólo el carrusel principal "mas_vendidos" existe en HTML por defecto.
        // Para los demás tipos, si hay productos, los inyectamos debajo.
        const items = Carousel._products.filter(p => (p.carrusel_tipo || '').trim() === tipo);
        if (!items.length) return;

        let target = $(`.carousel[data-tipo="${tipo}"]`);
        if (!target) {
            target = crearCarruselSection(tipo);
        }
        const track = $('.carousel-track', target);
        if (!track) return;

        track.innerHTML = items.map(cardHTML).join('');
        track.dataset.empty = '';
    }

    function crearCarruselSection(tipo) {
        // Insertar nuevo bloque de carrusel justo después del principal
        const sectionAnterior = $('.carousel-section');
        if (!sectionAnterior) return null;

        const titulos = {
            'mas_vendidos':  { h: '🏆 Más Vendidos',     p: 'Los productos que vuelan de las estanterías.' },
            'mas_populares': { h: '⭐ Más Populares',    p: 'Los favoritos de la comunidad.' },
            'gadgets_top':   { h: '🎧 Gadgets Top',      p: 'Tecnología que mejora tu día a día.' },
            'nuevos':        { h: '🆕 Recién Llegados',  p: 'Lo más nuevo en nuestra selección.' },
            'ofertas':       { h: '💸 Ofertas',          p: 'Precios que no puedes dejar pasar.' },
            'destacados':    { h: '✨ Destacados',       p: 'Una selección especial solo para ti.' },
        };
        const meta = titulos[tipo] || { h: tipo.replace('_', ' '), p: '' };

        const html = `
            <section class="section carousel-section" data-carrusel-tipo="${tipo}">
                <div class="container">
                    <div class="section-head">
                        <div>
                            <h2 class="section-title">${meta.h}</h2>
                            <p class="section-subtitle">${meta.p}</p>
                        </div>
                    </div>
                    <div class="carousel" data-tipo="${tipo}">
                        <button class="carousel-btn prev" aria-label="Anterior">‹</button>
                        <div class="carousel-track"></div>
                        <button class="carousel-btn next" aria-label="Siguiente">›</button>
                    </div>
                </div>
            </section>
        `;

        sectionAnterior.insertAdjacentHTML('afterend', html);
        const nuevo = document.querySelector(`.carousel[data-tipo="${tipo}"]`);
        bindCarrusel(nuevo);
        return nuevo;
    }

    /* -------- BIND -------- */
    function bindCarrusel(root) {
        if (!root) return;
        const track = $('.carousel-track', root);
        const prev  = $('.carousel-btn.prev', root);
        const next  = $('.carousel-btn.next', root);
        if (!track) return;

        const stepAmount = () => {
            const card = $('.product-card', track);
            if (!card) return CONFIG.cardWidth + CONFIG.gap;
            return card.getBoundingClientRect().width + CONFIG.gap;
        };

        if (prev) prev.addEventListener('click', () => {
            track.scrollBy({ left: -stepAmount(), behavior: 'smooth' });
            pauseThenResume();
        });
        if (next) next.addEventListener('click', () => {
            track.scrollBy({ left: stepAmount(), behavior: 'smooth' });
            pauseThenResume();
        });

        // Pausar autoplay al hover o al tocar
        root.addEventListener('mouseenter', stopAutoplay);
        root.addEventListener('mouseleave', startAutoplay);
        root.addEventListener('focusin', stopAutoplay);
        root.addEventListener('focusout', startAutoplay);

        // Reanudar tras interacción
        const pauseThenResume = () => { stopAutoplay(); setTimeout(startAutoplay, 4000); };

        // Swipe soporte via touch (mejorado)
        let touchStartX = 0;
        let touchEndX = 0;
        track.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].clientX;
            stopAutoplay();
        }, { passive: true });
        track.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].clientX;
            const dx = touchEndX - touchStartX;
            if (Math.abs(dx) > 40) {
                track.scrollBy({ left: dx > 0 ? -stepAmount() : stepAmount(), behavior: 'smooth' });
            }
            setTimeout(startAutoplay, 4000);
        }, { passive: true });

        startAutoplay();
    }

    /* -------- AUTOPLAY -------- */
    function startAutoplay() {
        if (!Carousel.autoplay) return;
        stopAutoplay();
        Carousel.autoplayTimer = setInterval(autoStep, CONFIG.autoplayMs);
    }

    function stopAutoplay() {
        if (Carousel.autoplayTimer) {
            clearInterval(Carousel.autoplayTimer);
            Carousel.autoplayTimer = null;
        }
    }

    function autoStep() {
        if (!Carousel.autoplay) return;
        const carruseles = $$('.carousel');
        carruseles.forEach(root => {
            const track = $('.carousel-track', root);
            if (!track) return;

            const max = track.scrollWidth - track.clientWidth - 2;
            if (track.scrollLeft >= max) {
                track.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                const card = $('.product-card', track);
                const step = card
                    ? card.getBoundingClientRect().width + CONFIG.gap
                    : CONFIG.cardWidth + CONFIG.gap;
                track.scrollBy({ left: step, behavior: 'smooth' });
            }
        });
    }

    function setAutoplay(on) {
        Carousel.autoplay = !!on;
        if (Carousel.autoplay) startAutoplay();
        else stopAutoplay();
    }

    /* -------- EXPOSE -------- */
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

    window.MF_Carousel = {
        init,
        setAutoplay,
        stop: stopAutoplay,
        start: startAutoplay,
        refresh: () => init(Carousel._products),
    };
})();
