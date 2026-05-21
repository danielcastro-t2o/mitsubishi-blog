/**
 * ============================================================
 * BLOG MITSUBISHI INTERLOMAS — blog.js
 * Vanilla JS · Sin dependencias externas · Mobile first
 *
 * Módulos:
 * 1. BlogSearch     — Búsqueda en tiempo real
 * 2. CategoryFilter — Filtrado por categoría
 * 3. EmptyState     — Estado sin resultados
 * 4. LoadMore       — Paginación / cargar más
 * 5. FAQAccordion   — Preguntas frecuentes
 * 6. TOCToggle      — Tabla de contenidos mobile
 * 7. TOCActiveLink  — Highlight de sección activa (sidebar)
 * 8. SmoothScroll   — Scroll suave para anclas
 * 9. CopyLink       — Copiar URL del artículo
 * 10. LazyImages    — Lazy loading con IntersectionObserver
 * 11. StickyTOC     — TOC sidebar sticky en scroll
 *
 * Integración .NET/Razor:
 * - Incluir como: @Scripts.Render("~/bundles/blog")
 * - O: <script src="~/js/blog.js" defer></script>
 *
 * El script detecta en qué página está (listado vs detalle)
 * mediante la clase del body (.blog-page, .article-page)
 * ============================================================
 */

(function () {
  'use strict';

  // ── UTILIDADES ─────────────────────────────────────────────
  /**
   * Selector seguro — devuelve null si no existe en el DOM
   * @param {string} selector
   * @param {HTMLElement} [context=document]
   * @returns {HTMLElement|null}
   */
  function qs(selector, context) {
    return (context || document).querySelector(selector);
  }

  /**
   * Selector múltiple
   * @param {string} selector
   * @param {HTMLElement} [context=document]
   * @returns {NodeList}
   */
  function qsa(selector, context) {
    return (context || document).querySelectorAll(selector);
  }

  /**
   * Normaliza texto para búsqueda: minúsculas, sin tildes, sin espacios extra
   * @param {string} str
   * @returns {string}
   */
  function normalizeText(str) {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quitar diacríticos
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Debounce — retrasa la ejecución para no disparar en cada tecla
   * @param {Function} fn
   * @param {number} delay
   * @returns {Function}
   */
  function debounce(fn, delay) {
    var timer;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, delay);
    };
  }

  // ── ESTADO GLOBAL DEL BLOG ─────────────────────────────────
  var state = {
    activeCategory: 'todos',
    searchQuery: '',
    visibleCount: 6,      // cards visibles inicialmente (3 cols × 2 filas)
    pageSize: 6           // cuántas cargar en cada "Cargar más"
  };

  // ============================================================
  // 1. BLOG SEARCH
  // ============================================================
  function initBlogSearch() {
    var form        = qs('#blogSearchForm');
    var input       = qs('#searchInput');
    var clearBtn    = qs('#searchClear');

    if (!form || !input) return;

    // Búsqueda en tiempo real con debounce
    input.addEventListener('input', debounce(function () {
      var query = input.value.trim();
      state.searchQuery = query;

      // Mostrar botón X solo cuando hay texto escrito
      if (clearBtn) {
        clearBtn.hidden = (query.length === 0);
      }

      applyFilters();
    }, 280));

    // Garantizar que el botón limpiar esté oculto al cargar
    if (clearBtn) { clearBtn.hidden = true; }

    // Limpiar búsqueda
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        state.searchQuery = '';
        clearBtn.hidden = true;
        input.focus();
        applyFilters();
      });
    }

    // Prevent submit para el caso de estar en la misma página
    // En .NET el form puede apuntar a una página de resultados separada
    // Aquí filtramos en cliente; en .NET con BD se haría el GET normal
    form.addEventListener('submit', function (e) {
      // Si hay artículos en el DOM, filtrar en cliente
      var grid = qs('#articleGrid');
      if (grid) {
        e.preventDefault();
        applyFilters();
      }
      // Si no, dejar que el form haga GET normal al servidor
    });
  }

  // ── HELPER: activar chip por valor ────────────────────────────
  function activateChip(value) {
    qsa('.category-chip').forEach(function (c) {
      var active = c.getAttribute('data-category') === value;
      c.classList.toggle('category-chip--active', active);
      c.setAttribute('aria-pressed', String(active));
    });
  }

  // ============================================================
  // 2. FILTRADO POR CATEGORÍA
  // ============================================================
  function initCategoryFilter() {
    var chips = qsa('.category-chip', qs('#categoryChips'));
    if (!chips.length) return;

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var category = chip.getAttribute('data-category');

        // Actualizar estado
        state.activeCategory = category;
        state.visibleCount = state.pageSize + 1; // resetear paginación

        activateChip(category);

        applyFilters();
      });
    });
  }

  // ============================================================
  // 3. APLICAR FILTROS (categoría + búsqueda)
  // ============================================================
  function applyFilters() {
    var grid     = qs('#articleGrid');
    var featured = qs('#featuredArticle');
    if (!grid) return;

    var cards    = qsa('.article-card', grid);
    var query    = normalizeText(state.searchQuery);
    var category = state.activeCategory;
    var count    = 0;

    // --- Artículo destacado: ocultar si hay búsqueda activa ---
    if (featured) {
      featured.style.display = (query || category !== 'todos') ? 'none' : '';
    }

    cards.forEach(function (card) {
      var cardCategory = card.getAttribute('data-category') || '';

      // Texto buscable: título + extracto + categoría
      var titleEl   = qs('.article-card__title a', card);
      var excerptEl = qs('.article-card__excerpt', card);
      var title     = normalizeText(titleEl ? titleEl.textContent : '');
      var excerpt   = normalizeText(excerptEl ? excerptEl.textContent : '');
      var catText   = normalizeText(cardCategory);

      // Criterio de categoría
      var matchesCategory = (category === 'todos') || (cardCategory === category);

      // Criterio de búsqueda
      var matchesQuery = !query
        || title.indexOf(query) !== -1
        || excerpt.indexOf(query) !== -1
        || catText.indexOf(query) !== -1;

      // Visibilidad con paginación (solo aplica cuando no hay búsqueda)
      var withinPage = query ? true : (count < state.visibleCount);

      var visible = matchesCategory && matchesQuery && withinPage;

      if (matchesCategory && matchesQuery) count++;

      card.style.display = visible ? '' : 'none';
    });

    // Actualizar contador
    updateCount(count);

    // Actualizar título de sección
    updateSectionTitle();

    // Mostrar/ocultar empty state
    toggleEmptyState(count === 0);

    // Mostrar/ocultar botón "Cargar más"
    updateLoadMore(count);
  }

  function updateCount(count) {
    var countEl = qs('#articlesCountNum');
    if (countEl) countEl.textContent = count;
  }

  function updateSectionTitle() {
    var titleEl = qs('#articlesTitle');
    if (!titleEl) return;

    var category = state.activeCategory;
    var query    = state.searchQuery;

    if (query) {
      titleEl.textContent = 'Resultados para "' + query + '"';
    } else if (category === 'todos') {
      titleEl.textContent = 'Últimos artículos';
    } else {
      // Capitalizar el slug: 'guias-de-compra' → 'Guías de compra'
      var names = {
        'guias-de-compra':  'Guías de compra',
        'mantenimiento':    'Mantenimiento',
        'tecnologia':       'Tecnología',
        'seguridad':        'Seguridad',
        'comparativas':     'Comparativas',
        'estilo-de-vida':   'Estilo de vida',
        'promociones':      'Promociones'
      };
      titleEl.textContent = names[category] || category;
    }
  }

  function updateLoadMore(count) {
    var loadMoreArea = qs('#paginationArea');
    if (!loadMoreArea) return;
    loadMoreArea.style.display = (!state.searchQuery && count > state.visibleCount) ? '' : 'none';
  }

  // ============================================================
  // 4. EMPTY STATE
  // ============================================================
  function toggleEmptyState(isEmpty) {
    var emptyState = qs('#emptyState');
    if (!emptyState) return;

    emptyState.hidden = !isEmpty;

    if (isEmpty) {
      var querySpan = qs('#emptyStateQuery');
      if (querySpan) {
        querySpan.textContent = state.searchQuery
          ? '"' + state.searchQuery + '"'
          : state.activeCategory;
      }
    }
  }

  function initClearFilters() {
    var clearBtn = qs('#clearFiltersBtn');
    if (!clearBtn) return;

    clearBtn.addEventListener('click', function () {
      // Resetear estado
      state.activeCategory = 'todos';
      state.searchQuery    = '';
      state.visibleCount   = 6;

      // Resetear input de búsqueda
      var input   = qs('#searchInput');
      var clearSearch = qs('#searchClear');
      if (input) input.value = '';
      if (clearSearch) clearSearch.hidden = true;

      activateChip('todos');

      applyFilters();
    });
  }

  // ============================================================
  // 5. CARGAR MÁS (paginación cliente)
  // ============================================================
  function initLoadMore() {
    var loadMoreBtn = qs('#loadMoreBtn');
    if (!loadMoreBtn) return;

    loadMoreBtn.addEventListener('click', function () {
      state.visibleCount += state.pageSize;
      applyFilters();

      // Anunciar para lectores de pantalla
      loadMoreBtn.setAttribute('aria-label', 'Cargando más artículos...');
      setTimeout(function () {
        loadMoreBtn.setAttribute('aria-label', 'Cargar más artículos');
      }, 1000);
    });
  }

  // ============================================================
  // 6. FAQ ACCORDION
  // ============================================================
  function initFAQ() {
    var faqItems = qsa('.faq-item');
    if (!faqItems.length) return;

    faqItems.forEach(function (item) {
      var btn    = qs('.faq-item__question', item);
      var answer = qs('.faq-item__answer', item);
      if (!btn || !answer) return;

      btn.addEventListener('click', function () {
        var isOpen = btn.getAttribute('aria-expanded') === 'true';

        // Cerrar todos los demás (comportamiento acordeón)
        // Opcional: comentar estas 6 líneas para permitir múltiples abiertos
        faqItems.forEach(function (otherItem) {
          var otherBtn    = qs('.faq-item__question', otherItem);
          var otherAnswer = qs('.faq-item__answer', otherItem);
          if (otherBtn && otherAnswer && otherBtn !== btn) {
            otherBtn.setAttribute('aria-expanded', 'false');
            otherAnswer.hidden = true;
          }
        });

        // Toggle el actual
        btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        answer.hidden = isOpen;
      });

      // Soporte de teclado
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
    });
  }

  // ============================================================
  // 7. TABLA DE CONTENIDOS — Toggle mobile
  // ============================================================
  function initTOCToggle() {
    var tocToggle = qs('#tocToggle');
    var tocList   = qs('#tocList');
    if (!tocToggle || !tocList) return;

    tocToggle.addEventListener('click', function () {
      var isOpen = tocToggle.getAttribute('aria-expanded') === 'true';
      tocToggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      tocList.classList.toggle('toc__list--visible', !isOpen);
    });
  }

  // ============================================================
  // 8. TOC SIDEBAR — Highlight de sección activa en scroll
  // ============================================================
  function initTOCActiveLinks() {
    var tocLinks = qsa('.toc-sidebar-link');
    if (!tocLinks.length) return;

    var headings = [];
    tocLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        var target = qs(href);
        if (target) headings.push({ el: target, link: link });
      }
    });

    if (!headings.length) return;

    // Punto de activación: justo debajo del header + margen cómodo
    // Debe estar por encima del scroll-margin-top (140px) para que el heading
    // correcto quede activo tras hacer clic en el TOC
    var TRIGGER = (window.innerWidth >= 1200 ? 90 : 60) + 60;
    var rafPending = false;

    function updateActive() {
      var atBottom = (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 10);
      var current  = null;

      if (atBottom) {
        // Al final de la página el último heading siempre queda activo
        current = headings[headings.length - 1];
      } else {
        headings.forEach(function (item) {
          if (item.el.getBoundingClientRect().top <= TRIGGER) {
            current = item;
          }
        });
      }

      tocLinks.forEach(function (link) { link.classList.remove('active'); });
      if (current) current.link.classList.add('active');
    }

    function onScroll() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () {
        rafPending = false;
        updateActive();
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    updateActive();
  }

  // ============================================================
  // 9. SMOOTH SCROLL para anclas del TOC
  // ============================================================
  function initSmoothScroll() {
    var anchorLinks = qsa('a[href^="#"]');
    var headerHeight = window.innerWidth >= 1200 ? 140 : 100;

    anchorLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href   = link.getAttribute('href');
        var target = qs(href);
        if (!target) return;

        e.preventDefault();

        var top = target.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });

        // Actualizar historial sin recargar
        if (history.pushState) {
          history.pushState(null, '', href);
        }
      });
    });
  }

  // ============================================================
  // 10. COPIAR ENLACE DEL ARTÍCULO
  // ============================================================
  function initCopyLink() {
    var copyBtn  = qs('#copyLinkBtn');
    var copyText = qs('#copyLinkText');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', function () {
      var url = copyBtn.getAttribute('data-url') || window.location.href;

      // Intentar API moderna del portapapeles
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          showCopied();
        }).catch(function () {
          fallbackCopy(url);
        });
      } else {
        fallbackCopy(url);
      }
    });

    function showCopied() {
      copyBtn.classList.add('copied');
      if (copyText) copyText.textContent = '¡Enlace copiado!';
      copyBtn.setAttribute('aria-label', 'Enlace copiado al portapapeles');

      setTimeout(function () {
        copyBtn.classList.remove('copied');
        if (copyText) copyText.textContent = 'Copiar enlace';
        copyBtn.setAttribute('aria-label', 'Copiar enlace del artículo');
      }, 2500);
    }

    function fallbackCopy(url) {
      // Fallback para navegadores sin Clipboard API
      var textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        showCopied();
      } catch (err) {
        console.warn('[Blog] No se pudo copiar el enlace:', err);
      }
      document.body.removeChild(textArea);
    }
  }

  // ============================================================
  // 11. LAZY LOADING DE IMÁGENES (polyfill para navegadores viejos)
  // ============================================================
  function initLazyImages() {
    // Navegadores modernos soportan loading="lazy" nativo.
    // Este polyfill es para IE/Edge heredado, solo si aplica.
    if ('loading' in HTMLImageElement.prototype) return; // soporte nativo

    var lazyImages = qsa('img[loading="lazy"]');
    if (!lazyImages.length) return;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            img.removeAttribute('loading');
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '0px 0px 200px 0px' // cargar 200px antes de entrar al viewport
      });

      lazyImages.forEach(function (img) {
        // Mover src a data-src para el polyfill
        if (img.src && !img.dataset.src) {
          img.dataset.src = img.src;
          img.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1 1\'%3E%3C/svg%3E';
        }
        observer.observe(img);
      });
    } else {
      // Fallback: cargar todas las imágenes de golpe
      lazyImages.forEach(function (img) {
        if (img.dataset.src) img.src = img.dataset.src;
      });
    }
  }

  // ============================================================
  // 12. CARRUSEL DE ARTÍCULOS RELACIONADOS (dots + scroll)
  // ============================================================
  function initRelatedCarousel() {
    var carousel = qs('#relatedCarousel');
    var dotsContainer = qs('#carouselDots');
    if (!carousel || !dotsContainer) return;

    // Solo activo en mobile/tablet (antes de que CSS lo convierta a grid)
    var cards = qsa('.related-card', carousel);
    if (!cards.length) return;

    // Crear dots
    cards.forEach(function (card, i) {
      var dot = document.createElement('button');
      dot.className = 'carousel-dot' + (i === 0 ? ' carousel-dot--active' : '');
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', 'Artículo ' + (i + 1));
      dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      dot.addEventListener('click', function () {
        carousel.scrollTo({ left: card.offsetLeft - parseInt(getComputedStyle(carousel).paddingLeft || 0), behavior: 'smooth' });
      });
      dotsContainer.appendChild(dot);
    });

    // Actualizar dot activo en scroll
    carousel.addEventListener('scroll', debounce(function () {
      var scrollLeft = carousel.scrollLeft;
      var dots = qsa('.carousel-dot', dotsContainer);
      var activeIndex = 0;
      var minDist = Infinity;

      cards.forEach(function (card, i) {
        var dist = Math.abs(card.offsetLeft - scrollLeft);
        if (dist < minDist) { minDist = dist; activeIndex = i; }
      });

      dots.forEach(function (dot, i) {
        dot.classList.toggle('carousel-dot--active', i === activeIndex);
        dot.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
      });
    }, 80), { passive: true });
  }


  function initReadingProgress() {
    // Solo en página de artículo
    if (!document.body.classList.contains('article-page')) return;

    // Crear barra de progreso
    var bar = document.createElement('div');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Progreso de lectura');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', '0');
    bar.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'height:3px',
      'width:0%',
      'background:var(--color-red)',
      'z-index:200',
      'transition:width 0.1s linear',
      'pointer-events:none'
    ].join(';');
    document.body.appendChild(bar);

    var articleBody = qs('.article-body');
    if (!articleBody) return;

    var articleTop = articleBody.offsetTop;
    var articleEnd = articleTop + articleBody.offsetHeight;

    function updateProgress() {
      var winTop   = window.scrollY;
      var progress = 0;

      if (winTop >= articleTop) {
        progress = Math.min(100, Math.max(0, ((winTop - articleTop) / (articleEnd - articleTop)) * 100));
      }

      bar.style.width = progress + '%';
      bar.setAttribute('aria-valuenow', Math.round(progress));
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }


  // ============================================================
  // 12. STICKY CATEGORY BAR — smart sticky (autohide)
  //     Se oculta al bajar y reaparece al subir la pantalla
  // ============================================================
  function initStickyCategories() {
    var catSection = qs('.category-section');
    if (!catSection) return;

    var lastY     = window.scrollY;
    var THRESHOLD = 6; // px mínimos para ignorar micro-vibraciones

    function checkStuck() {
      var headerH = window.innerWidth >= 1200 ? 90 : 60;
      var rect = catSection.getBoundingClientRect();
      catSection.classList.toggle('is-stuck', rect.top <= headerH + 1);
    }

    function onScroll() {
      var y     = window.scrollY;
      var delta = y - lastY;

      checkStuck(); // actualizar is-stuck antes de leerlo

      if (Math.abs(delta) > THRESHOLD) {
        if (delta > 0) {
          // Scroll down: ocultar solo si la barra ya está pegada al header
          if (catSection.classList.contains('is-stuck')) {
            catSection.classList.add('is-hidden');
          }
        } else {
          // Scroll up: siempre mostrar
          catSection.classList.remove('is-hidden');
        }
        lastY = y;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', checkStuck, { passive: true });
    checkStuck();
  }

  // ============================================================
  // 13. SIDEBAR TOC — collapse/expand en desktop
  // ============================================================
  function initSidebarTOCToggle() {
    var btn  = qs('#sidebarTocToggle');
    var list = qs('#sidebarTocList');
    if (!btn || !list) return;

    btn.addEventListener('click', function () {
      var isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      list.classList.toggle('toc-collapsed', isOpen);
    });
  }

  // ============================================================
  // 14. DETECCIÓN DE PÁGINA Y BOOTSTRAP
  // ============================================================
  function isBlogListPage() {
    return !!qs('#blogSearchForm') || !!qs('#articleGrid');
  }

  function isArticlePage() {
    return document.body.classList.contains('article-page');
  }

  function init() {
    // Módulos comunes
    initLazyImages();
    initSmoothScroll();

    // Módulos del listado /blog
    if (isBlogListPage()) {
      initBlogSearch();
      initCategoryFilter();
      initStickyCategories();
      initClearFilters();
      initLoadMore();
      // Inicializar estado del grid (respetando URL params si los hay)
      applyFiltersFromURL();
    }


    // Módulos del artículo /blog/categoria/slug
    if (isArticlePage()) {
      initFAQ();
      initTOCToggle();
      initTOCActiveLinks();
      initCopyLink();
      initReadingProgress();
      initRelatedCarousel();
      initSidebarTOCToggle();
    }

    // FAQ también puede aparecer en el listado (si aplica)
    if (!isArticlePage() && qs('.faq-list')) {
      initFAQ();
    }

    // Garantizar estado inicial correcto del grid en listado
    if (isBlogListPage() && !window.location.search) {
      applyFilters();
    }
  }

  // ============================================================
  // 14. LEER PARÁMETROS DE URL
  // Soporte para urls como /blog?q=mantenimiento&cat=mantenimiento
  // Útil para integración con .NET donde el servidor puede redirigir
  // ============================================================
  function applyFiltersFromURL() {
    if (!window.location) return;

    var params = new URLSearchParams(window.location.search);
    var q      = params.get('q')   || '';
    var cat    = params.get('cat') || 'todos';

    var input    = qs('#searchInput');
    var clearBtn = qs('#searchClear');

    if (q && input) {
      input.value      = q;
      state.searchQuery = q;
      if (clearBtn) clearBtn.hidden = false;
    }

    if (cat && cat !== 'todos') {
      state.activeCategory = cat;
      activateChip(cat);
    }

    if (q || cat !== 'todos') {
      applyFilters();
    }
  }

  // ── INICIALIZAR cuando el DOM esté listo ───────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init(); // DOMContentLoaded ya se disparó
  }

  // ── EXPONER API pública (para integración .NET si es necesario) ─
  // Permite llamar desde Razor o scripts externos:
  // window.MitsubishiBlog.filterByCategory('mantenimiento');
  window.MitsubishiBlog = {
    filterByCategory: function (category) {
      state.activeCategory = category;
      applyFilters();
    },
    search: function (query) {
      var input = qs('#searchInput');
      if (input) input.value = query;
      state.searchQuery = query;
      applyFilters();
    },
    reset: function () {
      state.activeCategory = 'todos';
      state.searchQuery    = '';
      state.visibleCount   = 6;
      var input = qs('#searchInput');
      if (input) input.value = '';
      applyFilters();
    }
  };

}()); // IIFE — no contamina el scope global
