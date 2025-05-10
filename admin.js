import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, remove, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// **IMPORTANTE:** Inserisci qui la configurazione del tuo progetto Firebase (quella che hai copiato al Passo 1.2)
const firebaseConfig = {
  apiKey: "AIzaSyBAvAUrRTJzqKV23BD0A8Lai-8KiJ6KVZY",
  authDomain: "picnic-4467e.firebaseapp.com",
  databaseURL: "https://picnic-4467e-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "picnic-4467e",
  storageBucket: "picnic-4467e.firebasestorage.app",
  messagingSenderId: "489863127350",
  appId: "1:489863127350:web:26ad1b1647489b06e31397"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Variabili globali per i dati
let orders = [];
let products = [];
let locations = [];

// Funzione per mostrare le notifiche
function showNotification(message, type = 'success') {
    const notificationContainer = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.classList.add('notification', type, 'show');
    notification.textContent = message;
    notificationContainer.appendChild(notification);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300); // Remove after fade out
    }, 3000);
}

// *** Autenticazione ***

// Gestione del login
const loginForm = document.getElementById('login-form');
const loginContainer = document.getElementById('login-container');
const dashboard = document.getElementById('dashboard');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');

loginButton.addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Login successful (ma non sappiamo ancora se è admin)
            loginError.style.display = 'none';
        })
        .catch((error) => {
            console.error("Errore durante il login:", error);
            loginError.textContent = "Email o password non validi";
            loginError.style.display = 'block';
        });
});

// Gestione dello stato di autenticazione (e verifica admin)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Utente loggato, verifica se è admin
        checkIfAdmin(user.uid)
            .then(isAdmin => {
                if (isAdmin) {
                    // È un admin, mostra il dashboard
                    loginContainer.style.display = 'none';
                    dashboard.style.display = 'block';
                    loadDashboardData();
                    loadOrders();
                    loadProducts();
                    loadLocations();
                } else {
                    // Non è un admin, mostra errore e fai il logout
                    showNotification("Non sei autorizzato ad accedere a questa pagina.", 'error');
                    signOut(auth); // Forza il logout
                }
            });
    } else {
        // Utente non loggato, mostra il form di login
        loginContainer.style.display = 'block';
        dashboard.style.display = 'none';
    }
});

// Funzione per verificare se un utente è admin
async function checkIfAdmin(uid) {
    const adminRef = ref(database, `admins/${uid}`);
    const snapshot = await get(adminRef);
    return snapshot.exists() && snapshot.val() === true;
}

// Gestione del logout
const logoutButton = document.getElementById('logout-button');
logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
        // Logout successful (onAuthStateChanged gestirà la visualizzazione del form di login)
        showNotification("Logout effettuato con successo.", 'success');
    }).catch((error) => {
        console.error("Errore durante il logout:", error);
        showNotification("Errore durante il logout.", 'error');
    });
});

// *** Navigazione Pagine ***

// Gestione della navigazione tra le pagine
const sidebarMenu = document.querySelector('.sidebar-menu');
const pages = document.querySelectorAll('.page');

sidebarMenu.addEventListener('click', (event) => {
    const target = event.target.closest('a');
    if (target) {
        event.preventDefault(); // Prevents default link behavior
        const pageId = target.dataset.page;
        if (pageId) {
            showPage(pageId);
        }
    }
});

function showPage(pageId) {
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');

    // Update active class in sidebar
    document.querySelectorAll('.sidebar-menu a').forEach(link => link.classList.remove('active'));
    document.querySelector(`.sidebar-menu a[data-page="${pageId}"]`).classList.add('active');

    // Load data if needed
    if (pageId === 'dashboard-page') {
        loadDashboardData();
    } else if (pageId === 'orders-page') {
        loadOrders();
    } else if (pageId === 'products-page') {
        loadProducts();
    } else if (pageId === 'locations-page') {
        loadLocations();
    }
}

// *** Funzioni Dashboard ***

// Carica i dati del dashboard
function loadDashboardData() {
    const loader = document.getElementById('dashboard-loader');
    loader.style.display = 'block';

    const statsContainer = document.getElementById('dashboard-stats');

    // Reference agli ordini
    const ordersRef = ref(database, 'orders');

    // Ottieni i dati in tempo reale
    onValue(ordersRef, (snapshot) => {
        const data = snapshot.val();
        const orders = data ? Object.values(data) : [];

        // Statistiche di base
        const pendingOrders = orders.filter(order => order.status === 'pending').length;
        const completedOrders = orders.filter(order => order.status === 'completed').length;
        const totalRevenue = orders
            .filter(order => order.status !== 'cancelled')
            .reduce((sum, order) => sum + (order.total || 0), 0);

        // Reference ai prodotti e postazioni
        const productsRef = ref(database, 'products');
        const locationsRef = ref(database, 'locations');

        // Ottieni conteggio prodotti
        get(productsRef).then((productsSnapshot) => {
            const productsCount = productsSnapshot.exists() ? Object.keys(productsSnapshot.val()).length : 0;

            // Ottieni conteggio postazioni
            get(locationsRef).then((locationsSnapshot) => {
                const locationsCount = locationsSnapshot.exists() ? Object.keys(locationsSnapshot.val()).length : 0;

                // Calcola data odierna per ordini di oggi
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayTimestamp = today.toISOString();

                const todayOrders = orders.filter(order => {
                    const orderDate = new Date(order.date);
                    orderDate.setHours(0, 0, 0, 0);
                    return orderDate.toISOString() === todayTimestamp;
                }).length;

                // Costruisci il contenuto HTML per le statistiche
                const statsHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 2rem;">
                        <div class="card" style="text-align: center; padding: 1rem;">
                            <h3><span class="math-inline">\{pendingOrders\}</h3\>
<p\>Ordini in attesa</p\>
</div\>
<div class\="card" style\="text\-align\: center; padding\: 1rem;"\>
<h3\></span>{completedOrders}</h3>
                            <p>Ordini completati</p>
                        </div>
                        <div class="card" style="text-align: center; padding: 1rem;">
                            <h3><span class="math-inline">\{todayOrders\}</h3\>
<p\>Ordini di oggi</p\>
</div\>
<div class\="card" style\="text\-align\: center; padding\: 1rem;"\>
<h3\>€</span>{totalRevenue.toFixed(2)}</h3>
                            <p>Incasso totale</p>
                        </div>
                        <div class="card" style="text-align: center; padding: 1rem;">
                            <h3><span class="math-inline">\{productsCount\}</h3\>
<p\>Prodotti attivi</p\>
</div\>
<div class\="card" style\="text\-align\: center; padding\: 1rem;"\>
<h3\></span>{locationsCount}</h3>
                            <p>Postazioni totali</p>
                        </div>
                    </div>
                    
                    <h3 style="margin-top: 2rem;">Ultimi Ordini</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>ID Ordine</th>
                                <th>Cliente</th>
                                <th>Totale</th>
                                <th>Stato</th>
                                <th>Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orders.slice(0, 5).map(order => `
                                <tr>
                                    <td>${order.id}</td>
                                    <td>${order.customer.name}</td>
                                    <td>€${order.total.toFixed(2)}</td>
                                    <td>
                                        <span class="order-status ${order.status}">
                                            ${order.status === 'pending' ? 'In attesa' : 
                                              order.status === 'completed' ? 'Completato' : 'Annullato'}
                                        </span>
                                    </td>
                                    <td>${new Date(order.date).toLocaleString('it-IT')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                statsContainer.innerHTML = statsHTML;
                loader.style.display = 'none';
            });
        });
    };

// *** Funzioni Ordini ***

// Carica gli ordini
function loadOrders() {
    const loader = document.getElementById('orders-loader');
    loader.style.display = 'block';

    const ordersList = document.getElementById('ordersList');

    // Reference agli ordini
    const ordersRef = ref(database, 'orders');

    // Ottieni i dati in tempo reale
    onValue(ordersRef, (snapshot) => {
        const data = snapshot.val();
        orders = data ? Object.entries(data).map(([key, value]) => ({
            ...value,
            firebaseKey: key
        })) : [];

        // Ordina gli ordini per data (più recenti prima)
        orders.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Applica i filtri correnti
        filterOrders();

        loader.style.display = 'none';
    });
};

// Filtra gli ordini
function filterOrders() {
    const statusFilter = document.getElementById('order-status-filter').value;
    const dateFilter = document.getElementById('order-date-filter').value;

    let filteredOrders = [...orders];

    // Filtra per stato
    if (statusFilter !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
    }

    // Filtra per data
    if (dateFilter) {
        const filterDate = new Date(dateFilter);
        filterDate.setHours(0, 0, 0, 0);

        filteredOrders = filteredOrders.filter(order => {
            const orderDate = new Date(order.date);
            orderDate.setHours(0, 0, 0, 0);
            return orderDate.toISOString() === filterDate.toISOString();
        });
    }

    // Aggiorna la visualizzazione
    displayOrders(filteredOrders);
};

// Visualizza gli ordini filtrati
function displayOrders(orders) {
    const ordersList = document.getElementById('ordersList');

    if (orders.length === 0) {
        ordersList.innerHTML = '<p>Nessun ordine trovato.</p>';
        return;
    }

    let ordersHTML = '';

    orders.forEach(order => {
        const statusText = order.status === 'pending' ? 'In attesa' :
                          order.status === 'completed' ? 'Completato' : 'Annullato';

        ordersHTML += `
            <div class="order-card">
                <div class="order-header">
                    <div class="order-id"><span class="math-inline">\{order\.id\}</div\>
<div class\="order\-date"\></span>{new Date(order.date).toLocaleString('it-IT')}</div>
                    <div class="order-status <span class="math-inline">\{order\.status\}"\></span>{statusText}</div>
                </div>
                <div class="order-details">
                    <div class="order-customer">
                        <strong>Cliente:</strong> ${order.customer.name} | <strong>Telefono:</strong> ${order.customer.phone}
                    </div>
                    <div class="order-location">
                        <strong>Postazione:</strong> <span class="math-inline">\{order\.location\.name\}
</div\>
<div class\="order\-total"\>
<strong\>Totale\:</strong\> €</span>{order.total.toFixed(2)}
                    </div>
                    ${order.notes ? `<div class="order-notes"><strong>Note:</strong> ${order.notes}</div>` : ''}
                </div>
                <div class="order-actions">
                    <button onclick="viewOrderDetails('${order.firebaseKey}')">Dettagli</button>
                    ${order.status === 'pending' ? `
                        <button onclick="updateOrderStatus('${order.firebaseKey}', 'completed')" style="background-color: #2E7D32;">Completa</button>
                        <button onclick="updateOrderStatus('${order.firebaseKey}', 'cancelled')" style="background-color: #c62828;">Annulla</button>
                    ` : ''}
                </div>
            </div>
        `;
    });

    ordersList.innerHTML = ordersHTML;
};

// Visualizza i dettagli dell'ordine in un modal
function viewOrderDetails(orderKey) {
    const order = orders.find(o => o.firebaseKey === orderKey);

    if (!order) return;

    const modal = document.getElementById('orderModal');
    const modalContent = document.getElementById('orderModalContent');

    const statusText = order.status === 'pending' ? 'In attesa' : 
                      order.status === 'completed' ? 'Completato' : 'Annullato';

    let itemsHTML = '';
    order.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        itemsHTML += `
            <tr>
                <td><span class="math-inline">\{item\.name\}</td\>
<td\></span>{item.quantity}</td>
                <td>€<span class="math-inline">\{item\.price\.toFixed\(2\)\}</td\>
<td\>€</span>{itemTotal.toFixed(2)}</td>
            </tr>
        `;
    });

    modalContent.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <p><strong>ID Ordine:</strong> ${order.id}</p>
            <p><strong>Data:</strong> ${new Date(order.date).toLocaleString('it-IT')}</p>
            <p><strong>Stato:</strong> <span class="order-status <span class="math-inline">\{order\.status\}"\></span>{statusText}</span></p>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <h4>Informazioni Cliente</h4>
            <p><strong>Nome:</strong> ${order.customer.name}</p>
            <p><strong>Telefono:</strong> <span class="math-inline">\{order\.customer\.phone\}</p\>
</div\>
<div style\="margin\-bottom\: 1\.5rem;"\>
<h4\>Postazione</h4\>
<p\></span>{order.location.name}</p>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <h4>Prodotti Ordinati</h4>
            <table>
                <thead>
                    <tr>
                        <th>Prodotto</th>
                        <th>Quantità</th>
                        <th>Prezzo Unitario</th>
                        <th>Totale</th>
                    </tr>
                </thead>
                <tbody>
                    <span class="math-inline">\{itemsHTML\}
</tbody\>
<tfoot\>
<tr\>
<td colspan\="3" style\="text\-align\: right;"\><strong\>Totale Ordine\:</strong\></td\>
<td\><strong\>€</span>{order.total.toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>
        
        ${order.notes ? `
        <div style="margin-bottom: 1.5rem;">
            <h4>Note</h4>
            <p>${order.notes}</p>
        </div>
        ` : ''}
        
        ${order.status === 'pending' ? `
        <div style="text-align: right; margin-top: 1rem;">
            <button onclick="updateOrderStatus('${order.firebaseKey}', 'completed')" style="background-color: #2E7D32;">Completa Ordine</button>
            <button onclick="updateOrderStatus('${order.firebaseKey}', 'cancelled')" style="background-color: #c62828;">Annulla Ordine</button>
        </div>
        ` : ''}
    `;

    modal.style.display = 'block';
};

// Aggiorna lo stato dell'ordine
function updateOrderStatus(orderKey, newStatus) {
    const orderRef = ref(database, `orders/${orderKey}`);

    update(orderRef, {
        status: newStatus
    }).then(() => {
        // Chiudi modal se aperto
        document.getElementById('orderModal').style.display = 'none';

        // Mostra messaggio di successo
        showNotification(`Stato dell'ordine aggiornato a: ${newStatus === 'completed' ? 'Completato' : 'Annullato'}`);
    }).catch((error) => {
        console.error("Errore durante l'aggiornamento dello stato:", error);
        showNotification("Si è verificato un errore durante l'aggiornamento dello stato dell'ordine.", 'error');
    });
};

// *** Funzioni Prodotti ***

const showProductFormButton = document.getElementById('show-product-form-button');
const hideProductFormButton = document.getElementById('hide-product-form-button');
const saveProductButton = document.getElementById('save-product-button');

showProductFormButton.addEventListener('click', showProductForm);
hideProductFormButton.addEventListener('click', hideProductForm);
saveProductButton.addEventListener('click', saveProduct);

// Carica i prodotti
function loadProducts() {
    const loader = document.getElementById('products-loader');
    loader.style.display = 'block';

    const productsList = document.getElementById('productsList');

    // Reference ai prodotti
    const productsRef = ref(database, 'products');

    // Ottieni i dati in tempo reale
    onValue(productsRef, (snapshot) => {
        const data = snapshot.val();
        products = data ? Object.entries(data).map(([key, value]) => ({
            ...value,
            firebaseKey: key
        })) : [];

        if (products.length === 0) {
            productsList.innerHTML = `
                <p>Nessun prodotto trovato. Aggiungi il tuo primo prodotto!</p>
            `;
        } else {
            let productsHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nome</th>
                            <th>Descrizione</th>
                            <th>Prezzo</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            products.forEach(product => {
                productsHTML += `
                    <tr>
                        <td><span class="math-inline">\{product\.id\}</td\>
<td\></span>{product.name}</td>
                        <td><span class="math-inline">\{product\.description\}</td\>
<td\>€</span>{product.price.toFixed(2)}</td>
                        <td style="white-space: nowrap;">
                            <button onclick="editProduct('<span class="math-inline">\{product\.firebaseKey\}'\)" style\="background\-color\: \#1976D2;"\>Modifica</button\>
<button onclick\="deleteProduct\('</span>{product.firebaseKey}')" style="background-color: #c62828;">Elimina</button>
                        </td>
                    </tr>
                `;
            });

            productsHTML += `
                    </tbody>
                </table>
            `;

            productsList.innerHTML = productsHTML;
        }

        loader.style.display = 'none';
    });
};

// Mostra form prodotto (per aggiunta)
function showProductForm() {
    document.getElementById('product-form').style.display = 'block';
    document.getElementById('product-form-title').textContent = 'Aggiungi Nuovo Prodotto';
    document.getElementById('product-id').value = '';
    document.getElementById('product-name').value = '';
    document.getElementById('product-description').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-image').value = '';
};

// Nascondi form prodotto
function hideProductForm() {
    document.getElementById('product-form').style.display = 'none';
};

// Prepara form per modifica prodotto
function editProduct(productKey) {
    const product = products.find(p => p.firebaseKey === productKey);

    if (!product) return;

    document.getElementById('product-form-title').textContent = 'Modifica Prodotto';
    document.getElementById('product-id').value = productKey;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-description').value = product.description;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-image').value = product.image;

    document.getElementById('product-form').style.display = 'block';
};

// Salva prodotto (nuovo o esistente)
function saveProduct() {
    const productKey = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value;
    const description = document.getElementById('product-description').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const image = document.getElementById('product-image').value;

    // Validazione
    if (!name) {
        showNotification('Il nome del prodotto è obbligatorio!', 'error');
        return;
    }

    if (isNaN(price) || price <= 0) {
        showNotification('Il prezzo deve essere un numero maggiore di zero!', 'error');
        return;
    }

    // Prepara il prodotto
    const product = {
        id: productKey ? products.find(p => p.firebaseKey === productKey).id : generateProductId(),
        name: name,
        description: description,
        price: price,
        image: image || "https://via.placeholder.com/300x200.png?text=" + name.replace(/ /g, '+')
    };

    let productRef;

    if (productKey) {
        // Aggiornamento prodotto esistente
        productRef = ref(database, `products/${productKey}`);
        update(productRef, product)
            .then(() => {
                showNotification('Prodotto aggiornato con successo!');
                hideProductForm();
            })
            .catch((error) => {
                console.error("Errore durante l'aggiornamento del prodotto:", error);
                showNotification("Si è verificato un errore durante l'aggiornamento del prodotto.", 'error');
            });
    } else {
        // Aggiunta nuovo prodotto
        productRef = ref(database, 'products');
        push(productRef, product)
            .then(() => {
                showNotification('Nuovo prodotto aggiunto con successo!');
                hideProductForm();
            })
            .catch((error) => {
                console.error("Errore durante l'aggiunta del prodotto:", error);
                showNotification("Si è verificato un errore durante l'aggiunta del prodotto.", 'error');
            });
    }
};

// Elimina prodotto
function deleteProduct(productKey) {
    if (confirm('Sei sicuro di voler eliminare questo prodotto?')) {
        const productRef = ref(database, `products/${productKey}`);

        remove(productRef)
            .then(() => {
                showNotification('Prodotto eliminato con successo!');
            })
            .catch((error) => {
                console.error("Errore durante l'eliminazione del prodotto:", error);
                showNotification("Si è verificato un errore durante l'eliminazione del prodotto.", 'error');
            });
    }
};

// Genera ID prodotto
function generateProductId() {
    const maxId = products.length > 0
        ? Math.max(...products.map(p => parseInt(p.id)))
        : 0;
    return maxId + 1;
};

// *** Funzioni Postazioni ***

const showLocationFormButton = document.getElementById('show-location-form-button');
const hideLocationFormButton = document.getElementById('hide-location-form-button');
const saveLocationButton = document.getElementById('save-location-button');

showLocationFormButton.addEventListener('click', showLocationForm);
hideLocationFormButton.addEventListener('click', hideLocationForm);
saveLocationButton.addEventListener('click', saveLocation);

// Carica le postazioni
function loadLocations() {
    const loader = document.getElementById('locations-loader');
    loader.style.display = 'block';

    const locationsList = document.getElementById('locationsList');

    // Reference alle postazioni
    const locationsRef = ref(database, 'locations');

    // Ottieni i dati in tempo reale
    onValue(locationsRef, (snapshot) => {
        const data = snapshot.val();
        locations = data ? Object.entries(data).map(([key, value]) => ({
            ...value,
            firebaseKey: key
        })) : [];

        // Ordina le postazioni per numero
        locations.sort((a, b) => a.number - b.number);

        if (locations.length === 0) {
            locationsList.innerHTML = `
                <p>Nessuna postazione trovata. Aggiungi la tua prima postazione!</p>
            `;
        } else {
            let locationsHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Numero</th>
                            <th>Nome/Descrizione</th>
                            <th>Stato</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            locations.forEach(location => {
                const statusText = location.status === 'available' ? 'Disponibile' :
                    location.status === 'maintenance' ? 'In Manutenzione' : 'Riservata';

                const statusClass = location.status === 'available' ? 'completed' :
                    location.status === 'maintenance' ? 'cancelled' : 'pending';

                locationsHTML += `
                    <tr>
                        <td><span class="math-inline">\{location\.number\}</td\>
<td\></span>{location.name}</td>
                        <td><span class="order-status <span class="math-inline">\{statusClass\}"\></span>{statusText}</span></td>
                        <td style="white-space: nowrap;">
                            <button onclick="editLocation('<span class="math-inline">\{location\.firebaseKey\}'\)" style\="background\-color\: \#1976D2;"\>Modifica</button\>
<button onclick\="deleteLocation\('</span>{location.firebaseKey}')" style="background-color: #c62828;">Elimina</button>
                        </td>
                    </tr>
                `;
            });

            locationsHTML += `
                    </tbody>
                </table>
            `;

            locationsList.innerHTML = locationsHTML;
        }

        loader.style.display = 'none';
    });
};

// Mostra form postazione (per aggiunta)
function showLocationForm() {
    document.getElementById('location-form').style.display = 'block';
    document.getElementById('location-form-title').textContent = 'Aggiungi Nuova Postazione';
    document.getElementById('location-id').value = '';
    document.getElementById('location-number').value = '';
    document.getElementById('location-name').value = '';
    document.getElementById('location-status').value = 'available';
};

// Nascondi form postazione
function hideLocationForm() {
    document.getElementById('location-form').style.display = 'none';
};

// Prepara form per modifica postazione
function editLocation(locationKey) {
    const location = locations.find(l => l.firebaseKey === locationKey);

    if (!location) return;

    document.getElementById('location-form-title').textContent = 'Modifica Postazione';
    document.getElementById('location-id').value = locationKey;
    document.getElementById('location-number').value = location.number;
    document.getElementById('location-name').value = location.name;
    document.getElementById('location-status').value = location.status || 'available';

    document.getElementById('location-form').style.display = 'block';
};

// Salva postazione (nuova o esistente)
function saveLocation() {
    const locationKey = document.getElementById('location-id').value;
    const number = parseInt(document.getElementById('location-number').value);
    const name = document.getElementById('location-name').value;
    const status = document.getElementById('location-status').value;

    // Validazione
    if (isNaN(number) || number <= 0) {
        showNotification('Il numero della postazione deve essere un numero maggiore di zero!', 'error');
        return;
    }

    if (!name) {
        showNotification('Il nome/descrizione della postazione è obbligatorio!', 'error');
        return;
    }

    // Verifica che non ci sia già una postazione con lo stesso numero
    if (!locationKey) {
        const existingLocation = locations.find(l => l.number === number);
        if (existingLocation) {
            showNotification(`Esiste già una postazione con il numero ${number}. Scegli un altro numero!`, 'error');
            return;
        }
    }

    // Prepara la postazione
    const location = {
        number: number,
        name: name,
        status: status
    };

    let locationRef;

    if (locationKey) {
        // Aggiornamento postazione esistente
        locationRef = ref(database, `locations/${locationKey}`);
        update(locationRef, location)
            .then(() => {
                showNotification('Postazione aggiornata con successo!');
                hideLocationForm();
            })
            .catch((error) => {
                console.error("Errore durante l'aggiornamento della postazione:", error);
                showNotification("Si è verificato un errore durante l'aggiornamento della postazione.", 'error');
            });
    } else {
        // Aggiunta nuova postazione
        locationRef = ref(database, 'locations');
        push(locationRef, location)
            .then(() => {
                showNotification('Nuova postazione aggiunta con successo!');
                hideLocationForm();
            })
            .catch((error) => {
                console.error("Errore durante l'aggiunta della postazione:", error);
                showNotification("Si è verificato un errore durante l'aggiunta della postazione.", 'error');
            });
    }
};

// Elimina postazione
function deleteLocation(locationKey) {
    if (confirm('Sei sicuro di voler eliminare questa postazione?')) {
        const locationRef = ref(database, `locations/${locationKey}`);

        remove(locationRef)
            .then(() => {
                showNotification('Postazione eliminata con successo!');
            })
            .catch((error) => {
                console.error("Errore durante l'eliminazione della postazione:", error);
                showNotification("Si è verificato un errore durante l'eliminazione della postazione.", 'error');
            });
    }
};

// Inizializza la pagina caricando i dati del dashboard all'apertura
document.addEventListener('DOMContentLoaded', function() {
    // Aggiungiamo un ascoltatore per il tasto Invio nella pagina di login
    document.getElementById('password').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            loginButton.click(); // Simula un click sul pulsante di login
        }
    });
});
}

{
type: uploaded file
fileName: client.css
fullText:
:root {
    /* Colori Agricola Guss */
    --primary-color: #5A6F41;
    /* Verde oliva/salvia */
    --primary-dark: #