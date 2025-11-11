// modulos/features/virtual-scroll.js
class VirtualScroll {
  constructor(container, itemHeight, renderItem) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.items = [];
    this.visibleItems = [];
    this.scrollTop = 0;
    
    this.init();
  }

  init() {
    this.container.style.overflowY = 'auto';
    this.container.style.position = 'relative';
    
    this.container.addEventListener('scroll', this.handleScroll.bind(this));
    this.updateVisibleItems();
  }

  setItems(items) {
    this.items = items;
    this.updateContainerHeight();
    this.updateVisibleItems();
  }

  updateContainerHeight() {
    this.container.style.height = `${this.items.length * this.itemHeight}px`;
  }

  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    this.updateVisibleItems();
  }

  updateVisibleItems() {
    const containerHeight = this.container.clientHeight;
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / this.itemHeight) + 5,
      this.items.length
    );

    // Reutilizar elementos existentes cuando sea posible
    this.visibleItems = this.items.slice(startIndex, endIndex);
    
    this.renderItems(startIndex);
  }

  renderItems(startIndex) {
    // Limpiar solo lo necesario
    const existingChildren = Array.from(this.container.children);
    
    this.visibleItems.forEach((item, index) => {
      const absoluteIndex = startIndex + index;
      let element = existingChildren.find(child => 
        child.dataset.index === absoluteIndex.toString()
      );

      if (!element) {
        element = this.renderItem(item, absoluteIndex);
        element.dataset.index = absoluteIndex;
        this.container.appendChild(element);
      } else {
        // Actualizar elemento existente
        this.updateItem(element, item, absoluteIndex);
      }
    });

    // Remover elementos que ya no son visibles
    existingChildren.forEach(child => {
      const index = parseInt(child.dataset.index);
      if (index < startIndex || index >= startIndex + this.visibleItems.length) {
        child.remove();
      }
    });
  }

  updateItem(element, item, index) {
    // Actualizar contenido del elemento si es necesario
    // Esto depende de tu implementación específica
  }
}