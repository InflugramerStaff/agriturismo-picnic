import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, push, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Configurazione Firebase
const firebaseConfig = {
    databaseURL: "https://picnic-4467e-default-rtdb.europe-west1.firebasedatabase.app/"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Variabili globali
let cart = [];
let currentStep = 1;
let selectedLocation = null;
let productsData = [];
let locationsData = [];

// Funzione per mostrare le notifiche
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');

    notification.className = 'notification';
    notification.classList.add('notification-' + type);

    notificationMessage.textContent = message;

    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Carica le postazioni da Firebase
function loadLocations() {
    const locationsContainer = document.getElementById('locationsContainer');
    const locationsLoader = document.getElementById('locationsLoader');
    const locationSelect = document.getElementById('location');
    const goToStep2Button = document.getElementById('go-to-step-2');

    locationsLoader.style.display = 'block';
    locationsContainer.innerHTML = '';
    locationSelect.innerHTML = '<option value="">-- Seleziona --</option>';

    const locationsRef = ref(database, 'locations');

    onValue(locationsRef, (snapshot) => {
        const data = snapshot.val();
        locationsData = data ? Object.entries(data).map(([key, value]) => ({
            ...value,
            firebaseKey: key
        })) : [];

        // Ordina le postazioni per numero
        locationsData.sort((a, b) => a.number - b.number);

        // Nascondi il loader
        locationsLoader.style.display = 'none';

        if (locationsData.length === 0) {
            locationsContainer.innerHTML = `
                <div style="text-align: center; padding: 1rem; color: var(--text-light);">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Nessuna postazione disponibile al momento.</p>
                </div>
            `;
            goToStep2Button.disabled = true; // Disable button if no locations
            return;
        }

        goToStep2Button.disabled = false; // Enable button if locations are available

        // Popola il dropdown e crea le card per ogni postazione
        locationsData.forEach(location => {
            // Mostra solo le postazioni disponibili
            if (location.status === 'available' || !location.status) {
                // Aggiungi al dropdown
                const option = document.createElement('option');
                option.value = location.number;
                option.textContent = `Postazione ${location.number} - ${location.name}`;
                locationSelect.appendChild(option);

                // Crea la card
                const locationDiv = document.createElement('div');
                locationDiv.className = 'location-select';
                locationDiv.setAttribute('data-location-id', location.number);
                locationDiv.addEventListener('click', () => selectLocation(location.number));

                locationDiv.innerHTML = `
                    <div class="location-name">Postazione ${location.number}</div>
                    <div class="location-description">${location.name}</div>
                `;

                locationsContainer.appendChild(locationDiv);
            }
        });

        // Se la location era già selezionata (es. quando si torna indietro)
        if (selectedLocation) {
            selectLocation(selectedLocation);
            locationSelect.value = selectedLocation;
        }
    });
};

// Seleziona una postazione
function selectLocation(locationId) {
    // Deseleziona tutte le postazioni
    document.querySelectorAll('.location-select').forEach(loc => {
        loc.classList.remove('selected');
    });

    // Seleziona la postazione scelta
    const selectedLocationElement = document.querySelector(`.location-select[data-location-id="${locationId}"]`);
    if (selectedLocationElement) {
        selectedLocationElement.classList.add('selected');
        selectedLocation = locationId;

        // Aggiorna anche il dropdown
        document.getElementById('location').value = locationId;
    }
};

// Seleziona una postazione dal dropdown
function selectLocationFromDropdown() {
    const locationId = document.getElementById('location').value;
    if (locationId) {
        selectLocation(locationId);
    }
};

// Carica i prodotti da Firebase
function loadProducts() {
    const productGrid = document.getElementById('productGrid');
    const productsLoader = document.getElementById('productsLoader');

    productsLoader.style.display = 'block';
    productGrid.innerHTML = '';

    const productsRef = ref(database, 'products');

    onValue(productsRef, (snapshot) => {
        const data = snapshot.val();
        productsData = data ? Object.entries(data).map(([key, value]) => ({
            ...value,
            firebaseKey: key
        })) : [];

        // Nascondi il loader
        productsLoader.style.display = 'none';

        if (productsData.length === 0) {
            productGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 1rem; color: var(--text-light);">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Nessun prodotto disponibile al momento.</p>
                </div>
            `;
            return;
        }

        // Crea le card per i prodotti
        productsData.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';

            const productInCart = cart.find(item => item.id === product.id);
            const currentQty = productInCart ? productInCart.quantity : 0;

            productCard.innerHTML = `
                <div class="product-image-container">
                    <img src="${product.image}" alt="${product.name}" class="product-image">
                    <div class="product-price-tag">€${product.price.toFixed(2)}</div>
                </div>
                <div class="product-content">
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-description">${product.description}</p>
                    <div class="product-actions">
                        <div class="quantity-control">
                            <button class="qty-btn" data-product-id="${product.id}">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="text" class="qty-input" id="quantity-${product.id}" value="${currentQty}" readonly>
                            <button class="qty-btn" data-product-id="${product.id}">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <button class="add-to-cart-btn" data-product-id="${product.id}">
                            <i class="fas fa-plus"></i> Aggiungi
                        </button>
                    </div>
                </div>
            `;

            productGrid.appendChild(productCard);
        });

        // Aggiungi event listeners per i bottoni di quantità e aggiunta al carrello
        productGrid.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                const productId = parseInt(event.currentTarget.dataset.productId);
                if (event.currentTarget.querySelector('.fa-minus')) {
                    decrementQuantity(productId);
                } else {
                    incrementQuantity(productId);
                }
            });
        });

        productGrid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                const productId = parseInt(event.currentTarget.dataset.productId);
                addToCart(productId);
            });
        });
    });
};

// Funzioni per gestire la quantità
function incrementQuantity(productId) {
    const quantityElement = document.getElementById(`quantity-${productId}`);
    let quantity = parseInt(quantityElement.value);
    quantityElement.value = quantity + 1;
};

function decrementQuantity(productId) {
    const quantityElement = document.getElementById(`quantity-${productId}`);
    let quantity = parseInt(quantityElement.value);
    if (quantity > 0) {
        quantityElement.value = quantity - 1;
    }
};

// Funzione per aggiungere al carrello
function addToCart(productId) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;

    const quantityElement = document.getElementById(`quantity-${productId}`);
    const quantity = parseInt(quantityElement.value);

    if (quantity <= 0) {
        showNotification('Per favore seleziona una quantità', 'error');
        return;
    }

    // Verifico se il prodotto è già nel carrello
    const existingItemIndex = cart.findIndex(item => item.id === productId);

    if (existingItemIndex !== -1) {
        // Aggiorna la quantità
        cart[existingItemIndex].quantity = quantity;
    } else {
        // Aggiungi nuovo prodotto
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: quantity,
            image: product.image
        });
    }

    // Aggiorna il conteggio del carrello
    updateCartCount();

    // Notifica l'utente
    showNotification(`${product.name} aggiunto al cestino!`, 'success');
};

// Aggiorna il conteggio del carrello
function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById('cartCount').textContent = totalItems;
};

// Mostra/nasconde il carrello
const cartButton = document.getElementById('cartButton');
const closeCartButton = document.getElementById('close-cart');
const closeCartBottomButton = document.getElementById('close-cart-bottom');

cartButton.addEventListener('click', toggleCart);
closeCartButton.addEventListener('click', toggleCart);
closeCartBottomButton.addEventListener('click', toggleCart);

function toggleCart() {
    const cartModal = document.getElementById('cartModal');

    if (cartModal.style.display === 'flex') {
        cartModal.style.display = 'none';
    } else {
        updateCartDisplay();
        cartModal.style.display = 'flex';
    }
};

// Aggiorna il contenuto del carrello
function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-shopping-basket"></i>
                <p>Il tuo cestino è vuoto</p>
                <p>Aggiungi qualcosa dal menu!</p>
            </div>
        `;
        cartTotal.textContent = '€0.00';
        return;
    }

    let total = 0;
    let cartHTML = '';

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        cartHTML += `
            <div class="cart-item">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">€${item.price.toFixed(2)}</div>
                </div>
                <div class="cart-item-quantity">
                    <button class="cart-qty-btn" data-product-id="${item.id}">
                        <i class="fas fa-minus"></i>
                    </button>
                    <span class="cart-qty">${item.quantity}</span>
                    <button class="cart-qty-btn" data-product-id="${item.id}">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="cart-item-total">€${itemTotal.toFixed(2)}</div>
                <button class="cart-item-remove" data-product-id="${item.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });

    cartItems.innerHTML = cartHTML;
    cartTotal.textContent = `€${total.toFixed(2)}`;

    // Aggiungi event listeners per i bottoni del carrello
    cartItems.querySelectorAll('.cart-qty-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            const productId = parseInt(event.currentTarget.dataset.productId);
            if (event.currentTarget.querySelector('.fa-minus')) {
                decrementCartItem(productId);
            } else {
                incrementCartItem(productId);
            }
        });
    });

    cartItems.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', (event) => {
            const productId = parseInt(event.currentTarget.dataset.productId);
            removeCartItem(productId);
        });
    });
};

// Incrementa la quantità nel carrello
function incrementCartItem(productId) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += 1;
        updateCartDisplay();
        updateCartCount();
        updateProductQuantity(productId, item.quantity);
    }
};

// Decrementa la quantità nel carrello
function decrementCartItem(productId) {
    const item = cart.find(item => item.id === productId);
    if (item && item.quantity > 1) {
        item.quantity -= 1;
        updateCartDisplay();
        updateCartCount();
        updateProductQuantity(productId, item.quantity);
    } else if (item && item.quantity === 1) {
        removeCartItem(productId);
    }
};

// Rimuovi un prodotto dal carrello
function removeCartItem(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
    updateCartCount();
    updateProductQuantity(productId, 0);
};

// Aggiorna la quantità visualizzata nella card del prodotto
function updateProductQuantity(productId, quantity) {
    const quantityInput = document.getElementById(`quantity-${productId}`);
    if (quantityInput) {
        quantityInput.value = quantity;
    }
};

// Svuota il carrello
const clearCartButton = document.getElementById('clear-cart');
clearCartButton.addEventListener('click', clearCart);

function clearCart() {
    if (cart.length === 0) return;

    if (confirm('Sei sicuro di voler svuotare il cestino?')) {
        // Resetta le quantità nelle card dei prodotti
        cart.forEach(item => {
            updateProductQuantity(item.id, 0);
        });

        cart = [];
        updateCartDisplay();
        updateCartCount();
        showNotification('Cestino svuotato', 'success');
    }
};

// Funzioni di navigazione tra gli step
const goToStep1Button = document.getElementById('go-to-step-1');
const goToStep2Button = document.getElementById('go-to-step-2');
const goToStep3Button = document.getElementById('go-to-step-3');
const startOverButton = document.getElementById('start-over');

goToStep1Button.addEventListener('click', () => goToStep(1));
goToStep2Button.addEventListener('click', () => goToStep(2));
goToStep3Button.addEventListener('click', () => goToStep(3));
startOverButton.addEventListener('click', () => startOver());

function goToStep(step) {
    if (step === 1) {
        // No validation needed to go back to step 1
    }
    else if (step === 2) {
        // Validate step 1: location must be selected
        if (!selectedLocation) {
            showNotification('Per favore, seleziona una postazione', 'error');
            return;
        }
    }
    else if (step === 3) {
        // Validate step 2: cart must not be empty
        if (cart.length === 0) {
            showNotification('Il tuo cestino è vuoto. Aggiungi almeno un prodotto.', 'error');
            return;
        }

        // Update order summary
        updateOrderSummary();
    }

    // Hide all steps
    document.querySelectorAll('.step').forEach(s => {
        s.classList.remove('active');
    });

    // Show the requested step
    document.getElementById(`step${step}`).classList.add('active');

    // Update the progress indicators
    document.querySelectorAll('.step-indicator').forEach(indicator => {
        indicator.classList.remove('active', 'completed');
    });

    for (let i = 1; i <= 4; i++) {
        const indicator = document.getElementById(`step${i}-indicator`);

        if (i === step) {
            indicator.classList.add('active');
        } else if (i < step) {
            indicator.classList.add('completed');
        }
    }

    currentStep = step;

    // Load data if needed
    if (step === 1 && locationsData.length === 0) {
        loadLocations();
    } else if (step === 2 && productsData.length === 0) {
        loadProducts();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Aggiorna il riepilogo dell'ordine
function updateOrderSummary() {
    const location = locationsData.find(l => l.number == selectedLocation);

    if (location) {
        document.getElementById('summaryLocation').textContent = `Postazione ${location.number} - ${location.name}`;
    }

    const summaryItems = document.getElementById('summaryItems');
    summaryItems.innerHTML = '';

    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const summaryItem = document.createElement('div');
        summaryItem.className = 'summary-item';
        summaryItem.innerHTML = `
            <span>${item.name} x ${item.quantity}</span>
            <span>€${itemTotal.toFixed(2)}</span>
        `;

        summaryItems.appendChild(summaryItem);
    });

    document.getElementById('summaryTotal').textContent = `€${total.toFixed(2)}`;
};

// Invia l'ordine
const submitOrderButton = document.getElementById('submit-order');
submitOrderButton.addEventListener('click', submitOrder);

function submitOrder() {
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const notesInput = document.getElementById('notes');

    // Validazione
    if (!nameInput.value.trim()) {
        showNotification('Per favore, inserisci il tuo nome', 'error');
        nameInput.focus();
        return;
    }

    if (!phoneInput.value.trim()) {
        showNotification('Per favore, inserisci il tuo numero di telefono', 'error');
        phoneInput.focus();
        return;
    }

    // Prepara i dati dell'ordine
    const location = locationsData.find(l => l.number == selectedLocation);

    const order = {
        date: new Date().toISOString(),
        customer: {
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim()
        },
        location: {
            id: selectedLocation,
            name: location ? `Postazione ${location.number} - ${location.name}` : `Postazione ${selectedLocation}`
        },
        items: cart,
        notes: notesInput.value.trim(),
        status: 'pending',
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };

    // Salva l'ordine in Firebase
    const ordersRef = ref(database, 'orders');
    const newOrderRef = push(ordersRef);

    set(newOrderRef, order)
        .then(() => {
            // Mostra il numero dell'ordine e la data
            document.getElementById('orderNumber').textContent = `Numero ordine: ${newOrderRef.key}`;
            document.getElementById('orderDateTime').textContent = `Data: ${new Date().toLocaleString('it-IT')}`;

            // Passa alla pagina di successo
            goToStep(4);

            // Svuota il carrello
            cart = [];
            updateCartCount();
        })
        .catch((error) => {
            showNotification(`Errore: ${error.message}`, 'error');
        });
};

// Torna alla home
function startOver() {
    // Reset all fields
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('notes').value = '';

    // Reset selected location
    selectedLocation = null;

    // Reset cart
    cart = [];
    updateCartCount();

    // Go to step 1
    goToStep(1);
};

// Inizializzazione al caricamento della pagina
document.addEventListener('DOMContentLoaded', function() {
    // Carica le postazioni
    loadLocations();

    // Carica i prodotti
    loadProducts();

    // Setup keyboard handlers for modal
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const cartModal = document.getElementById('cartModal');
            if (cartModal.style.display === 'flex') {
                toggleCart();
            }
        }
    });

    // Close modal if clicked outside
    document.getElementById('cartModal').addEventListener('click', function(event) {
        if (event.target === this) {
            toggleCart();
        }
    });
});