(function () {
  "use strict";

  var brandData = window.AERON_DATA;
  var firebaseBridge = window.AERON_FIREBASE;

  if (!brandData) {
    console.error("AERON_DATA is missing. The storefront could not initialize.");
    return;
  }

  var STORAGE_KEYS = {
    cart: "aeron-cart",
    wishlist: "aeron-wishlist",
    selections: "aeron-selections"
  };

  var firstProduct = brandData.products[0];
  var state = {
    loading: true,
    activeCollection: "all",
    heroColorIndex: 0,
    activeProductId: firstProduct.id,
    activeGalleryIndex: 0,
    cartOpen: false,
    checkoutOpen: false,
    detailOpen: false,
    testimonialIndex: 0,
    wishlist: readStorage(STORAGE_KEYS.wishlist, []),
    cart: readStorage(STORAGE_KEYS.cart, []),
    selections: readStorage(STORAGE_KEYS.selections, {}),
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    firebaseContext: {
      enabled: false,
      reason: "Not initialized"
    }
  };

  var refs = {
    app: document.getElementById("app"),
    toastRegion: document.getElementById("toast-region"),
    cursorGlow: document.getElementById("cursor-glow")
  };

  var viewers = {
    hero: null,
    detail: null
  };

  var testimonialTimer = null;
  var firebaseSyncTimer = null;
  var particleState = null;

  function readStorage(key, fallback) {
    try {
      var value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Unable to persist state", error);
    }
  }

  function saveState() {
    writeStorage(STORAGE_KEYS.cart, state.cart);
    writeStorage(STORAGE_KEYS.wishlist, state.wishlist);
    writeStorage(STORAGE_KEYS.selections, state.selections);
    scheduleFirebaseSync();
  }

  function scheduleFirebaseSync() {
    if (!state.firebaseContext || !state.firebaseContext.enabled) {
      return;
    }

    window.clearTimeout(firebaseSyncTimer);
    firebaseSyncTimer = window.setTimeout(function () {
      firebaseBridge.syncDocument(state.firebaseContext, "storefrontStates", "demo-user", {
        cart: state.cart,
        wishlist: state.wishlist,
        selections: state.selections,
        updatedAt: new Date().toISOString()
      });
    }, 500);
  }

  function formatPrice(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value);
  }

  function productById(productId) {
    return brandData.products.find(function (product) {
      return product.id === productId;
    });
  }

  function productBySlug(slug) {
    return brandData.products.find(function (product) {
      return product.slug === slug;
    });
  }

  function getSelection(productId) {
    var product = productById(productId);
    var existing = state.selections[productId] || {};
    var defaultSize = product.sizes.includes(9) ? 9 : product.sizes[0];

    if (typeof existing.colorIndex !== "number") {
      existing.colorIndex = 0;
    }

    if (!existing.size || !product.sizes.includes(existing.size)) {
      existing.size = defaultSize;
    }

    state.selections[productId] = existing;
    return existing;
  }

  function getActivePalette(product) {
    var selection = getSelection(product.id);
    return product.colors[selection.colorIndex] || product.colors[0];
  }

  function isWishlisted(productId) {
    return state.wishlist.includes(productId);
  }

  function totalCartCount() {
    return state.cart.reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
  }

  function cartSubtotal() {
    return state.cart.reduce(function (sum, item) {
      var product = productById(item.productId);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
  }

  function filteredProducts() {
    if (state.activeCollection === "all") {
      return brandData.products;
    }

    return brandData.products.filter(function (product) {
      return product.collection === state.activeCollection;
    });
  }

  function productReviews(productId) {
    return brandData.reviewsByProductId[productId] || [];
  }

  function openProduct(productId) {
    var product = productById(productId);
    if (!product) {
      return;
    }

    state.activeProductId = product.id;
    state.activeGalleryIndex = 0;
    state.detailOpen = true;
    state.checkoutOpen = false;
    setRoute(product.slug);
    renderDetailSheet();
    renderCheckoutModal();
    toggleBodyLock();
    window.setTimeout(function () {
      initDetailViewer();
      initSwipeDismiss();
    }, 40);
  }

  function closeProduct() {
    state.detailOpen = false;
    state.activeGalleryIndex = 0;
    clearRoute();
    destroyViewer("detail");
    renderDetailSheet();
    toggleBodyLock();
  }

  function openCart() {
    state.cartOpen = true;
    renderCartSidebar();
    toggleBodyLock();
    initSwipeDismiss();
  }

  function closeCart() {
    state.cartOpen = false;
    renderCartSidebar();
    toggleBodyLock();
  }

  function openCheckout() {
    if (!state.cart.length) {
      showToast("Add a pair to your cart first.");
      return;
    }

    state.checkoutOpen = true;
    state.cartOpen = false;
    renderCartSidebar();
    renderCheckoutModal();
    toggleBodyLock();
  }

  function closeCheckout() {
    state.checkoutOpen = false;
    renderCheckoutModal();
    toggleBodyLock();
  }

  function toggleBodyLock() {
    var shouldLock = state.cartOpen || state.checkoutOpen || state.detailOpen;
    document.body.classList.toggle("lock-scroll", shouldLock);
  }

  function setRoute(slug) {
    var nextHash = "#/product/" + slug;
    if (window.location.hash !== nextHash) {
      history.pushState(null, "", nextHash);
    }
  }

  function clearRoute() {
    if (window.location.hash.indexOf("#/product/") === 0) {
      history.pushState(null, "", window.location.pathname + window.location.search);
    }
  }

  function syncStateFromRoute() {
    var hash = window.location.hash || "";
    if (hash.indexOf("#/product/") === 0) {
      var slug = hash.replace("#/product/", "");
      var product = productBySlug(slug);
      if (product) {
        state.activeProductId = product.id;
        state.detailOpen = true;
        renderDetailSheet();
        toggleBodyLock();
        window.setTimeout(initDetailViewer, 40);
        return;
      }
    }

    if (state.detailOpen) {
      state.detailOpen = false;
      renderDetailSheet();
      toggleBodyLock();
    }
  }

  function renderFrame() {
    refs.app.innerHTML = [
      '<div class="ambient-stage">',
      '  <canvas id="particle-canvas" class="particle-canvas" aria-hidden="true"></canvas>',
      '  <div class="ambient-orb ambient-orb--left"></div>',
      '  <div class="ambient-orb ambient-orb--right"></div>',
      '  <div class="noise-layer"></div>',
      "</div>",
      renderHeader(),
      '<main class="main-shell mx-auto max-w-[1320px] px-4 pb-24 pt-6 sm:px-6 lg:px-8">',
      renderHeroSection(),
      renderCollectionSpotlights(),
      renderCatalogSection(),
      renderStorySection(),
      renderArrivalSection(),
      renderTestimonialsSection(),
      renderNewsletterSection(),
      "</main>",
      renderFooter(),
      '<div id="detail-sheet-container"></div>',
      '<div id="cart-sidebar-container"></div>',
      '<div id="checkout-modal-container"></div>'
    ].join("");

    cacheDynamicRefs();
    renderCollections();
    renderProductGrid();
    renderArrivalRail();
    renderTestimonials();
    renderCartSidebar();
    renderCheckoutModal();
    renderDetailSheet();
  }

  function cacheDynamicRefs() {
    refs.headerCartCount = document.getElementById("header-cart-count");
    refs.headerWishCount = document.getElementById("header-wish-count");
    refs.collectionCards = document.getElementById("collection-cards");
    refs.collectionFilters = document.getElementById("collection-filters");
    refs.productGrid = document.getElementById("product-grid");
    refs.arrivalRail = document.getElementById("arrival-rail");
    refs.testimonialViewport = document.getElementById("testimonial-viewport");
    refs.testimonialDots = document.getElementById("testimonial-dots");
    refs.detailContainer = document.getElementById("detail-sheet-container");
    refs.cartContainer = document.getElementById("cart-sidebar-container");
    refs.checkoutContainer = document.getElementById("checkout-modal-container");
  }

  function renderHeader() {
    return [
      '<header class="site-header sticky top-0 z-40 mx-auto mt-4 flex w-[min(1320px,calc(100%-1.5rem))] items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-[rgba(6,10,24,0.78)] px-4 py-3 shadow-float backdrop-blur-2xl sm:px-6" data-animate>',
      '  <div class="flex items-center gap-3">',
      '    <div class="brand-mark">AR</div>',
      '    <div>',
      '      <p class="text-[11px] uppercase tracking-[0.4em] text-neon/70">Premium sneaker atelier</p>',
      '      <h1 class="font-display text-lg text-mist sm:text-xl">' + brandData.brand.name + "</h1>",
      "    </div>",
      "  </div>",
      '  <nav class="hidden items-center gap-6 text-sm text-slate-300 lg:flex">',
      '    <a href="#catalog" class="nav-link">Shop</a>',
      '    <a href="#story" class="nav-link">Story</a>',
      '    <a href="#testimonials" class="nav-link">Reviews</a>',
      '    <a href="#newsletter" class="nav-link">Newsletter</a>',
      "  </nav>",
      '  <div class="flex items-center gap-2 sm:gap-3">',
      '    <button class="icon-chip" type="button" data-action="focus-wishlist" aria-label="Wishlist">',
      '      <span class="icon-chip__glyph">&#9825;</span>',
      '      <span id="header-wish-count" class="icon-chip__count">' + state.wishlist.length + "</span>",
      "    </button>",
      '    <button id="header-cart-button" class="icon-chip icon-chip--strong" type="button" data-action="toggle-cart" aria-label="Cart">',
      '      <span class="icon-chip__glyph">Cart</span>',
      '      <span id="header-cart-count" class="icon-chip__count">' + totalCartCount() + "</span>",
      "    </button>",
      "  </div>",
      "</header>"
    ].join("");
  }

  function renderHeroSection() {
    var heroProduct = firstProduct;
    var heroPalette = heroProduct.colors[state.heroColorIndex] || heroProduct.colors[0];
    var metricCards = brandData.featuredMetrics.map(function (metric) {
      return [
        '<div class="metric-card rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">',
        '  <p class="text-xs uppercase tracking-[0.35em] text-slate-400">' + metric.label + "</p>",
        '  <strong class="mt-3 block text-2xl font-semibold text-mist">' + metric.value + "</strong>",
        "</div>"
      ].join("");
    }).join("");

    var heroSwatches = heroProduct.colors.map(function (palette, index) {
      var activeClass = index === state.heroColorIndex ? " is-active" : "";
      return [
        '<button class="swatch' + activeClass + '"',
        ' type="button"',
        ' data-action="select-hero-color"',
        ' data-color-index="' + index + '"',
        ' style="--swatch-primary:' + palette.primary + ";--swatch-accent:" + palette.accent + ';">',
        '  <span class="sr-only">' + palette.label + "</span>",
        "</button>"
      ].join("");
    }).join("");

    return [
      '<section id="hero" class="hero-grid grid gap-6 pb-16 pt-6 lg:grid-cols-[1.02fr_0.98fr] lg:pt-8">',
      '  <div class="hero-copy glass-panel relative overflow-hidden rounded-[36px] p-6 sm:p-8 lg:p-10" data-animate>',
      '    <div class="hero-copy__flare"></div>',
      '    <span class="eyebrow">AERON // drop 01</span>',
      '    <h2 class="mt-5 max-w-[12ch] font-display text-5xl leading-[0.92] text-mist sm:text-6xl xl:text-7xl">' + heroProduct.headline + "</h2>",
      '    <p class="mt-5 max-w-[58ch] text-base leading-7 text-slate-300 sm:text-lg">' + heroProduct.heroSummary + " " + heroProduct.story + "</p>",
      '    <div class="mt-8 flex flex-wrap gap-3">',
      '      <button class="premium-button" type="button" data-action="scroll-products">Shop The Drop</button>',
      '      <button class="ghost-button" type="button" data-action="open-detail" data-product-id="' + heroProduct.id + '">Explore ' + heroProduct.name + "</button>",
      "    </div>",
      '    <div class="mt-8 grid gap-3 md:grid-cols-3">' + metricCards + "</div>",
      '    <div class="hero-mini-story mt-8 flex flex-wrap items-center gap-4 rounded-[24px] border border-white/10 bg-black/20 px-4 py-4">',
      '      <div class="hero-mini-story__tag">Now tuning</div>',
      '      <p class="max-w-[42ch] text-sm leading-6 text-slate-300">' + heroPalette.label + " is live in the 3D studio. Drag to rotate, zoom, and feel the lighting react like a campaign set." + "</p>",
      "    </div>",
      "  </div>",
      '  <div class="hero-stage relative grid gap-4" data-depth="0.08">',
      '    <div class="glass-panel relative overflow-hidden rounded-[36px] p-4 sm:p-6" data-animate data-depth="0.16">',
      '      <div class="mb-4 flex items-center justify-between gap-4">',
      '        <div>',
      '          <p class="text-xs uppercase tracking-[0.38em] text-slate-400">3D studio preview</p>',
      '          <h3 class="mt-1 font-display text-2xl text-mist">' + heroProduct.name + "</h3>",
      "        </div>",
      '        <div class="text-right text-xs uppercase tracking-[0.3em] text-slate-400">',
      '          <span class="block">interactive</span>',
      '          <span class="block text-neon">' + heroPalette.label + "</span>",
      "        </div>",
      "      </div>",
      '      <div class="viewer-shell rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(124,255,189,0.12),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]">',
      '        <canvas id="hero-canvas" class="viewer-canvas" aria-label="3D sneaker viewer"></canvas>',
      "      </div>",
      '      <div class="mt-4 flex flex-wrap items-center justify-between gap-4">',
      '        <div class="swatch-row">' + heroSwatches + "</div>",
      '        <div class="text-xs uppercase tracking-[0.3em] text-slate-400">drag to rotate / pinch to zoom</div>',
      "      </div>",
      "    </div>",
      '    <div class="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">',
      '      <div class="floating-card glass-panel rounded-[30px] p-4" data-animate data-depth="0.22">',
      '        <div class="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.34em] text-slate-400">',
      '          <span>Campaign reel</span>',
      '          <span class="text-neon">live</span>',
      "        </div>",
      '        <div class="video-shell rounded-[24px] border border-white/8 bg-black/40 p-2">',
      '          <video class="hero-video" autoplay muted loop playsinline preload="auto" aria-label="Sneaker brand reel">',
      '            <source src="assets/hero-reel.mp4" type="video/mp4">',
      "          </video>",
      "        </div>",
      "      </div>",
      '      <div class="floating-card glass-panel flex flex-col justify-between rounded-[30px] p-4" data-animate data-depth="0.14">',
      '        <div>',
      '          <p class="text-xs uppercase tracking-[0.32em] text-slate-400">Studio notes</p>',
      '          <h3 class="mt-2 font-display text-2xl text-mist">Dynamic light. Zero clutter.</h3>',
      '          <p class="mt-3 text-sm leading-6 text-slate-300">We shaped the interface around floating panels, soft neon edges, and tactile commerce micro-interactions.</p>',
      "        </div>",
      '        <div class="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">',
      '          <span class="block text-xs uppercase tracking-[0.32em] text-slate-400">Fast checkout</span>',
      '          <strong class="mt-2 block text-xl text-mist">1-click fly-to-cart motion</strong>',
      "        </div>",
      "      </div>",
      "    </div>",
      "  </div>",
      "</section>"
    ].join("");
  }

  function renderCollectionSpotlights() {
    return [
      '<section class="mb-16" data-animate>',
      '  <div class="mb-6 flex flex-wrap items-end justify-between gap-4">',
      '    <div>',
      '      <p class="section-kicker">Featured collection</p>',
      '      <h2 class="section-title">A catalog shaped like a launch campaign</h2>',
      '      <p class="section-copy max-w-[54ch]">Each collection reads like a different moodboard, but the experience stays cohesive, tactile, and unmistakably premium.</p>',
      "    </div>",
      '    <button type="button" class="ghost-button" data-action="scroll-products">Browse collection</button>',
      "  </div>",
      '  <div id="collection-cards" class="grid gap-4 lg:grid-cols-3"></div>',
      "</section>"
    ].join("");
  }

  function renderCatalogSection() {
    return [
      '<section id="catalog" class="mb-16 scroll-mt-28">',
      '  <div class="mb-6 flex flex-wrap items-end justify-between gap-4">',
      '    <div>',
      '      <p class="section-kicker">Product section</p>',
      '      <h2 class="section-title">Curated silhouettes, motion-first cards</h2>',
      '      <p class="section-copy max-w-[56ch]">Hover to tilt, quick-preview, switch palettes, and drop your favorite pair into the cart with a premium fly animation.</p>',
      "    </div>",
      '    <div id="collection-filters" class="flex flex-wrap gap-2"></div>',
      "  </div>",
      '  <div id="product-grid" class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"></div>',
      "</section>"
    ].join("");
  }

  function renderStorySection() {
    var storyCards = brandData.stories.map(function (story) {
      return [
        '<article class="glass-panel rounded-[30px] p-6" data-animate>',
        '  <p class="section-kicker">' + story.title + "</p>",
        '  <p class="mt-4 text-base leading-7 text-slate-300">' + story.copy + "</p>",
        "</article>"
      ].join("");
    }).join("");

    return [
      '<section id="story" class="mb-16 scroll-mt-28">',
      '  <div class="mb-6 flex flex-wrap items-end justify-between gap-4">',
      '    <div>',
      '      <p class="section-kicker">Product storytelling</p>',
      '      <h2 class="section-title">Built like footwear design direction, not a template</h2>',
      '      <p class="section-copy max-w-[56ch]">The visual system combines glassmorphism depth with soft neumorphic shadows so the brand feels expensive without losing edge.</p>',
      "    </div>",
      '    <div class="story-chip">Cursor glow + particles + layered motion</div>',
      "  </div>",
      '  <div class="grid gap-4 lg:grid-cols-3">' + storyCards + "</div>",
      "</section>"
    ].join("");
  }

  function renderArrivalSection() {
    return [
      '<section class="mb-16" data-animate>',
      '  <div class="mb-6 flex flex-wrap items-end justify-between gap-4">',
      '    <div>',
      '      <p class="section-kicker">New arrivals</p>',
      '      <h2 class="section-title">Scrollable drop rail with quick-access commerce</h2>',
      '      <p class="section-copy max-w-[54ch]">A horizontal release strip keeps fresh launches visible and touch-friendly on mobile without breaking the immersive flow.</p>',
      "    </div>",
      '    <button class="ghost-button" type="button" data-action="set-collection" data-collection="new">See new arrivals</button>',
      "  </div>",
      '  <div id="arrival-rail" class="arrival-rail"></div>',
      "</section>"
    ].join("");
  }

  function renderTestimonialsSection() {
    return [
      '<section id="testimonials" class="mb-16 scroll-mt-28">',
      '  <div class="mb-6 flex flex-wrap items-end justify-between gap-4">',
      '    <div>',
      '      <p class="section-kicker">Testimonials</p>',
      '      <h2 class="section-title">What fashion-led buyers say after the drop</h2>',
      '      <p class="section-copy max-w-[54ch]">Animated feedback cards keep social proof alive instead of burying it under a static list.</p>',
      "    </div>",
      '    <div class="flex gap-2">',
      '      <button class="ghost-button ghost-button--icon" type="button" data-action="previous-testimonial" aria-label="Previous testimonial">&larr;</button>',
      '      <button class="ghost-button ghost-button--icon" type="button" data-action="next-testimonial" aria-label="Next testimonial">&rarr;</button>',
      "    </div>",
      "  </div>",
      '  <div class="glass-panel overflow-hidden rounded-[32px] p-4 sm:p-6">',
      '    <div id="testimonial-viewport" class="testimonial-viewport"></div>',
      '    <div id="testimonial-dots" class="mt-5 flex items-center gap-2"></div>',
      "  </div>",
      "</section>"
    ].join("");
  }

  function renderNewsletterSection() {
    return [
      '<section id="newsletter" class="scroll-mt-28" data-animate>',
      '  <div class="glass-panel relative overflow-hidden rounded-[36px] p-6 sm:p-8 lg:p-10">',
      '    <div class="newsletter-glow"></div>',
      '    <div class="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">',
      '      <div>',
      '        <p class="section-kicker">Newsletter signup</p>',
      '        <h2 class="section-title">Stay ahead of the next capsule drop</h2>',
      '        <p class="section-copy max-w-[54ch]">Get notified about limited colorways, behind-the-scenes material stories, and early access windows before a collection goes public.</p>',
      "      </div>",
      '      <form id="newsletter-form" class="newsletter-form">',
      '        <label class="sr-only" for="newsletter-email">Email address</label>',
      '        <input id="newsletter-email" class="lux-input" type="email" name="email" placeholder="Your email" required>',
      '        <button class="premium-button" type="submit">Join the list</button>',
      "      </form>",
      "    </div>",
      "  </div>",
      "</section>"
    ].join("");
  }

  function renderFooter() {
    var links = brandData.socialLinks.map(function (link) {
      return '<a class="footer-link" href="' + link.href + '" target="_blank" rel="noreferrer">' + link.label + "</a>";
    }).join("");

    return [
      '<footer class="mx-auto mt-16 w-[min(1320px,calc(100%-1.5rem))] rounded-[30px] border border-white/10 bg-[rgba(7,10,22,0.84)] px-4 py-8 text-sm text-slate-400 shadow-float backdrop-blur-2xl sm:px-6">',
      '  <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">',
      '    <div>',
      '      <p class="section-kicker">AERON Atelier</p>',
      '      <h2 class="mt-2 font-display text-2xl text-mist">Luxury streetwear, engineered through motion.</h2>',
      '      <p class="mt-3 max-w-[52ch] leading-7 text-slate-400">' + brandData.brand.strapline + "</p>",
      "    </div>",
      '    <div class="flex flex-wrap gap-4">' + links + "</div>",
      "  </div>",
      '  <div class="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">',
      '    <span>&copy; 2026 AERON Atelier. Built for premium launches.</span>',
      '    <span>Responsive storefront / 3D viewer / animated checkout</span>',
      "  </div>",
      "</footer>"
    ].join("");
  }

  function renderCollections() {
    var cards = brandData.collections.slice(1).map(function (collection) {
      var activeClass = collection.id === state.activeCollection ? " is-active" : "";
      return [
        '<button class="collection-card glass-panel' + activeClass + '" type="button" data-action="set-collection" data-collection="' + collection.id + '">',
        '  <span class="section-kicker">' + collection.eyebrow + "</span>",
        '  <h3 class="mt-3 font-display text-2xl text-mist">' + collection.label + "</h3>",
        '  <p class="mt-3 text-sm leading-7 text-slate-300">' + collection.description + "</p>",
        '  <span class="mt-5 inline-flex items-center gap-2 text-sm text-neon">Filter collection <span aria-hidden="true">&rarr;</span></span>',
        "</button>"
      ].join("");
    }).join("");

    refs.collectionCards.innerHTML = cards;

    refs.collectionFilters.innerHTML = brandData.collections.map(function (collection) {
      var activeClass = collection.id === state.activeCollection ? " filter-chip--active" : "";
      return '<button class="filter-chip' + activeClass + '" type="button" data-action="set-collection" data-collection="' + collection.id + '">' + collection.label + "</button>";
    }).join("");
  }

  function renderProductGrid() {
    updateHeaderCounts();

    if (state.loading) {
      refs.productGrid.innerHTML = new Array(6).fill(0).map(function () {
        return [
          '<article class="product-card skeleton-card">',
          '  <div class="skeleton skeleton-visual"></div>',
          '  <div class="mt-5 space-y-3">',
          '    <div class="skeleton skeleton-line skeleton-line--short"></div>',
          '    <div class="skeleton skeleton-line"></div>',
          '    <div class="skeleton skeleton-line skeleton-line--tiny"></div>',
          "  </div>",
          "</article>"
        ].join("");
      }).join("");
      return;
    }

    refs.productGrid.innerHTML = filteredProducts().map(function (product) {
      var palette = getActivePalette(product);
      var likedClass = isWishlisted(product.id) ? " is-active" : "";
      return [
        '<article class="product-card glass-panel" data-tilt style="--accent:' + palette.accent + ";--glow:" + palette.glow + ';">',
        '  <button class="wishlist-button' + likedClass + '" type="button" data-action="toggle-wishlist" data-product-id="' + product.id + '" aria-label="Toggle wishlist">',
        "    &#9829;",
        "  </button>",
        '  <div class="product-card__visual">',
        '    <div class="product-card__badge-row">' + product.badges.map(function (badge) {
          return '<span class="mini-badge">' + badge + "</span>";
        }).join("") + "</div>",
        '    <img src="' + palette.preview + '" alt="' + product.name + '" loading="lazy">',
        '    <button class="quick-preview-button" type="button" data-action="open-detail" data-product-id="' + product.id + '">Quick preview</button>',
        "  </div>",
        '  <div class="product-card__body">',
        '    <div class="flex items-start justify-between gap-4">',
        '      <div>',
        '        <p class="section-kicker">' + product.category + "</p>",
        '        <h3 class="mt-2 font-display text-2xl text-mist">' + product.name + "</h3>",
        "      </div>",
        '      <p class="text-right text-sm text-slate-400">' + product.rating + ' &#9733;<br><span class="text-xs">' + product.reviewCount + " reviews</span></p>",
        "    </div>",
        '    <p class="mt-3 text-sm leading-7 text-slate-300">' + product.description + "</p>",
        '    <div class="mt-4 flex items-center gap-2">' + product.colors.map(function (color, index) {
          var activeColorClass = index === getSelection(product.id).colorIndex ? " color-chip--active" : "";
          return '<button class="color-chip' + activeColorClass + '" type="button" data-action="select-product-color" data-product-id="' + product.id + '" data-color-index="' + index + '" style="--chip:' + color.accent + ';--chip-bg:' + color.primary + ';" aria-label="' + color.name + '"></button>';
        }).join("") + "</div>",
        '    <div class="mt-6 flex items-center justify-between gap-4">',
        '      <div>',
        '        <strong class="block text-2xl font-semibold text-mist">' + formatPrice(product.price) + "</strong>",
        '        <span class="text-sm text-slate-400">' + product.leadTime + "</span>",
        "      </div>",
        '      <button class="premium-button premium-button--sm" type="button" data-action="add-to-cart" data-product-id="' + product.id + '">Add to cart</button>',
        "    </div>",
        "  </div>",
        "</article>"
      ].join("");
    }).join("");

    initTiltCards();
  }

  function renderArrivalRail() {
    refs.arrivalRail.innerHTML = brandData.products.filter(function (product) {
      return product.collection === "new" || product.collection === "featured";
    }).map(function (product) {
      var palette = getActivePalette(product);
      return [
        '<article class="arrival-card glass-panel" style="--accent:' + palette.accent + ';">',
        '  <img src="' + palette.preview + '" alt="' + product.name + '" loading="lazy">',
        '  <div class="arrival-card__copy">',
        '    <p class="section-kicker">' + product.drop + "</p>",
        '    <h3 class="mt-2 font-display text-2xl text-mist">' + product.name + "</h3>",
        '    <p class="mt-2 text-sm leading-6 text-slate-300">' + product.description + "</p>",
        '    <div class="mt-4 flex items-center justify-between gap-4">',
        '      <strong class="text-xl text-mist">' + formatPrice(product.price) + "</strong>",
        '      <button class="ghost-button ghost-button--compact" type="button" data-action="open-detail" data-product-id="' + product.id + '">Preview</button>',
        "    </div>",
        "  </div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderTestimonials() {
    var cards = brandData.testimonials.map(function (testimonial) {
      return [
        '<article class="testimonial-card">',
        '  <p class="testimonial-quote">"' + testimonial.quote + '"</p>',
        '  <div class="mt-8 flex items-center justify-between gap-4">',
        '    <div>',
        '      <strong class="block text-lg text-mist">' + testimonial.name + "</strong>",
        '      <span class="text-sm text-slate-400">' + testimonial.role + " / " + testimonial.city + "</span>",
        "    </div>",
        '    <span class="testimonial-rating">5.0</span>',
        "  </div>",
        "</article>"
      ].join("");
    }).join("");

    refs.testimonialViewport.innerHTML = '<div class="testimonial-track" style="transform:translateX(-' + (state.testimonialIndex * 100) + '%)">' + cards + "</div>";
    refs.testimonialDots.innerHTML = brandData.testimonials.map(function (_, index) {
      var activeClass = index === state.testimonialIndex ? " testimonial-dot--active" : "";
      return '<button class="testimonial-dot' + activeClass + '" type="button" data-action="go-to-testimonial" data-index="' + index + '" aria-label="Go to testimonial ' + (index + 1) + '"></button>';
    }).join("");
  }

  function renderDetailSheet() {
    var product = productById(state.activeProductId);
    if (!product) {
      refs.detailContainer.innerHTML = "";
      return;
    }

    var palette = getActivePalette(product);
    var reviews = productReviews(product.id);
    var related = brandData.products.filter(function (item) {
      return item.id !== product.id && item.collection === product.collection;
    }).slice(0, 3);

    refs.detailContainer.innerHTML = [
      '<div class="overlay-shell' + (state.detailOpen ? " is-visible" : "") + '">',
      '  <button class="overlay-backdrop" type="button" data-action="close-detail" aria-label="Close product detail"></button>',
      '  <section class="detail-sheet">',
      '    <button class="detail-close" type="button" data-action="close-detail" aria-label="Close detail">&times;</button>',
      '    <div class="detail-layout">',
      '      <div class="detail-media">',
      '        <div class="glass-panel rounded-[28px] p-4">',
      '          <div class="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">',
      '            <span>Interactive 3D shoe viewer</span>',
      '            <span class="text-neon">' + palette.name + "</span>",
      "          </div>",
      '          <div class="detail-viewer-shell">',
      '            <canvas id="detail-canvas" class="viewer-canvas viewer-canvas--detail" aria-label="Detailed 3D sneaker viewer"></canvas>',
      "          </div>",
      "        </div>",
      '        <div class="glass-panel rounded-[28px] p-4">',
      '          <div class="detail-gallery-main">',
      '            <img src="' + palette.gallery[state.activeGalleryIndex] + '" alt="' + product.name + ' gallery view">',
      "          </div>",
      '          <div class="detail-gallery-thumbs">' + palette.gallery.map(function (image, index) {
        var activeClass = index === state.activeGalleryIndex ? " is-active" : "";
        return '<button class="detail-thumb' + activeClass + '" type="button" data-action="select-gallery" data-index="' + index + '"><img src="' + image + '" alt="' + product.name + " thumb " + (index + 1) + '"></button>';
      }).join("") + "</div>",
      "        </div>",
      "      </div>",
      '      <div class="detail-copy glass-panel rounded-[30px] p-6 sm:p-8">',
      '        <div class="flex flex-wrap gap-2">' + product.badges.map(function (badge) {
        return '<span class="mini-badge">' + badge + "</span>";
      }).join("") + "</div>",
      '        <p class="mt-4 section-kicker">' + product.category + "</p>",
      '        <h3 class="mt-2 font-display text-4xl text-mist sm:text-5xl">' + product.name + "</h3>",
      '        <div class="mt-5 flex items-end justify-between gap-4">',
      '          <strong class="text-3xl text-mist">' + formatPrice(product.price) + "</strong>",
      '          <span class="text-sm text-slate-400">' + product.rating + ' &#9733; / ' + product.reviewCount + " verified buyers</span>",
      "        </div>",
      '        <p class="mt-5 text-base leading-7 text-slate-300">' + product.story + "</p>",
      '        <div class="mt-6 space-y-5">',
      '          <div>',
      '            <p class="detail-label">Color story</p>',
      '            <div class="mt-3 flex flex-wrap gap-2">' + product.colors.map(function (color, index) {
        var activeClass = index === getSelection(product.id).colorIndex ? " detail-option--active" : "";
        return [
          '<button class="detail-option' + activeClass + '" type="button" data-action="select-product-color" data-product-id="' + product.id + '" data-color-index="' + index + '">',
          '  <span class="detail-option__dot" style="--chip:' + color.accent + ';--chip-bg:' + color.primary + ';"></span>',
          "  " + color.name,
          "</button>"
        ].join("");
      }).join("") + "</div>",
      "          </div>",
      '          <div>',
      '            <p class="detail-label">Select size</p>',
      '            <div class="mt-3 flex flex-wrap gap-2">' + product.sizes.map(function (size) {
        var activeClass = size === getSelection(product.id).size ? " detail-option--active" : "";
        return '<button class="detail-option detail-option--size' + activeClass + '" type="button" data-action="select-size" data-product-id="' + product.id + '" data-size="' + size + '">' + size + "</button>";
      }).join("") + "</div>",
      "          </div>",
      "        </div>",
      '        <div class="mt-8 flex flex-wrap gap-3">',
      '          <button class="premium-button" type="button" data-action="add-to-cart" data-product-id="' + product.id + '">Add to cart</button>',
      '          <button class="ghost-button" type="button" data-action="toggle-wishlist" data-product-id="' + product.id + '">' + (isWishlisted(product.id) ? "Saved to wishlist" : "Save for later") + "</button>",
      "        </div>",
      '        <div class="detail-meta-grid mt-8">',
      '          <div class="detail-meta-card"><span class="section-kicker">Lead time</span><strong>' + product.leadTime + "</strong></div>",
      '          <div class="detail-meta-card"><span class="section-kicker">Cushioning</span><strong>' + product.cushioning + "</strong></div>",
      '          <div class="detail-meta-card"><span class="section-kicker">Support</span><strong>' + product.supportNote + "</strong></div>",
      "        </div>",
      "      </div>",
      "    </div>",
      '    <div class="detail-secondary-grid">',
      '      <div class="glass-panel rounded-[28px] p-6">',
      '        <div class="mb-4 flex items-center justify-between gap-4">',
      '          <div>',
      '            <p class="section-kicker">Reviews</p>',
      '            <h4 class="font-display text-2xl text-mist">What buyers are saying</h4>',
      "          </div>",
      '          <span class="text-sm text-slate-400">' + reviews.length + " featured notes</span>",
      "        </div>",
      '        <div class="space-y-4">' + reviews.map(function (review) {
        return [
          '<article class="review-card">',
          '  <div class="flex items-center justify-between gap-4">',
          '    <strong class="text-mist">' + review.title + "</strong>",
          '    <span class="text-sm text-neon">' + review.rating + '.0 &#9733;</span>',
          "  </div>",
          '  <p class="mt-3 text-sm leading-7 text-slate-300">' + review.body + "</p>",
          '  <span class="mt-3 block text-xs uppercase tracking-[0.28em] text-slate-500">' + review.author + "</span>",
          "</article>"
        ].join("");
      }).join("") + "</div>",
      "      </div>",
      '      <div class="glass-panel rounded-[28px] p-6">',
      '        <div class="mb-4">',
      '          <p class="section-kicker">Related products</p>',
      '          <h4 class="font-display text-2xl text-mist">Complete the rotation</h4>',
      "        </div>",
      '        <div class="space-y-4">' + related.map(function (item) {
        var relatedPalette = getActivePalette(item);
        return [
          '<button class="related-card" type="button" data-action="open-detail" data-product-id="' + item.id + '">',
          '  <img src="' + relatedPalette.preview + '" alt="' + item.name + '">',
          '  <div class="related-card__copy">',
          '    <span class="section-kicker">' + item.category + "</span>",
          '    <strong class="mt-1 block text-lg text-mist">' + item.name + "</strong>",
          '    <span class="mt-2 block text-sm text-slate-400">' + formatPrice(item.price) + "</span>",
          "  </div>",
          "</button>"
        ].join("");
      }).join("") + "</div>",
      "      </div>",
      "    </div>",
      "  </section>",
      "</div>"
    ].join("");

    if (state.detailOpen) {
      initDetailViewer();
      initSwipeDismiss();
    }
  }

  function renderCartSidebar() {
    refs.cartContainer.innerHTML = [
      '<div class="overlay-shell overlay-shell--sidebar' + (state.cartOpen ? " is-visible" : "") + '">',
      '  <button class="overlay-backdrop" type="button" data-action="close-cart" aria-label="Close cart sidebar"></button>',
      '  <aside class="cart-sidebar">',
      '    <div class="mb-6 flex items-center justify-between gap-4">',
      '      <div>',
      '        <p class="section-kicker">Cart</p>',
      '        <h3 class="font-display text-3xl text-mist">Your rotation</h3>',
      "      </div>",
      '      <button class="detail-close" type="button" data-action="close-cart" aria-label="Close cart">&times;</button>',
      "    </div>",
      state.cart.length ? renderCartItems() : renderCartEmptyState(),
      "  </aside>",
      "</div>"
    ].join("");
  }

  function renderCartItems() {
    var items = state.cart.map(function (item) {
      var product = productById(item.productId);
      if (!product) {
        return "";
      }

      var palette = product.colors[item.colorIndex] || product.colors[0];
      return [
        '<article class="cart-line-item">',
        '  <img src="' + palette.preview + '" alt="' + product.name + '">',
        '  <div class="cart-line-item__copy">',
        '    <div class="flex items-start justify-between gap-3">',
        '      <div>',
        '        <strong class="block text-mist">' + product.name + "</strong>",
        '        <span class="text-xs uppercase tracking-[0.2em] text-slate-500">' + palette.name + " / size " + item.size + "</span>",
        "      </div>",
        '      <button class="icon-text-button" type="button" data-action="remove-from-cart" data-item-key="' + item.itemKey + '">Remove</button>',
        "    </div>",
        '    <div class="mt-4 flex items-center justify-between gap-3">',
        '      <strong class="text-lg text-mist">' + formatPrice(product.price * item.quantity) + "</strong>",
        '      <div class="quantity-stepper">',
        '        <button type="button" data-action="decrease-quantity" data-item-key="' + item.itemKey + '">-</button>',
        '        <span>' + item.quantity + "</span>",
        '        <button type="button" data-action="increase-quantity" data-item-key="' + item.itemKey + '">+</button>',
        "      </div>",
        "    </div>",
        "  </div>",
        "</article>"
      ].join("");
    }).join("");

    return [
      '<div class="cart-items">' + items + "</div>",
      '<div class="cart-summary">',
      '  <div class="cart-summary__row"><span>Subtotal</span><strong>' + formatPrice(cartSubtotal()) + "</strong></div>",
      '  <div class="cart-summary__row"><span>Delivery</span><strong>Free</strong></div>',
      '  <div class="cart-summary__row cart-summary__row--total"><span>Total</span><strong>' + formatPrice(cartSubtotal()) + "</strong></div>",
      '  <button class="premium-button w-full" type="button" data-action="begin-checkout">Checkout</button>',
      '  <button class="ghost-button mt-3 w-full" type="button" data-action="close-cart">Continue shopping</button>',
      "</div>"
    ].join("");
  }

  function renderCartEmptyState() {
    return [
      '<div class="empty-panel">',
      '  <div class="empty-panel__orb"></div>',
      '  <h4 class="font-display text-3xl text-mist">No pairs selected yet</h4>',
      '  <p class="mt-3 text-sm leading-7 text-slate-300">Build a rotation from the collection below. Every add-to-cart action uses a cinematic fly-to-cart motion so the shopping flow feels alive.</p>',
      '  <button class="premium-button mt-6" type="button" data-action="close-cart">Explore products</button>',
      "</div>"
    ].join("");
  }

  function renderCheckoutModal() {
    refs.checkoutContainer.innerHTML = [
      '<div class="overlay-shell overlay-shell--checkout' + (state.checkoutOpen ? " is-visible" : "") + '">',
      '  <button class="overlay-backdrop" type="button" data-action="close-checkout" aria-label="Close checkout"></button>',
      '  <section class="checkout-modal">',
      '    <div class="mb-6 flex items-center justify-between gap-4">',
      '      <div>',
      '        <p class="section-kicker">Checkout</p>',
      '        <h3 class="font-display text-3xl text-mist">Minimal finish, premium flow</h3>',
      "      </div>",
      '      <button class="detail-close" type="button" data-action="close-checkout" aria-label="Close checkout">&times;</button>',
      "    </div>",
      '    <div class="checkout-layout">',
      '      <form id="checkout-form" class="glass-subpanel">',
      '        <div class="grid gap-4 sm:grid-cols-2">',
      '          <label class="field"><span>Email</span><input class="lux-input" name="email" type="email" placeholder="alex@aeron.com" required></label>',
      '          <label class="field"><span>Full name</span><input class="lux-input" name="name" type="text" placeholder="Alex Mercer" required></label>',
      '          <label class="field field--full"><span>Shipping address</span><input class="lux-input" name="address" type="text" placeholder="15 Mercer Street, Soho" required></label>',
      '          <label class="field"><span>City</span><input class="lux-input" name="city" type="text" placeholder="New York" required></label>',
      '          <label class="field"><span>Postal code</span><input class="lux-input" name="postalCode" type="text" placeholder="10013" required></label>',
      '          <label class="field"><span>Payment</span><select class="lux-input" name="paymentMethod"><option>Card ending in 2048</option><option>Apple Pay</option><option>UPI / Wallet</option></select></label>',
      "        </div>",
      '        <button class="premium-button mt-6" type="submit">Confirm order</button>',
      "      </form>",
      '      <aside class="glass-subpanel">',
      '        <p class="section-kicker">Order summary</p>',
      '        <div class="mt-4 space-y-4">' + state.cart.map(function (item) {
        var product = productById(item.productId);
        var palette = product ? product.colors[item.colorIndex] || product.colors[0] : null;
        if (!product || !palette) {
          return "";
        }

        return [
          '<div class="summary-line">',
          '  <img src="' + palette.preview + '" alt="' + product.name + '">',
          '  <div class="summary-line__copy">',
          '    <strong class="block text-mist">' + product.name + "</strong>",
          '    <span class="text-xs uppercase tracking-[0.2em] text-slate-500">' + palette.name + " / size " + item.size + " / qty " + item.quantity + "</span>",
          '    <span class="mt-2 block text-sm text-slate-300">' + formatPrice(product.price * item.quantity) + "</span>",
          "  </div>",
          "</div>"
        ].join("");
      }).join("") + "</div>",
      '        <div class="cart-summary mt-6">',
      '          <div class="cart-summary__row cart-summary__row--total"><span>Total today</span><strong>' + formatPrice(cartSubtotal()) + "</strong></div>",
      '          <p class="mt-3 text-sm leading-6 text-slate-400">This demo checkout is frontend-complete and ready to connect to your preferred payment layer.</p>',
      "        </div>",
      "      </aside>",
      "    </div>",
      "  </section>",
      "</div>"
    ].join("");
  }

  function updateHeaderCounts() {
    if (refs.headerCartCount) {
      refs.headerCartCount.textContent = String(totalCartCount());
    }

    if (refs.headerWishCount) {
      refs.headerWishCount.textContent = String(state.wishlist.length);
    }
  }

  function addToCart(productId, sourceElement) {
    var product = productById(productId);
    if (!product) {
      return;
    }

    var selection = getSelection(productId);
    var itemKey = [productId, selection.colorIndex, selection.size].join("-");
    var existing = state.cart.find(function (item) {
      return item.itemKey === itemKey;
    });

    if (existing) {
      existing.quantity += 1;
    } else {
      state.cart.push({
        itemKey: itemKey,
        productId: productId,
        colorIndex: selection.colorIndex,
        size: selection.size,
        quantity: 1
      });
    }

    saveState();
    renderCartSidebar();
    renderCheckoutModal();
    updateHeaderCounts();
    animateFlyToCart(sourceElement);
    showToast(product.name + " added to cart.");
  }

  function removeFromCart(itemKey) {
    state.cart = state.cart.filter(function (item) {
      return item.itemKey !== itemKey;
    });
    saveState();
    renderCartSidebar();
    renderCheckoutModal();
    updateHeaderCounts();
  }

  function adjustQuantity(itemKey, direction) {
    var item = state.cart.find(function (entry) {
      return entry.itemKey === itemKey;
    });
    if (!item) {
      return;
    }

    item.quantity += direction;
    if (item.quantity <= 0) {
      removeFromCart(itemKey);
      return;
    }

    saveState();
    renderCartSidebar();
    renderCheckoutModal();
    updateHeaderCounts();
  }

  function toggleWishlist(productId) {
    if (isWishlisted(productId)) {
      state.wishlist = state.wishlist.filter(function (id) {
        return id !== productId;
      });
      showToast("Removed from wishlist.");
    } else {
      state.wishlist.push(productId);
      showToast("Saved to wishlist.");
    }

    saveState();
    renderProductGrid();
    renderDetailSheet();
    updateHeaderCounts();
  }

  function selectProductColor(productId, colorIndex) {
    var product = productById(productId);
    if (!product || !product.colors[colorIndex]) {
      return;
    }

    getSelection(productId).colorIndex = colorIndex;

    if (productId === firstProduct.id) {
      state.heroColorIndex = colorIndex;
      renderHeroSwatchesOnly();
      updateViewerPalette("hero", product.colors[colorIndex]);
    }

    if (state.activeProductId === productId) {
      state.activeGalleryIndex = 0;
      renderDetailSheet();
    }

    saveState();
    renderProductGrid();
    renderArrivalRail();
  }

  function renderHeroSwatchesOnly() {
    var heroRoot = document.getElementById("hero");
    if (!heroRoot) {
      return;
    }

    var freshHeroMarkup = document.createElement("div");
    freshHeroMarkup.innerHTML = renderHeroSection();
    heroRoot.replaceWith(freshHeroMarkup.firstElementChild);
    window.setTimeout(function () {
      initHeroViewer();
      initParallax();
      initScrollAnimations();
    }, 40);
  }

  function selectSize(productId, size) {
    var product = productById(productId);
    if (!product || !product.sizes.includes(size)) {
      return;
    }

    getSelection(productId).size = size;
    saveState();
    renderDetailSheet();
    renderProductGrid();
  }

  function cycleTestimonial(direction) {
    var total = brandData.testimonials.length;
    state.testimonialIndex = (state.testimonialIndex + direction + total) % total;
    renderTestimonials();
  }

  function animateFlyToCart(sourceElement) {
    var cartButton = document.getElementById("header-cart-button");
    if (!sourceElement || !cartButton || !window.gsap) {
      return;
    }

    var originImage = sourceElement.closest(".product-card") ?
      sourceElement.closest(".product-card").querySelector("img") :
      sourceElement.closest(".detail-sheet") ?
        sourceElement.closest(".detail-sheet").querySelector(".detail-gallery-main img") :
        sourceElement;

    if (!originImage) {
      return;
    }

    var startRect = originImage.getBoundingClientRect();
    var endRect = cartButton.getBoundingClientRect();
    var flyer = originImage.cloneNode(true);
    flyer.className = "cart-flyer";
    flyer.style.left = startRect.left + "px";
    flyer.style.top = startRect.top + "px";
    flyer.style.width = startRect.width + "px";
    flyer.style.height = startRect.height + "px";
    document.body.appendChild(flyer);

    window.gsap.to(flyer, {
      duration: state.reducedMotion ? 0.3 : 0.85,
      x: endRect.left - startRect.left + endRect.width * 0.2,
      y: endRect.top - startRect.top - startRect.height * 0.25,
      scale: 0.16,
      opacity: 0.28,
      rotate: 18,
      ease: "power3.inOut",
      onComplete: function () {
        flyer.remove();
        cartButton.classList.add("is-pulsing");
        window.setTimeout(function () {
          cartButton.classList.remove("is-pulsing");
        }, 420);
      }
    });
  }

  function showToast(message) {
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    refs.toastRegion.appendChild(toast);

    window.setTimeout(function () {
      toast.classList.add("is-exiting");
    }, 1600);

    window.setTimeout(function () {
      toast.remove();
    }, 2200);
  }

  function createRipple(target, event) {
    if (!target.classList.contains("premium-button") && !target.classList.contains("ghost-button") && !target.classList.contains("filter-chip")) {
      return;
    }

    var ripple = document.createElement("span");
    var rect = target.getBoundingClientRect();
    ripple.className = "ripple";
    ripple.style.left = (event.clientX - rect.left) + "px";
    ripple.style.top = (event.clientY - rect.top) + "px";
    target.appendChild(ripple);
    window.setTimeout(function () {
      ripple.remove();
    }, 620);
  }

  function renderAfterLoad() {
    state.loading = false;
    renderProductGrid();
    renderArrivalRail();
    showToast("Collection loaded. Explore the 3D studio.");
  }

  function initHeroViewer() {
    waitForThree(function () {
      var heroProduct = firstProduct;
      var palette = heroProduct.colors[state.heroColorIndex] || heroProduct.colors[0];
      viewers.hero = createSneakerViewer("hero-canvas", palette, true);
    });
  }

  function initDetailViewer() {
    if (!state.detailOpen) {
      return;
    }

    waitForThree(function () {
      var product = productById(state.activeProductId);
      if (!product) {
        return;
      }

      var palette = getActivePalette(product);
      viewers.detail = createSneakerViewer("detail-canvas", palette, false);
    });
  }

  function waitForThree(callback) {
    if (window.THREE && window.THREE.OrbitControls) {
      callback();
      return;
    }

    window.setTimeout(function () {
      waitForThree(callback);
    }, 80);
  }

  function destroyViewer(viewerKey) {
    var viewer = viewers[viewerKey];
    if (!viewer) {
      return;
    }

    viewer.stopped = true;
    window.cancelAnimationFrame(viewer.frameId);
    viewer.resizeCleanup();
    viewer.renderer.dispose();
    viewers[viewerKey] = null;
  }

  function updateViewerPalette(viewerKey, palette) {
    var viewer = viewers[viewerKey];
    if (!viewer) {
      return;
    }

    viewer.materials.upper.color.set(palette.primary);
    viewer.materials.upper.emissive.set(palette.glow);
    viewer.materials.upper.emissiveIntensity = 0.05;
    viewer.materials.accent.color.set(palette.accent);
    viewer.materials.accent.emissive.set(palette.glow);
    viewer.materials.accent.emissiveIntensity = 0.25;
    viewer.materials.sole.color.set(palette.outsole);
    viewer.materials.trim.color.set(palette.secondary);
    viewer.glowLight.color.set(palette.glow);
  }

  function createSneakerViewer(canvasId, palette, autoRotate) {
    destroyViewer(canvasId === "hero-canvas" ? "hero" : "detail");

    var canvas = document.getElementById(canvasId);
    if (!canvas) {
      return null;
    }

    var THREE = window.THREE;
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(width, height, false);
    renderer.outputEncoding = THREE.sRGBEncoding;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(36, width / Math.max(height, 1), 0.1, 100);
    camera.position.set(0.5, 1.8, 7.2);

    var controls = new THREE.OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 5.8;
    controls.maxDistance = 8.8;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.minPolarAngle = Math.PI * 0.32;

    var ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);

    var keyLight = new THREE.SpotLight(palette.glow, 1.2, 30, Math.PI / 5, 0.25, 1.6);
    keyLight.position.set(5, 9, 6);
    scene.add(keyLight);

    var rimLight = new THREE.PointLight(palette.accent, 1.35, 20);
    rimLight.position.set(-6, 4, -3);
    scene.add(rimLight);

    var fillLight = new THREE.PointLight(0xffffff, 0.45, 16);
    fillLight.position.set(0, -2, 6);
    scene.add(fillLight);

    var floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 64),
      new THREE.MeshBasicMaterial({
        color: palette.glow,
        transparent: true,
        opacity: 0.12
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.6;
    scene.add(floor);

    var sneaker = buildSneakerModel(THREE, palette);
    scene.add(sneaker.group);

    var clock = new THREE.Clock();
    var viewer = null;

    function onResize() {
      var nextWidth = canvas.clientWidth;
      var nextHeight = canvas.clientHeight;
      renderer.setSize(nextWidth, nextHeight, false);
      camera.aspect = nextWidth / Math.max(nextHeight, 1);
      camera.updateProjectionMatrix();
    }

    window.addEventListener("resize", onResize);

    function animate() {
      if (!viewer || viewer.stopped) {
        return;
      }

      var elapsed = clock.getElapsedTime();
      sneaker.group.position.y = Math.sin(elapsed * 1.6) * 0.08;
      sneaker.group.rotation.z = Math.sin(elapsed * 0.9) * 0.06;
      floor.material.opacity = 0.1 + Math.sin(elapsed * 2) * 0.02;

      if (autoRotate) {
        sneaker.group.rotation.y += 0.007;
      }

      keyLight.position.x = 5 + Math.sin(elapsed) * 1.2;
      rimLight.position.z = -3 + Math.cos(elapsed * 0.8) * 1.1;

      controls.update();
      renderer.render(scene, camera);
      viewer.frameId = window.requestAnimationFrame(animate);
    }

    viewer = {
      renderer: renderer,
      scene: scene,
      camera: camera,
      controls: controls,
      frameId: null,
      materials: sneaker.materials,
      glowLight: keyLight,
      stopped: false,
      resizeCleanup: function () {
        window.removeEventListener("resize", onResize);
      }
    };

    viewer.frameId = window.requestAnimationFrame(animate);
    return viewer;
  }

  function buildSneakerModel(THREE, palette) {
    var upperMaterial = new THREE.MeshPhysicalMaterial({
      color: palette.primary,
      roughness: 0.38,
      metalness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      emissive: new THREE.Color(palette.glow),
      emissiveIntensity: 0.05
    });

    var trimMaterial = new THREE.MeshPhysicalMaterial({
      color: palette.secondary,
      roughness: 0.3,
      metalness: 0.16
    });

    var accentMaterial = new THREE.MeshPhysicalMaterial({
      color: palette.accent,
      roughness: 0.25,
      metalness: 0.2,
      emissive: new THREE.Color(palette.glow),
      emissiveIntensity: 0.25
    });

    var soleMaterial = new THREE.MeshPhysicalMaterial({
      color: palette.outsole,
      roughness: 0.55,
      metalness: 0.03
    });

    var group = new THREE.Group();

    var base = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.38, 1.7), soleMaterial);
    base.position.y = -1.1;
    base.scale.z = 0.98;
    group.add(base);

    var toe = new THREE.Mesh(new THREE.SphereGeometry(0.88, 32, 32), upperMaterial);
    toe.scale.set(1.3, 0.7, 0.95);
    toe.position.set(1.62, -0.4, 0);
    group.add(toe);

    var mid = new THREE.Mesh(new THREE.BoxGeometry(2.75, 1.08, 1.2), upperMaterial);
    mid.position.set(0.05, -0.12, 0);
    group.add(mid);

    var heel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.22, 1.12), trimMaterial);
    heel.position.set(-1.55, -0.05, 0);
    group.add(heel);

    var collar = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.16, 20, 48, Math.PI * 1.2), trimMaterial);
    collar.position.set(-0.8, 0.42, 0);
    collar.rotation.set(Math.PI / 2, 0.28, -0.08);
    group.add(collar);

    var tongue = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.38), trimMaterial);
    tongue.position.set(-0.08, 0.42, 0.03);
    tongue.rotation.x = -0.36;
    group.add(tongue);

    var stripeOne = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.12), accentMaterial);
    stripeOne.position.set(0.22, 0.08, 0.64);
    stripeOne.rotation.z = 0.22;
    group.add(stripeOne);

    var stripeTwo = stripeOne.clone();
    stripeTwo.position.y = -0.18;
    stripeTwo.scale.x = 1.14;
    group.add(stripeTwo);

    var heelClip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.92, 1.18), accentMaterial);
    heelClip.position.set(-2.02, -0.1, 0);
    group.add(heelClip);

    var airWindow = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.2, 0.92), accentMaterial);
    airWindow.position.set(-0.35, -0.85, 0);
    group.add(airWindow);

    for (var i = 0; i < 5; i += 1) {
      var lace = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.82, 12), trimMaterial);
      lace.rotation.z = Math.PI / 2 + 0.08;
      lace.position.set(-0.35 + i * 0.33, 0.16 - i * 0.055, 0.62);
      group.add(lace);
    }

    var toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 20), accentMaterial);
    toeCap.scale.set(1.7, 0.45, 0.9);
    toeCap.position.set(2.05, -0.73, 0);
    group.add(toeCap);

    group.rotation.x = -0.18;
    group.rotation.y = -0.85;

    return {
      group: group,
      materials: {
        upper: upperMaterial,
        trim: trimMaterial,
        accent: accentMaterial,
        sole: soleMaterial
      }
    };
  }

  function initTiltCards() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-tilt]"), function (card) {
      if (card.dataset.tiltReady === "true") {
        return;
      }

      card.dataset.tiltReady = "true";

      card.addEventListener("pointermove", function (event) {
        if (window.innerWidth < 768) {
          return;
        }

        var rect = card.getBoundingClientRect();
        var percentX = (event.clientX - rect.left) / rect.width;
        var percentY = (event.clientY - rect.top) / rect.height;
        var rotateY = (percentX - 0.5) * 12;
        var rotateX = (0.5 - percentY) * 10;
        card.style.transform = "perspective(1100px) rotateX(" + rotateX + "deg) rotateY(" + rotateY + "deg) translateY(-6px)";
      });

      card.addEventListener("pointerleave", function () {
        card.style.transform = "";
      });
    });
  }

  function initScrollAnimations() {
    if (!window.gsap || !window.ScrollTrigger) {
      return;
    }

    window.ScrollTrigger.getAll().forEach(function (trigger) {
      trigger.kill();
    });

    window.gsap.utils.toArray("[data-animate]").forEach(function (element) {
      window.gsap.fromTo(element, {
        opacity: 0,
        y: 34,
        filter: "blur(20px)"
      }, {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: state.reducedMotion ? 0.2 : 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: element,
          start: "top 84%"
        }
      });
    });
  }

  function initParallax() {
    var elements = Array.prototype.slice.call(document.querySelectorAll("[data-depth]"));
    if (!elements.length) {
      return;
    }

    function update() {
      var scrollY = window.scrollY || window.pageYOffset;
      elements.forEach(function (element) {
        var depth = Number(element.dataset.depth || 0);
        element.style.setProperty("--parallax-y", String(scrollY * depth * -0.08) + "px");
      });
    }

    window.removeEventListener("scroll", update);
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  function initCursorGlow() {
    if (!refs.cursorGlow) {
      return;
    }

    window.addEventListener("pointermove", function (event) {
      refs.cursorGlow.style.opacity = "1";
      refs.cursorGlow.style.transform = "translate3d(" + (event.clientX - 120) + "px," + (event.clientY - 120) + "px,0)";
    });

    window.addEventListener("pointerdown", function () {
      refs.cursorGlow.classList.add("cursor-glow--active");
      window.setTimeout(function () {
        refs.cursorGlow.classList.remove("cursor-glow--active");
      }, 220);
    });
  }

  function initParticles() {
    var canvas = document.getElementById("particle-canvas");
    if (!canvas) {
      return;
    }

    var context = canvas.getContext("2d");
    particleState = {
      particles: []
    };

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particleState.particles = new Array(34).fill(0).map(function () {
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.8 + 0.6,
          velocityX: (Math.random() - 0.5) * 0.18,
          velocityY: (Math.random() - 0.5) * 0.18
        };
      });
    }

    function draw() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      particleState.particles.forEach(function (particle) {
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;

        if (particle.x < -20) {
          particle.x = canvas.width + 20;
        }
        if (particle.x > canvas.width + 20) {
          particle.x = -20;
        }
        if (particle.y < -20) {
          particle.y = canvas.height + 20;
        }
        if (particle.y > canvas.height + 20) {
          particle.y = -20;
        }

        context.beginPath();
        context.fillStyle = "rgba(124, 255, 189, 0.35)";
        context.shadowBlur = 16;
        context.shadowColor = "rgba(124,255,189,0.2)";
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      });
      window.requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
  }

  function initSwipeDismiss() {
    Array.prototype.forEach.call(document.querySelectorAll(".cart-sidebar, .detail-sheet"), function (panel) {
      if (panel.dataset.swipeReady === "true") {
        return;
      }

      panel.dataset.swipeReady = "true";
      var startX = 0;
      var startY = 0;

      panel.addEventListener("touchstart", function (event) {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      }, { passive: true });

      panel.addEventListener("touchend", function (event) {
        var touch = event.changedTouches[0];
        var deltaX = touch.clientX - startX;
        var deltaY = touch.clientY - startY;

        if (panel.classList.contains("cart-sidebar") && deltaX > 90) {
          closeCart();
        }

        if (panel.classList.contains("detail-sheet") && deltaY > 90) {
          closeProduct();
        }
      }, { passive: true });
    });
  }

  function initTestimonialAutoplay() {
    window.clearInterval(testimonialTimer);
    testimonialTimer = window.setInterval(function () {
      cycleTestimonial(1);
    }, 5200);
  }

  function handleClick(event) {
    var trigger = event.target.closest("[data-action]");
    if (event.target.closest("button")) {
      createRipple(event.target.closest("button"), event);
    }

    if (!trigger) {
      return;
    }

    var action = trigger.dataset.action;
    var productId = trigger.dataset.productId;
    var collection = trigger.dataset.collection;
    var colorIndex = Number(trigger.dataset.colorIndex);
    var size = Number(trigger.dataset.size);
    var itemKey = trigger.dataset.itemKey;
    var index = Number(trigger.dataset.index);

    switch (action) {
      case "toggle-cart":
        state.cartOpen ? closeCart() : openCart();
        break;
      case "close-cart":
        closeCart();
        break;
      case "begin-checkout":
        openCheckout();
        break;
      case "close-checkout":
        closeCheckout();
        break;
      case "open-detail":
        openProduct(productId);
        break;
      case "close-detail":
        closeProduct();
        break;
      case "toggle-wishlist":
        toggleWishlist(productId);
        break;
      case "add-to-cart":
        addToCart(productId, trigger);
        break;
      case "set-collection":
        state.activeCollection = collection;
        renderCollections();
        renderProductGrid();
        document.getElementById("catalog").scrollIntoView({ behavior: state.reducedMotion ? "auto" : "smooth", block: "start" });
        break;
      case "scroll-products":
        document.getElementById("catalog").scrollIntoView({ behavior: state.reducedMotion ? "auto" : "smooth", block: "start" });
        break;
      case "select-hero-color":
        state.heroColorIndex = colorIndex;
        renderHeroSwatchesOnly();
        saveState();
        break;
      case "select-product-color":
        selectProductColor(productId, colorIndex);
        break;
      case "select-size":
        selectSize(productId, size);
        break;
      case "remove-from-cart":
        removeFromCart(itemKey);
        break;
      case "increase-quantity":
        adjustQuantity(itemKey, 1);
        break;
      case "decrease-quantity":
        adjustQuantity(itemKey, -1);
        break;
      case "select-gallery":
        state.activeGalleryIndex = index;
        renderDetailSheet();
        break;
      case "previous-testimonial":
        cycleTestimonial(-1);
        break;
      case "next-testimonial":
        cycleTestimonial(1);
        break;
      case "go-to-testimonial":
        state.testimonialIndex = index;
        renderTestimonials();
        break;
      case "focus-wishlist":
        state.activeCollection = "all";
        renderCollections();
        renderProductGrid();
        document.getElementById("catalog").scrollIntoView({ behavior: state.reducedMotion ? "auto" : "smooth", block: "start" });
        showToast("Wishlist highlights are marked with a filled heart.");
        break;
      default:
        break;
    }
  }

  function handleSubmit(event) {
    if (event.target.id === "newsletter-form") {
      event.preventDefault();
      var newsletterEmail = event.target.querySelector("input[name='email']");
      showToast("Welcome to the list, " + newsletterEmail.value + ".");
      event.target.reset();
      return;
    }

    if (event.target.id === "checkout-form") {
      event.preventDefault();
      showToast("Order confirmed. Your pair is on the way.");
      state.cart = [];
      state.checkoutOpen = false;
      saveState();
      renderCartSidebar();
      renderCheckoutModal();
      updateHeaderCounts();
      toggleBodyLock();
    }
  }

  function bootstrapFirebase() {
    if (!firebaseBridge) {
      return;
    }

    firebaseBridge.bootstrap().then(function (context) {
      state.firebaseContext = context;
      if (context.enabled) {
        showToast("Firebase sync is active.");
      }
    });
  }

  function boot() {
    getSelection(firstProduct.id);
    renderFrame();
    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);
    window.addEventListener("hashchange", syncStateFromRoute);
    initCursorGlow();
    initParticles();
    initHeroViewer();
    initScrollAnimations();
    initParallax();
    initTestimonialAutoplay();
    initSwipeDismiss();
    bootstrapFirebase();

    window.setTimeout(renderAfterLoad, 900);
    syncStateFromRoute();
  }

  boot();
}());
