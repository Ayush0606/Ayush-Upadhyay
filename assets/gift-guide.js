/**
 * ============================================================
 * GIFT GUIDE JAVASCRIPT - Production-Ready Interactions
 * ============================================================
 * Handles:
 * - Product grid tile interactions
 * - Modal popup open/close
 * - Variant selection
 * - AJAX Add to Cart functionality
 * - Special logic: Black+Medium → auto-add "Soft Winter Jacket"
 */

(function() {
  'use strict';

  /**
   * GiftGuideGrid
   * Manages the product grid, modal, and cart interactions
   */
  class GiftGuideGrid {
    constructor() {
      this.modal = null;
      this.modalOverlay = null;
      this.currentProduct = null;
      this.selectedVariants = {};
      this.init();
    }

    /**
     * Initialize the grid and bind event listeners
     */
    init() {
      this.cacheDOM();
      this.bindEvents();
    }

    /**
     * Cache frequently accessed DOM elements
     */
    cacheDOM() {
      this.tiles = document.querySelectorAll('.gift-guide-tile');
      this.modal = document.getElementById('ggModal');
      this.modalOverlay = document.getElementById('ggModalOverlay');
      this.addToCartBtn = this.modal ? (this.modal.querySelector('.gift-guide-modal__add-to-cart') || null) : null;
      this.closeBtn = this.modal ? (this.modal.querySelector('.gift-guide-modal__close') || null) : null;
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
      // Tile click handlers
      this.tiles.forEach((tile) => {
        const badge = tile.querySelector('.gift-guide-tile__badge');
        if (badge) {
          badge.addEventListener('click', (e) => this.handleTileClick(e, tile));
        }
      });

      // Modal close handlers
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.closeModal());
      }

      if (this.modalOverlay) {
        this.modalOverlay.addEventListener('click', (e) => {
          if (e.target === this.modalOverlay) {
            this.closeModal();
          }
        });
      }

      // Add to Cart button
      if (this.addToCartBtn) {
        this.addToCartBtn.addEventListener('click', () => this.handleAddToCart());
      }
    }

    /**
     * Handle tile/badge click - fetch product and open modal
     */
    async handleTileClick(e, tile) {
      e.stopPropagation();
      
      const productId = tile.dataset.productId;
      if (!productId) return;

      try {
        // Fetch product data from Shopify
        const response = await fetch(`/products/${productId}.js`);
        if (!response.ok) throw new Error('Failed to fetch product');
        
        const product = await response.json();
        this.currentProduct = product;
        this.selectedVariants = {};
        
        // Populate modal with product data
        this.populateModal(product);
        this.openModal();
      } catch (error) {
        console.error('Error loading product:', error);
        alert('Failed to load product details. Please try again.');
      }
    }

    /**
     * Populate modal with product information
     */
    populateModal(product) {
      if (!this.modal) return;

      // Set product image
      const image = this.modal.querySelector('.gift-guide-modal__image');
      if (image && product.featured_image) {
        const imgElement = image;
        imgElement.src = product.featured_image.src;
        imgElement.alt = product.title;
      }

      // Set product title
      const title = this.modal.querySelector('.gift-guide-modal__title');
      if (title) {
        title.textContent = product.title;
      }

      // Set product price
      const price = this.modal.querySelector('.gift-guide-modal__price');
      if (price && product.variants.length > 0) {
        const minPrice = Math.min(...product.variants.map((v) => v.price));
        price.textContent = this.formatPrice(minPrice);
      }

      // Set product description
      const description = this.modal.querySelector('.gift-guide-modal__description');
      if (description) {
        description.textContent = product.body_html ? 
          product.body_html.replace(/<[^>]*>/g, '') : 
          'No description available';
      }

      // Render variant options
      this.renderVariants(product);
    }

    /**
     * Render variant options from product data
     */
    renderVariants(product) {
      const variantsContainer = this.modal.querySelector('.gift-guide-modal__variants');
      if (!variantsContainer) return;

      // Clear previous variants
      variantsContainer.innerHTML = '';

      // Group variants by option (color, size, etc.)
      const optionNames = product.options || [];
      
      optionNames.forEach((optionName, optionIndex) => {
        // Get unique values for this option
        const values = [...new Set(
          product.variants.map((v) => v.options[optionIndex])
        )];

        const groupDiv = document.createElement('div');
        groupDiv.className = 'gift-guide-modal__variant-group';

        const label = document.createElement('label');
        label.className = 'gift-guide-modal__variant-label';
        label.textContent = optionName;
        groupDiv.appendChild(label);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'gift-guide-modal__variant-options';

        values.forEach((value) => {
          const button = document.createElement('button');
          button.className = 'gift-guide-modal__variant-option';
          button.textContent = value;
          button.type = 'button';
          button.dataset.optionIndex = optionIndex;
          button.dataset.value = value;

          button.addEventListener('click', (e) => {
            e.preventDefault();
            // Deselect previous option in this group
            optionsDiv.querySelectorAll('.gift-guide-modal__variant-option').forEach((btn) => {
              btn.classList.remove('active');
            });
            // Select current option
            button.classList.add('active');
            // Store selection
            this.selectedVariants[optionName] = value;
          });

          optionsDiv.appendChild(button);
        });

        groupDiv.appendChild(optionsDiv);
        variantsContainer.appendChild(groupDiv);
      });
    }

    /**
     * Handle Add to Cart button click
     */
    async handleAddToCart() {
      if (!this.currentProduct) return;

      // Find matching variant based on selected options
      const variant = this.findMatchingVariant(this.currentProduct);
      if (!variant) {
        alert('Please select all options before adding to cart.');
        return;
      }

      try {
        // Disable button during request
        if (this.addToCartBtn) {
          this.addToCartBtn.disabled = true;
          this.addToCartBtn.textContent = 'Adding...';
        }

        // Add product to cart
        await this.addToCart(variant.id, 1);

        // Check for special condition: Black + Medium
        if (this.shouldAddSoftWinterJacket(variant)) {
          // Automatically add "Soft Winter Jacket" to cart
          await this.addSoftWinterJacketToCart();
        }

        // Success feedback
        this.showCartSuccess();
        
        // Close modal
        setTimeout(() => {
          this.closeModal();
          if (this.addToCartBtn) {
            this.addToCartBtn.disabled = false;
            this.addToCartBtn.textContent = 'ADD TO CART';
          }
        }, 1500);

      } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Failed to add item to cart. Please try again.');
        if (this.addToCartBtn) {
          this.addToCartBtn.disabled = false;
          this.addToCartBtn.textContent = 'ADD TO CART';
        }
      }
    }

    /**
     * Find variant matching selected options
     */
    findMatchingVariant(product) {
      return product.variants.find((variant) => {
        return product.options.every((optionName, index) => {
          return variant.options[index] === this.selectedVariants[optionName];
        });
      });
    }

    /**
     * Check if variant matches Black + Medium condition
     */
    shouldAddSoftWinterJacket(variant) {
      const hasBlack = variant.options.some((opt) => opt?.toLowerCase() === 'black');
      const hasMedium = variant.options.some((opt) => opt?.toLowerCase() === 'medium');
      return hasBlack && hasMedium;
    }

    /**
     * Add product to cart via AJAX
     */
    async addToCart(variantId, quantity = 1) {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              id: variantId,
              quantity: quantity
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add to cart');
      }

      return response.json();
    }

    /**
     * Add "Soft Winter Jacket" to cart if Black+Medium selected
     */
    async addSoftWinterJacketToCart() {
      try {
        // Fetch all products to find "Soft Winter Jacket"
        const response = await fetch('/search/suggest.json?q=Soft%20Winter%20Jacket&resources[type]=product&resources[limit]=1');
        const data = await response.json();

        if (data.resources?.results?.products?.length > 0) {
          const jacket = data.resources.results.products[0];
          // Add first variant of the jacket
          if (jacket.variants && jacket.variants.length > 0) {
            await this.addToCart(jacket.variants[0].id, 1);
          }
        }
      } catch (error) {
        // Silently fail - don't disrupt main cart operation
        console.warn('Could not auto-add Soft Winter Jacket:', error);
      }
    }

    /**
     * Show success message
     */
    showCartSuccess() {
      const btn = this.addToCartBtn;
      if (btn) {
        btn.textContent = '✓ Added to Cart';
        btn.style.background = '#4CAF50';
      }
    }

    /**
     * Open modal with animation
     */
    openModal() {
      if (this.modal && this.modalOverlay) {
        this.modalOverlay.classList.add('active');
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
      }
    }

    /**
     * Close modal with animation
     */
    closeModal() {
      if (this.modal && this.modalOverlay) {
        this.modalOverlay.classList.remove('active');
        // Restore body scroll
        document.body.style.overflow = '';
      }
    }

    /**
     * Format price in shop currency
     */
    formatPrice(price) {
      if (typeof price !== 'number') {
        return '$0.00';
      }
      // Price is in cents from Shopify
      const dollars = (price / 100).toFixed(2);
      // Get currency symbol from shop settings (you can customize this)
      return `$${dollars}`;
    }
  }

  /**
   * Initialize on DOM ready
   */
  document.addEventListener('DOMContentLoaded', () => {
    new GiftGuideGrid();
  });

  // Fallback for older browsers
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    new GiftGuideGrid();
  }

})();
