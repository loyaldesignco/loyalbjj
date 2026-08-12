/* ============================================================
   LOYAL BJJ — THEME JAVASCRIPT
   ============================================================ */

'use strict';

// ===== UTILITIES =====

function formatMoney(cents) {
  const dollars = (cents / 100).toFixed(2);
  return '$' + dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

// ===== CART STORE =====

const Cart = {
  _data: null,

  async fetch() {
    const res = await fetch('/cart.js');
    this._data = await res.json();
    return this._data;
  },

  async add(items) {
    const res = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.description || 'Could not add item to cart.');
    }
    return res.json();
  },

  async change(id, quantity) {
    const res = await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id, quantity }),
    });
    this._data = await res.json();
    return this._data;
  },

  async remove(id) {
    return this.change(id, 0);
  },
};

// ===== CART DRAWER =====

class CartDrawer {
  constructor() {
    this.el = document.getElementById('CartDrawer');
    this.body = document.getElementById('CartDrawerBody');
    this.foot = document.getElementById('CartDrawerFoot');
    this.subtotal = document.getElementById('CartSubtotal');

    if (!this.el) return;

    this.el.querySelectorAll('[data-cart-close]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.el.classList.contains('is-open')) this.close();
    });

    document.addEventListener('cart:open', () => this.open());
  }

  open() {
    this.el.classList.add('is-open');
    this.el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    this.refresh();
  }

  close() {
    this.el.classList.remove('is-open');
    this.el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async refresh() {
    try {
      const cart = await Cart.fetch();
      this.render(cart);
    } catch (e) {
      console.error('Cart refresh error:', e);
    }
  }

  render(cart) {
    if (!cart.item_count) {
      this.body.innerHTML = `
        <div class="cart-drawer__empty">
          <p>Your cart is empty.</p>
          <a href="/collections/all" class="btn btn--outline btn--sm">Shop Now</a>
        </div>`;
      this.foot.hidden = true;
      return;
    }

    this.subtotal.textContent = formatMoney(cart.total_price);
    this.foot.hidden = false;

    this.body.innerHTML = cart.items.map(item => `
      <div class="cart-item" data-key="${item.key}">
        <a href="${item.url}">
          <img class="cart-item__image" src="${item.image}" alt="${item.product_title}" width="80" height="107" loading="lazy">
        </a>
        <div class="cart-item__info">
          <a href="${item.url}" class="cart-item__title">${item.product_title}</a>
          ${item.variant_title && item.variant_title !== 'Default Title' ? `<div class="cart-item__variant">${item.variant_title}</div>` : ''}
          <div class="cart-item__price">${formatMoney(item.final_line_price)}</div>
          <div class="cart-item__controls">
            <div class="cart-item__qty">
              <button class="cart-item__qty-btn" data-qty-minus data-key="${item.key}" aria-label="Decrease quantity">−</button>
              <span class="cart-item__qty-count">${item.quantity}</span>
              <button class="cart-item__qty-btn" data-qty-plus data-key="${item.key}" aria-label="Increase quantity">+</button>
            </div>
            <button class="cart-item__remove" data-remove data-key="${item.key}" aria-label="Remove item">Remove</button>
          </div>
        </div>
      </div>`).join('');

    // bind qty controls
    this.body.querySelectorAll('[data-qty-minus]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = cart.items.find(i => i.key === btn.dataset.key);
        if (item) this.updateQty(btn.dataset.key, item.quantity - 1);
      });
    });

    this.body.querySelectorAll('[data-qty-plus]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = cart.items.find(i => i.key === btn.dataset.key);
        if (item) this.updateQty(btn.dataset.key, item.quantity + 1);
      });
    });

    this.body.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => this.removeItem(btn.dataset.key));
    });
  }

  async updateQty(key, qty) {
    try {
      const cart = await Cart.change(key, Math.max(0, qty));
      this.render(cart);
    } catch (e) { console.error(e); }
  }

  async removeItem(key) {
    try {
      const cart = await Cart.remove(key);
      this.render(cart);
    } catch (e) { console.error(e); }
  }
}

// ===== ADD TO CART =====

function initAddToCart() {
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[action="/cart/add"]');
    if (!form) return;
    e.preventDefault();

    const btn = form.querySelector('[type="submit"]');
    if (!btn || btn.disabled) return;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = `<span class="loading-spinner"></span>`;

    try {
      const formData = new FormData(form);
      const items = [{ id: formData.get('id'), quantity: Number(formData.get('quantity') || 1) }];
      await Cart.add(items);
      btn.textContent = 'Added';
      setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 1500);
      document.dispatchEvent(new CustomEvent('cart:open'));
    } catch (err) {
      btn.textContent = err.message || 'Error';
      btn.disabled = false;
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  });
}

// ===== QUICK ADD =====

function initQuickAdd() {
  document.addEventListener('click', async (e) => {
    const opt = e.target.closest('[data-quick-add]');
    if (!opt) return;

    const variantId = opt.dataset.quickAdd;
    const btn = opt;
    const originalText = btn.textContent;

    btn.textContent = '...';

    try {
      await Cart.add([{ id: variantId, quantity: 1 }]);
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = originalText; }, 1200);
      document.dispatchEvent(new CustomEvent('cart:open'));
    } catch (err) {
      btn.textContent = 'Error';
      setTimeout(() => { btn.textContent = originalText; }, 1200);
    }
  });
}

// ===== MOBILE NAV =====

class MobileNav {
  constructor() {
    this.el = document.getElementById('MobileNav');
    if (!this.el) return;

    document.querySelectorAll('[data-nav-open]').forEach(btn => {
      btn.addEventListener('click', () => this.open());
    });

    this.el.querySelectorAll('[data-nav-close]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.el.classList.contains('is-open')) this.close();
    });

    // Accordion
    this.el.querySelectorAll('[data-mobile-accordion]').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.closest('.mobile-nav__group');
        const children = group.querySelector('.mobile-nav__children');
        const isOpen = group.classList.contains('is-open');
        group.classList.toggle('is-open', !isOpen);
        children.hidden = isOpen;
      });
    });

    // Init hidden state
    this.el.querySelectorAll('.mobile-nav__children').forEach(el => { el.hidden = true; });
  }

  open() {
    this.el.classList.add('is-open');
    this.el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.el.classList.remove('is-open');
    this.el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

// ===== HEADER =====

function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const isTransparentPage = document.body.classList.contains('template-index');

  function update() {
    if (window.scrollY > 10) {
      header.classList.add('is-scrolled');
      header.classList.remove('is-transparent');
    } else {
      header.classList.remove('is-scrolled');
      if (isTransparentPage && header.dataset.transparent) {
        header.classList.add('is-transparent');
      }
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
}

// ===== PRODUCT PAGE =====

class ProductPage {
  constructor() {
    this.form = document.querySelector('form[action="/cart/add"]');
    if (!this.form) return;

    this.initGallery();
    this.initOptions();
    this.initQty();
  }

  initGallery() {
    const mainImg = document.getElementById('ProductMainImage');
    const thumbs = document.querySelectorAll('[data-thumb]');

    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        if (!mainImg) return;
        mainImg.src = thumb.dataset.src;
        mainImg.srcset = '';
        thumbs.forEach(t => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
      });
    });
  }

  initOptions() {
    const optionBtns = document.querySelectorAll('[data-option-value]');
    if (!optionBtns.length) return;

    const variantData = this._getVariantData();
    if (!variantData) return;

    optionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const position = btn.closest('[data-option-position]').dataset.optionPosition;

        // Deselect siblings
        btn.closest('[data-option-position]').querySelectorAll('[data-option-value]').forEach(b => {
          b.classList.remove('is-active');
        });
        btn.classList.add('is-active');

        this.updateVariant(variantData);
      });
    });
  }

  _getVariantData() {
    const el = document.getElementById('ProductVariantData');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  }

  _getSelectedOptions() {
    return Array.from(document.querySelectorAll('[data-option-position]')).map(group => {
      const active = group.querySelector('[data-option-value].is-active');
      return active ? active.dataset.optionValue : null;
    });
  }

  updateVariant(variants) {
    const selected = this._getSelectedOptions();
    const variant = variants.find(v =>
      v.options.every((opt, i) => opt === selected[i])
    );

    const priceEl = document.getElementById('ProductPrice');
    const comparePriceEl = document.getElementById('ProductComparePrice');
    const idInput = this.form.querySelector('[name="id"]');
    const addBtn = this.form.querySelector('[type="submit"]');
    const stockEl = document.getElementById('ProductStock');

    if (!variant) {
      if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Unavailable'; }
      return;
    }

    if (idInput) idInput.value = variant.id;

    if (priceEl) priceEl.textContent = formatMoney(variant.price);

    if (comparePriceEl) {
      if (variant.compare_at_price && variant.compare_at_price > variant.price) {
        comparePriceEl.textContent = formatMoney(variant.compare_at_price);
        comparePriceEl.hidden = false;
      } else {
        comparePriceEl.textContent = '';
        comparePriceEl.hidden = true;
      }
    }

    if (addBtn) {
      if (variant.available) {
        addBtn.disabled = false;
        addBtn.textContent = 'Add to Cart';
      } else {
        addBtn.disabled = true;
        addBtn.textContent = 'Sold Out';
      }
    }

    if (stockEl) {
      if (variant.inventory_management && variant.inventory_quantity <= 5 && variant.inventory_quantity > 0) {
        stockEl.textContent = `Only ${variant.inventory_quantity} left`;
        stockEl.hidden = false;
      } else {
        stockEl.hidden = true;
      }
    }

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState({}, '', url);
  }

  initQty() {
    const minusBtn = document.querySelector('[data-qty-minus]');
    const plusBtn = document.querySelector('[data-qty-plus]');
    const input = document.querySelector('.qty-input__num');

    if (!input) return;

    minusBtn?.addEventListener('click', () => {
      const v = Math.max(1, parseInt(input.value) - 1);
      input.value = v;
    });

    plusBtn?.addEventListener('click', () => {
      input.value = parseInt(input.value) + 1;
    });
  }
}

// ===== PRODUCT ACCORDION =====

function initAccordions() {
  document.querySelectorAll('.product-accordion__trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.product-accordion__item');
      const isOpen = item.classList.contains('is-open');

      // Close all
      document.querySelectorAll('.product-accordion__item.is-open').forEach(i => {
        i.classList.remove('is-open');
        i.querySelector('.product-accordion__trigger').setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

// ===== LAZY IMAGES =====

function initLazyImages() {
  if ('loading' in HTMLImageElement.prototype) return; // native lazy loading

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) { img.src = img.dataset.src; }
        if (img.dataset.srcset) { img.srcset = img.dataset.srcset; }
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '200px' });

  document.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
}

// ===== ANNOUNCEMENT BAR DISMISS =====

function initAnnouncementBar() {
  const bar = document.querySelector('.announcement-bar');
  const dismissBtn = document.querySelector('[data-announcement-dismiss]');
  if (!bar || !dismissBtn) return;

  dismissBtn.addEventListener('click', () => {
    bar.style.maxHeight = bar.offsetHeight + 'px';
    requestAnimationFrame(() => {
      bar.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
      bar.style.maxHeight = '0';
      bar.style.opacity = '0';
      bar.style.overflow = 'hidden';
    });
    sessionStorage.setItem('announcement-dismissed', '1');
  });

  if (sessionStorage.getItem('announcement-dismissed')) {
    bar.hidden = true;
  }
}

// ===== COLLECTION SORT =====

function initCollectionSort() {
  const sortSelect = document.querySelector('[data-sort-by]');
  if (!sortSelect) return;

  sortSelect.addEventListener('change', () => {
    const url = new URL(window.location);
    url.searchParams.set('sort_by', sortSelect.value);
    url.searchParams.delete('page');
    window.location = url.toString();
  });
}

// ===== SMOOTH ANCHOR SCROLL =====

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ===== INIT =====

document.addEventListener('DOMContentLoaded', () => {
  const cartDrawer = new CartDrawer();
  const mobileNav = new MobileNav();

  initHeader();
  initAddToCart();
  initQuickAdd();
  initAccordions();
  initLazyImages();
  initAnnouncementBar();
  initCollectionSort();
  initSmoothScroll();

  if (document.querySelector('form[action="/cart/add"]')) {
    new ProductPage();
  }

  // Expose cart open trigger for header cart button
  document.querySelectorAll('[data-cart-open]').forEach(btn => {
    btn.addEventListener('click', () => cartDrawer.open());
  });
});
