/* =====================================================
   api.js — Capa de datos y render (LocalStorage)
   Lee el catálogo desde db.js (window.MF_DB)
   ===================================================== */

(function () {
    'use strict';

    // -------- STATE --------
    const state = {
        categorias: [],
        subcategorias: [],
        productos: [],
        filters: {
            search: '',
            min: 0,
            max: 99999,
        },
        autoplay: true,
    };

    // -------- UTILS --------
    const $  = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    const escapeHtml = (str = '') =>
        String(str).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));

    const formatPrice = (n) => {
        const num = Number(n) || 0;
        return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const toast = (msg, type = '') => {
        const t = $('#toast');
        if (!t) return;
        t.textContent = msg;
        t.className = 'toast show ' + type;
        clearTimeout(t._tm);
        t._tm = setTimeout(() => t.classList.remove('show'), 2800);
    };

    const sanitizeUrl = (url = '') => {
        const trimmed = String(url).trim();
        if (!trimmed) return '#';
        try {
            const u = new URL(trimmed);
            if (!/^https?:$/.test(u.protocol)) return '#';
            return u.toString();
        } catch { return '#'; }
    };

    // -------- DATA (desde LocalStorage) --------
    function cargarDatos() {
        const DB = window.MF_DB;
        if (!DB) {
            toast('Error: db.js no cargado', 'error');
            return { categorias: [], subcategorias: [], productos: [] };
        }
        DB.seedIfEmpty();
        return {
            categorias: DB.getCategorias(),
            subcategorias: DB.getSubcategorias(),
            productos: DB.getProductos(),
        };
    }

    // -------- RENDER: CATEGORÍAS --------
    function renderCategorias() {
        const grid = $('#categoriesGrid');
        if (!grid) return;

        const cats = state.categorias;
        if (!cats.length) {
            grid.innerHTML =
                `<p style="grid-column: 1/-1; text-align:center; color: var(--ink-500)">
                    No hay categorías para mostrar.
                </p>`;
            return;
        }

        grid.innerHTML = cats.map(c => {
            const fallback =
                `https://placehold.co/400x400/FFE4EA/F25C86?text=${encodeURIComponent(c.categoria_nombre || '')}`;
            const img = c.imagen_url && c.imagen_url.trim() ? c.imagen_url : fallback;
            return `
                <a class="category-card" href="#buscador" data-slug="${escapeHtml(c.categoria_slug || '')}">
                    <div class="image-wrap">
                        <img loading="lazy"
                             src="${escapeHtml(img)}"
                             alt="${escapeHtml(c.categoria_nombre || '')}"
                             onerror="this.src='${fallback}'">
                    </div>
                    <div class="name">${escapeHtml(c.categoria_nombre || '')}</div>
                </a>
            `;
        }).join('');
    }

    // -------- RENDER: PRODUCTOS (GRID) --------
    function renderProductos() {
        const grid = $('#productsGrid');
        const empty = $('#noResults');
        if (!grid) return;

        const filtered = applyFilters(state.productos);

        if (!filtered.length) {
            grid.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }
        if (empty) empty.classList.add('hidden');

        grid.innerHTML = filtered.map(p => productCardHTML(p)).join('');
        bindBuyButtons();
    }

    function productCardHTML(p) {
        const fallback =
            `https://placehold.co/600x600/FFE4EA/F25C86?text=${encodeURIComponent(p.nombre || 'Producto')}`;
        const img = (p.imagen_url && p.imagen_url.trim()) || fallback;
        const tag = (p.carrusel_tipo || '').replace('_', ' ');

        return `
            <article class="product-card"
                     data-precio="${Number(p.precio) || 0}"
                     data-nombre="${escapeHtml((p.nombre || '').toLowerCase())}">
                <div class="image-wrap">
                    ${tag ? `<span class="badge-tag">${escapeHtml(tag)}</span>` : ''}
                    <img loading="lazy"
                         src="${escapeHtml(img)}"
                         alt="${escapeHtml(p.nombre || '')}"
                         onerror="this.src='${fallback}'">
                </div>
                <div class="info">
                    <div class="name">${escapeHtml(p.nombre || '')}</div>
                    <div class="price">${formatPrice(p.precio)}</div>
                    <div class="actions">
                        <a class="btn-buy"
                           href="${sanitizeUrl(p.link_amazon)}"
                           target="_blank" rel="noopener noreferrer sponsored">
                            Ver en Amazon →
                        </a>
                    </div>
                </div>
            </article>
        `;
    }

    function bindBuyButtons() { /* hook para tracking futuro */ }

    // -------- FILTROS --------
    function applyFilters(list) {
        const { search, min, max } = state.filters;
        const term = search.trim().toLowerCase();
        return list.filter(p => {
            const precio = Number(p.precio) || 0;
            if (precio < min || precio > max) return false;
            if (term && !(p.nombre || '').toLowerCase().includes(term)) return false;
            return true;
        });
    }

    function setRange(min, max) {
        state.filters.min = Number(min);
        state.filters.max = Number(max);

        $$('.filter-btn').forEach(b => {
            const bMin = Number(b.dataset.min);
            const bMax = Number(b.dataset.max);
            b.classList.toggle('active', bMin === Number(min) && bMax === Number(max));
        });

        renderProductos();
    }

    function bindFilters() {
        const search = $('#searchInput');
        if (search) {
            let tm;
            search.addEventListener('input', e => {
                clearTimeout(tm);
                tm = setTimeout(() => {
                    state.filters.search = e.target.value;
                    renderProductos();
                }, 200);
            });
        }

        $$('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const min = Number(btn.dataset.min);
                const max = Number(btn.dataset.max);
                setRange(min, max);
                const slider = $('#priceSlider');
                const v = Math.min(max, 500);
                if (slider && Number(slider.value) !== v) slider.value = v;
            });
        });

        const slider = $('#priceSlider');
        const sliderVal = $('#priceSliderValue');
        if (slider && sliderVal) {
            slider.addEventListener('input', e => {
                const v = Number(e.target.value);
                sliderVal.textContent = v >= 500 ? '$500+' : '$' + v;
                state.filters.max = v >= 500 ? 99999 : v;
                renderProductos();
                $$('.filter-btn').forEach(b => b.classList.remove('active'));
            });
        }

        const reset = $('#resetFilters');
        if (reset) {
            reset.addEventListener('click', () => {
                state.filters = { search: '', min: 0, max: 99999 };
                const s = $('#searchInput'); if (s) s.value = '';
                const sl = $('#priceSlider'); if (sl) sl.value = 500;
                const sv = $('#priceSliderValue'); if (sv) sv.textContent = '$500+';
                $$('.filter-btn').forEach(b => b.classList.remove('active'));
                $$('.filter-btn')[0]?.classList.add('active');
                renderProductos();
            });
        }
    }

    // -------- ACCIONES EXTRA --------
    function bindHeaderActions() {
        const toggle = $('#autoplayToggle');
        if (toggle) {
            toggle.classList.toggle('active', state.autoplay);
            toggle.addEventListener('click', () => {
                state.autoplay = !state.autoplay;
                toggle.classList.toggle('active', state.autoplay);
                if (window.MF_Carousel) MF_Carousel.setAutoplay(state.autoplay);
                toast(state.autoplay ? '▶ Auto-play activado' : '⏸ Auto-play pausado');
            });
        }

        const addBtn = $('#addProductBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                // Ir a la sección admin
                const admin = $('#adminSection');
                if (admin) {
                    admin.scrollIntoView({ behavior: 'smooth' });
                    if (window.MF_Admin) MF_Admin.switchTab('productos');
                }
            });
        }

        const y = $('#year');
        if (y) y.textContent = new Date().getFullYear();

        const navToggle = $('.nav-toggle');
        const nav = $('.nav');
        if (navToggle && nav) {
            navToggle.addEventListener('click', () => {
                const open = nav.style.display === 'flex';
                nav.style.display = open ? 'none' : 'flex';
                nav.style.flexDirection = open ? '' : 'column';
                nav.style.position = open ? '' : 'absolute';
                nav.style.top = open ? '' : '64px';
                nav.style.right = open ? '' : '4%';
                nav.style.background = open ? '' : 'white';
                nav.style.padding = open ? '' : '1rem';
                nav.style.borderRadius = open ? '' : 'var(--radius-md)';
                nav.style.boxShadow = open ? '' : 'var(--shadow-md)';
            });
        }
    }

    // -------- REFRESH PÚBLICO (llamado tras editar en admin) --------
    function refresh() {
        const data = cargarDatos();
        state.categorias = data.categorias;
        state.subcategorias = data.subcategorias;
        state.productos = data.productos;

        renderCategorias();
        renderProductos();

        if (window.MF_Carousel && typeof MF_Carousel.init === 'function') {
            MF_Carousel.init(state.productos);
            MF_Carousel.setAutoplay(state.autoplay);
        }
    }

    // -------- INIT --------
    function init() {
        bindFilters();
        bindHeaderActions();
        refresh();
        toast('Catálogo cargado · ' + state.productos.length + ' productos', 'success');
    }

    window.MF_State = state;
    window.MF_API = { refresh, renderProductos, renderCategorias };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
