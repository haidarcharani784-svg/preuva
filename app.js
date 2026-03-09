/**
 * FabriControl Pro - Core Logic
 */

// --- Configuration & Constants ---
const PHASES = [
    { id: 'cortador', name: 'Cortador', icon: '🔪', order: 1 },
    { id: 'guarnicion', name: 'Guarnición', icon: '🧵', order: 2 },
    { id: 'solador', name: 'Solador', icon: '👟', order: 3 },
    { id: 'acabado', name: 'Acabado', icon: '�', order: 4 },
    { id: 'almacen_dist', name: 'Almacén Final', icon: '🏢', order: 5 }
];

// --- Encryption Module ---
const ENCRYPTION_KEY = 'ChSh@FbCtrl2026!$ecure#Key';

const encryptData = (data) => {
    try {
        const jsonStr = JSON.stringify(data);
        let encrypted = '';
        for (let i = 0; i < jsonStr.length; i++) {
            const charCode = jsonStr.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
            encrypted += String.fromCharCode(charCode);
        }
        return btoa(unescape(encodeURIComponent(encrypted)));
    } catch (e) {
        return JSON.stringify(data);
    }
};

const decryptData = (encStr) => {
    try {
        const encrypted = decodeURIComponent(escape(atob(encStr)));
        let decrypted = '';
        for (let i = 0; i < encrypted.length; i++) {
            const charCode = encrypted.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
            decrypted += String.fromCharCode(charCode);
        }
        return JSON.parse(decrypted);
    } catch (e) {
        // Fallback: try parsing as unencrypted JSON (migration)
        try { return JSON.parse(encStr); } catch (e2) { return null; }
    }
};

const loadEncrypted = (key, fallback) => {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    // Try decrypting first, then fallback to plain JSON (for migration)
    const decrypted = decryptData(raw);
    return decrypted !== null ? decrypted : fallback;
};

const hashPassword = (pass) => {
    let hash = 0;
    const str = pass + ENCRYPTION_KEY;
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return 'h$' + Math.abs(hash).toString(36);
};

// --- State Management ---
let state = {
    orders: loadEncrypted('fcp_orders', []),
    materials: loadEncrypted('fcp_materials', []),
    tasks: loadEncrypted('fcp_tasks', []),
    trash: loadEncrypted('fcp_trash', []),
    events: loadEncrypted('fcp_events', []),
    sales: loadEncrypted('fcp_sales', []),
    payments: loadEncrypted('fcp_payments', []),
    soleInventory: loadEncrypted('fcp_sole_inventory', { '37': 0, '38': 0, '39': 0, '40': 0, '41': 0, '42': 0 }),
    soleTypes: loadEncrypted('fcp_sole_types', null),
    solePurchases: loadEncrypted('fcp_sole_purchases', []),
    pricePerPair: parseFloat(localStorage.getItem('fcp_price')) || 5.0,
    masterCode: localStorage.getItem('fcp_master_code') || Math.floor(1000 + Math.random() * 9000).toString(),
    users: loadEncrypted('fcp_users', [
        {
            id: 'admin',
            fullName: 'Administrador Principal',
            user: 'obeida',
            pass: '1234',
            status: 'activo',
            role: 'admin',
            lastLogin: null,
            permissions: ['dashboard', 'orders', 'warehouse', 'tasks', 'payroll', 'personnel', 'trash', 'access']
        }
    ]),
    currentUser: loadEncrypted('fcp_current_user', null)
};

// Migrate legacy sole inventory to new soleTypes
if (!state.soleTypes) {
    state.soleTypes = [{
        id: 'default_sole',
        name: 'Suela General',
        sizes: state.soleInventory
    }];
}

// Migración: crear tareas de Pintura para órdenes existentes con pintarSuela que no la tienen aún
state.orders.forEach(order => {
    if (order.processes?.pintarSuela) {
        const yaExiste = state.tasks.some(t => t.orderId === order.id && t.phaseId === 'pintura');
        if (!yaExiste) {
            state.tasks.push({
                id: (Math.random().toString(36).substr(2, 9)),
                orderId: order.id,
                orderNum: order.num,
                model: order.model,
                phaseId: 'pintura',
                phaseName: 'Pintura',
                phaseIcon: '🖌️',
                order: 99,
                pairs: order.pairs,
                status: 'pendiente',
                assignedTo: null,
                finishedAt: null,
                payment: 0,
                paid: false,
                extraTask: true
            });
        }
    }
});

// Migración: autorizar órdenes antiguas bloqueadas
state.orders.forEach(order => {
    if (order.status === 'sin_autorizar') {
        order.status = 'en_proceso';
        const tasks = state.tasks.filter(t => t.orderId === order.id).sort((a, b) => a.order - b.order);
        const first = tasks.find(t => t.status === 'bloqueada');
        if (first) first.status = 'pendiente';
    }
});

const saveState = () => {
    localStorage.setItem('fcp_orders', encryptData(state.orders));
    localStorage.setItem('fcp_materials', encryptData(state.materials));
    localStorage.setItem('fcp_tasks', encryptData(state.tasks));
    localStorage.setItem('fcp_trash', encryptData(state.trash));
    localStorage.setItem('fcp_sales', encryptData(state.sales));
    localStorage.setItem('fcp_payments', encryptData(state.payments));
    localStorage.setItem('fcp_sole_inventory', encryptData(state.soleInventory));
    localStorage.setItem('fcp_sole_types', encryptData(state.soleTypes));
    localStorage.setItem('fcp_sole_purchases', encryptData(state.solePurchases));
    localStorage.setItem('fcp_price', encryptData(state.pricePerPair));
    localStorage.setItem('fcp_users', encryptData(state.users));
    localStorage.setItem('fcp_current_user', encryptData(state.currentUser));
    localStorage.setItem('fcp_master_code', state.masterCode);
};

// --- Utilities ---
const uid = () => Math.random().toString(36).substr(2, 9);
const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

const notify = (msg, type = 'success') => {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    toastMsg.textContent = msg;
    toast.style.backgroundColor = type === 'success' ? '#1e293b' : '#ef4444';
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.transform = 'translateY(100px)';
        toast.style.opacity = '0';
    }, 3000);
};

const addEvent = (desc, type = 'info') => {
    state.events.unshift({ id: uid(), desc, type, time: new Date().toISOString() });
    if (state.events.length > 20) state.events.pop();
    saveState();
    if (currentPage === 'dashboard') renderDashboard();
};

// --- Feature: Area Warehouses (Intermediate Inventory) ---
/**
 * Calcula cuántos pares están listos en la fase anterior pero no han sido tomados por la fase actual.
 */
const getIncomingStock = (phaseId) => {
    const phaseIdx = PHASES.findIndex(p => p.id === phaseId);
    if (phaseIdx <= 0) return 0; // Primera fase no tiene stock entrante

    const prevPhase = PHASES[phaseIdx - 1];

    // Pares terminados en la fase anterior
    const totalFinishedPrev = state.tasks
        .filter(t => t.phaseId === prevPhase.id && t.status === 'terminada')
        .reduce((sum, t) => sum + t.pairs, 0);

    // Pares ya iniciados o terminados en la fase actual
    const totalTakenByCurrent = state.tasks
        .filter(t => t.phaseId === phaseId && (t.status === 'en_proceso' || t.status === 'terminada' || t.status === 'pendiente'))
        .reduce((sum, t) => sum + t.pairs, 0);

    return Math.max(0, totalFinishedPrev - totalTakenByCurrent);
};

const getAreaInventorySummary = () => {
    return PHASES.map((p, idx) => {
        const incoming = getIncomingStock(p.id);
        const inProcess = state.tasks
            .filter(t => t.phaseId === p.id && (t.status === 'en_proceso' || t.status === 'pendiente'))
            .reduce((sum, t) => sum + t.pairs, 0);
        const finished = state.tasks
            .filter(t => t.phaseId === p.id && t.status === 'terminada')
            .reduce((sum, t) => sum + t.pairs, 0);

        return {
            ...p,
            incoming,
            inProcess,
            finished,
            isLast: idx === PHASES.length - 1
        };
    });
};

// --- Feature: Authentication & Permissions ---
const handleLogin = (e) => {
    e.preventDefault();
    const user = document.getElementById('loginUsername').value;
    const pass = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');

    const found = state.users.find(u => u.user === user && u.pass === pass);
    if (found) {
        state.currentUser = found;
        found.lastLogin = new Date().toISOString();
        saveState();
        errorMsg.style.display = 'none';
        applyPermissions();
        checkSession();
        notify(`Bienvenido, ${found.user}`);
    } else {
        errorMsg.style.display = 'block';
    }
};

const logout = () => {
    state.currentUser = null;
    saveState();
    checkSession();
};

const checkSession = () => {
    const layout = document.getElementById('appLayout');
    const loginOverlay = document.getElementById('loginOverlay');

    if (!state.currentUser) {
        if (layout) layout.style.display = 'none';
        if (loginOverlay) loginOverlay.style.display = 'flex';
        return;
    }

    if (loginOverlay) loginOverlay.style.display = 'none';
    if (layout) layout.style.display = 'flex';

    document.getElementById('currentUserName').textContent = state.currentUser.user;
    document.getElementById('currentUserRole').textContent = state.currentUser.role === 'admin' ? 'Administrador' : `Área: ${PHASES.find(p => p.id === state.currentUser.role)?.name || state.currentUser.role}`;

    const initialEl = document.getElementById('currentUserInitial');
    if (initialEl && state.currentUser.user) {
        initialEl.textContent = state.currentUser.user.charAt(0).toUpperCase();
    }

    // Sync top-bar user badge
    const topBarAvatar = document.getElementById('topBarUserAvatar');
    const topBarName = document.getElementById('topBarUserName');
    if (topBarAvatar && state.currentUser.user) {
        topBarAvatar.textContent = state.currentUser.user.charAt(0).toUpperCase();
    }
    if (topBarName) {
        topBarName.textContent = state.currentUser.user;
    }

    applyPermissions();
    if (state.currentUser.role !== 'admin' && !state.currentUser.permissions?.includes('dashboard') && state.currentUser.permissions?.includes('tasks')) {
        navigate('tasks');
    } else {
        navigate('dashboard');
    }
};


const applyPermissions = () => {
    if (!state.currentUser) return;

    const isAdmin = state.currentUser.role === 'admin';
    const userPermissions = state.currentUser.permissions || [];

    // Toggle Admin-only Nav Items (Exclude whole pages)
    document.querySelectorAll('.nav-item.admin-only, .plade-card.admin-only').forEach(el => {
        el.style.display = isAdmin ? 'flex' : 'none';
    });

    // Special handling for Global Master Code Bar
    const codeBar = document.getElementById('globalMasterCodeBar');
    if (codeBar) {
        codeBar.style.display = (isAdmin || userPermissions.includes('manage_codes')) ? 'flex' : 'none';
    }

    // Permission-based page visibility
    // Workers always have dashboard + tasks(production). Other pages need explicit permission.
    const allPages = ['dashboard', 'orders', 'warehouse', 'tasks', 'payroll', 'personnel', 'trash', 'sales', 'history', 'access'];
    allPages.forEach(page => {
        const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (!nav) return;

        if (isAdmin) {
            nav.style.display = 'flex';
        } else {
            const alwaysAllowed = [];
            const hasAccess = alwaysAllowed.includes(page) || userPermissions.includes(page);
            nav.style.display = hasAccess ? 'flex' : 'none';
        }
    });

    // Hide payment fields from non-admin workers
    document.querySelectorAll('.admin-payment-field').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });

    // If operator (not admin & not observer), they only see their production phase
    if (!isAdmin && state.currentUser.role !== 'observador') {
        activePhase = state.currentUser.role;
    }

    // Hide 'Nueva' / '+ Acciones' buttons if observer globally
    const isObserver = state.currentUser?.role === 'observador';
    const canCreateOrder = state.currentUser?.role === 'admin' || state.currentUser?.role === 'cortador';

    document.querySelectorAll('button').forEach(btn => {
        const t = btn.textContent;
        if (t.includes('Nueva ') || t.includes('Vender') || t.includes('Iniciar Tarea') || t.includes('Registrar') || btn.title?.includes('Agregar')) {
            btn.style.display = isObserver ? 'none' : '';
        }

        // Hide Order Creation buttons for anyone who isn't Admin or Cortador
        if ((t.includes('Nueva Orden') || (t.includes('Nueva') && btn.title?.includes('Agregar'))) && !canCreateOrder) {
            btn.style.display = 'none';
        }
    });
};

// --- Navigation ---
let currentPage = 'dashboard';
const navigate = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${pageId}`);
    if (!pageEl) return;
    pageEl.classList.add('active');

    // Safe: nav item may not exist for all pages
    document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add('active');

    const pathNames = {
        dashboard: 'Dashboard',
        orders: 'Órdenes de Producción',
        warehouse: 'Inventario y Suelas',
        tasks: 'Producción en Curso',
        sales: 'Ventas',
        payroll: 'Control de Nómina',
        trash: 'Papelera de Reciclaje',
        history: 'Historial / Bitácora',
        access: 'Personal y Usuarios'
    };
    document.getElementById('currentPath').textContent = pathNames[pageId] || pageId.charAt(0).toUpperCase() + pageId.slice(1);
    currentPage = pageId;

    // Refresh page content
    renderPage(pageId);
};

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
});

// --- Modal Controls ---
const openModal = (id) => document.getElementById(id).classList.add('active');
const closeModal = (id) => {
    document.getElementById(id).classList.remove('active');
    const form = document.querySelector(`#${id} form`);
    if (form) form.reset();
};

// --- Page Rendering ---
const renderPage = (pageId) => {
    if (!state.currentUser) return;

    // Final check for permissions before rendering
    const isAdmin = state.currentUser.role === 'admin';
    const restrictedPages = ['orders', 'warehouse', 'payroll', 'access'];
    if (restrictedPages.includes(pageId) && !isAdmin) {
        navigate('tasks');
        return;
    }

    switch (pageId) {
        case 'dashboard': renderDashboard(); break;
        case 'orders': renderOrders(); break;
        case 'warehouse': renderWarehouse(); break;
        case 'tasks': renderTasks(); break;
        case 'payroll': renderPayroll(); break;
        case 'trash': renderTrash(); break;
        case 'history': renderHistory(); break;
        case 'access':
            document.getElementById('accessModalTitle').textContent = 'Registro de Usuario y Permisos';
            document.getElementById('accessEditId').value = '';
            renderAccess();
            break;
        case 'sales': renderSales(); break;
    }
};

// --- Feature: Dashboard ---
const renderDashboard = () => {
    document.getElementById('stat-orders').textContent = state.orders.length;
    const completedTasks = state.tasks.filter(t => t.status === 'terminada');
    const totalPairs = completedTasks.reduce((sum, t) => sum + t.pairs, 0);
    document.getElementById('stat-pairs').textContent = totalPairs;

    const lowStock = state.materials.filter(m => m.stock <= m.min).length;
    document.getElementById('stat-materials').textContent = lowStock;

    const log = document.getElementById('eventLog');
    if (state.events.length === 0) {
        log.innerHTML = '<div style="color:var(--text-muted);font-size:0.875rem;padding:8px 0">No hay eventos recientes</div>';
    } else {
        const dotClass = { success: 'event-dot-success', info: 'event-dot-info', warning: 'event-dot-warning', danger: 'event-dot-danger' };
        log.innerHTML = state.events.map(e => `
            <div class="event-item">
                <div class="event-dot ${dotClass[e.type] || 'event-dot-info'}"></div>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:0.875rem;color:var(--text-primary)">${e.desc}</div>
                    <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">${new Date(e.time).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</div>
                </div>
            </div>
        `).join('');
    }
};


const updateOrderInitialPhaseUI = () => {
    const phaseId = document.getElementById('orderInitialPhase').value;
    const workerSelect = document.getElementById('orderCortador');
    const workerLabel = document.getElementById('orderWorkerLabel');
    const phase = PHASES.find(p => p.id === phaseId);

    workerLabel.textContent = phase ? phase.name + ' Asignado' : 'Trabajador Asignado';

    const workers = state.users.filter(u => u.role === phaseId && u.status !== 'inactivo');
    workerSelect.innerHTML = '<option value="">-- Pendiente por asignar --</option>' +
        workers.map(u => `<option value="${u.id}">${u.fullName || u.user}</option>`).join('');

    // Auto-assign and lock for workers creating an order in their phase
    const isAdmin = state.currentUser?.role === 'admin';
    if (!isAdmin && state.currentUser?.role === phaseId) {
        workerSelect.value = state.currentUser.id;
        workerSelect.disabled = true;
    } else {
        workerSelect.disabled = false;
        workerSelect.value = '';
    }
};

// --- Feature: Orders ---
let currentBatch = [];

const openOrderModal = () => {
    currentBatch = [];
    if (document.getElementById('batchContainerWrapper')) document.getElementById('batchContainerWrapper').style.display = 'none';
    if (document.getElementById('btnSubmitBatch')) document.getElementById('btnSubmitBatch').style.display = 'none';
    if (document.getElementById('btnAddToBatch')) document.getElementById('btnAddToBatch').textContent = 'Añadir a la Lista';

    document.getElementById('orderForm').reset();
    document.getElementById('orderEditId').value = '';

    // Populate sole types
    const soleSelect = document.getElementById('orderSoleType');
    soleSelect.innerHTML = state.soleTypes.length === 0 ? '<option value="">-- Sin suelas --</option>' : state.soleTypes.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    setTimeout(updateSolePhotoPreview, 50);

    // Reset process fields
    document.getElementById('bordadoDetail').style.display = 'none';
    document.getElementById('procBordadoCard').style.borderColor = '#e5e7eb';
    document.getElementById('procBordadoCard').style.background = 'white';
    document.getElementById('estampadoDetail').style.display = 'none';
    document.getElementById('procEstampadoCard').style.borderColor = '#e5e7eb';
    document.getElementById('procEstampadoCard').style.background = 'white';
    document.getElementById('pintarSuelaDetail').style.display = 'none';
    document.getElementById('procPintarSuelaCard').style.borderColor = '#e5e7eb';
    document.getElementById('procPintarSuelaCard').style.background = 'white';

    document.getElementById('orderInitialPhase').value = 'cortador';
    updateOrderInitialPhaseUI();

    document.getElementById('orderCortadorPrice').value = state.pricePerPair;
    calculateOrderCortadorTotal();
    openModal('orderModal');
};

const calculateOrderCortadorTotal = () => {
    const pairs = parseInt(document.getElementById('orderPairs').value) || 0;
    const price = parseFloat(document.getElementById('orderCortadorPrice').value) || 0;
    document.getElementById('orderCortadorTotal').textContent = formatCurrency(pairs * price);
};

const calculateTotalPairs = () => {
    let total = 0;
    for (let i = 35; i <= 43; i++) {
        total += parseInt(document.getElementById('sz' + i)?.value) || 0;
    }
    document.getElementById('orderPairsDisplay').textContent = total;
    document.getElementById('orderPairs').value = total;
    calculateOrderCortadorTotal();
};

const updateSolePhotoPreview = () => {
    const soleId = document.getElementById('orderSoleType').value;
    const container = document.getElementById('orderSolePhotoContainer');
    const img = document.getElementById('orderSolePhotoPreview');
    if (!container || !img) return;

    const soleType = state.soleTypes.find(t => t.id === soleId);
    if (soleType && soleType.photo) {
        img.src = soleType.photo;
        container.style.display = 'flex';
    } else {
        container.style.display = 'none';
        img.src = '';
    }
};

const generateMasterCode = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    state.masterCode = pin;
    saveState();

    // Update UI elements
    const display = document.getElementById('globalMasterCodeDisplay');
    if (display) display.textContent = pin;

    notify('Nuevo Código de Verificación generado', 'success');
    return pin;
};

const handleOrderSubmit = async (e) => {
    e.preventDefault();

    const canCreateOrder = state.currentUser?.role === 'admin' || state.currentUser?.role === 'cortador';
    if (!canCreateOrder) {
        notify('Solo los administradores y cortadores pueden crear o modificar órdenes.', 'error');
        return;
    }

    // Read Image if any
    const photoFile = document.getElementById('orderPhoto').files[0];
    let photoData = null;
    if (photoFile) {
        photoData = await readFileAsBase64(photoFile);
    }

    const pintarSuelaPhotoFile = document.getElementById('procPintarSuelaPhoto')?.files[0];
    let pintarSuelaPhotoData = null;
    if (pintarSuelaPhotoFile) {
        pintarSuelaPhotoData = await readFileAsBase64(pintarSuelaPhotoFile);
    }

    let dist = {};
    for (let i = 35; i <= 43; i++) {
        dist[i] = parseInt(document.getElementById('sz' + i)?.value) || 0;
    }

    const editId = document.getElementById('orderEditId').value;

    if (editId) {
        // Updating existing order
        const existingOrder = state.orders.find(o => o.id === editId);
        if (existingOrder) {
            existingOrder.model = document.getElementById('orderModel').value;
            // Let user update pairs only if task generation hasn't deeply progressed? We will allow it for simple corrections.
            const newPairs = parseInt(document.getElementById('orderPairs').value) || 0;
            existingOrder.pairs = newPairs;
            existingOrder.date = document.getElementById('orderDeadline').value;
            existingOrder.notes = document.getElementById('orderNotes').value;
            if (photoData) existingOrder.photo = photoData;
            existingOrder.color = document.getElementById('orderColor').value || '';
            existingOrder.soleType = document.getElementById('orderSoleType').value || null;

            existingOrder.sizeDistribution = dist;

            existingOrder.processes = {
                bordado: document.getElementById('procBordado').checked,
                bordadoDetail: document.getElementById('procBordadoColor').value || '',
                estampado: document.getElementById('procEstampado').checked,
                estampadoDetail: document.getElementById('procEstampadoColor').value || '',
                pintarSuela: document.getElementById('procPintarSuela').checked,
                pintarSuelaDetail: document.getElementById('procPintarSuelaColor').value || '',
                pintarSuelaPhoto: pintarSuelaPhotoData || (existingOrder.processes && existingOrder.processes.pintarSuelaPhoto)
            };

            // Also update tasks pairs since pairs might have changed
            const orderTasks = state.tasks.filter(t => t.orderId === existingOrder.id);
            orderTasks.forEach(t => t.pairs = newPairs);

            saveState();
            closeModal('orderModal');
            renderOrders();
            notify(`Orden ${existingOrder.num} actualizada`);
        }
        return;
    }
    const order = {
        id: uid(),
        num: `ORD-${(state.orders.length + 1).toString().padStart(4, '0')}`,
        model: document.getElementById('orderModel').value,
        pairs: parseInt(document.getElementById('orderPairs').value),
        date: document.getElementById('orderDeadline').value,
        notes: document.getElementById('orderNotes').value,
        photo: photoData,
        color: document.getElementById('orderColor').value || '',
        soleType: document.getElementById('orderSoleType').value || null,
        bagCode: null,
        sizeDistribution: dist,
        processes: {
            bordado: document.getElementById('procBordado').checked,
            bordadoDetail: document.getElementById('procBordadoColor').value || '',
            estampado: document.getElementById('procEstampado').checked,
            estampadoDetail: document.getElementById('procEstampadoColor').value || '',
            pintarSuela: document.getElementById('procPintarSuela').checked,
            pintarSuelaDetail: document.getElementById('procPintarSuelaColor').value || '',
            pintarSuelaPhoto: pintarSuelaPhotoData
        },
        _batchMeta: {
            cortadorId: document.getElementById('orderCortador').value || null,
            cortadorPrice: parseFloat(document.getElementById('orderCortadorPrice').value) || state.pricePerPair,
            initialPhaseId: document.getElementById('orderInitialPhase').value || 'cortador'
        },
        status: 'en_proceso',
        createdAt: new Date().toISOString()
    };

    // Batching logic:
    // If not editing, we add to batch instead of sending directly.
    currentBatch.push(order);
    renderBatchOrders();

    document.getElementById('orderForm').reset();
    document.getElementById('orderColor').value = '';
    // Reset processes visually
    document.getElementById('bordadoDetail').style.display = 'none';
    document.getElementById('procBordadoCard').style.borderColor = '#e5e7eb';
    document.getElementById('procBordadoCard').style.background = 'white';
    document.getElementById('estampadoDetail').style.display = 'none';
    document.getElementById('procEstampadoCard').style.borderColor = '#e5e7eb';
    document.getElementById('procEstampadoCard').style.background = 'white';
    document.getElementById('pintarSuelaDetail').style.display = 'none';
    document.getElementById('procPintarSuelaCard').style.borderColor = '#e5e7eb';
    document.getElementById('procPintarSuelaCard').style.background = 'white';
    if (document.getElementById('procPintarSuelaPhoto')) document.getElementById('procPintarSuelaPhoto').value = '';

    document.getElementById('orderPairsDisplay').textContent = "0";
    document.getElementById('orderPairs').value = "0";
    document.getElementById('orderCortadorPrice').value = state.pricePerPair;
    document.getElementById('orderCortadorTotal').textContent = "$0.00";

    // Focus back to first input
    document.getElementById('orderModel').focus();
    notify('Añadido a la lista. Puedes continuar ingresando el siguiente.', 'success');
};

const renderBatchOrders = () => {
    const list = document.getElementById('batchContainer');
    const wrap = document.getElementById('batchContainerWrapper');
    const count = document.getElementById('batchCount');
    const submitBtn = document.getElementById('btnSubmitBatch');

    if (currentBatch.length === 0) {
        wrap.style.display = 'none';
        submitBtn.style.display = 'none';
        return;
    }

    wrap.style.display = 'block';
    submitBtn.style.display = 'block';
    count.textContent = currentBatch.length;

    list.innerHTML = currentBatch.map((o, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:white; padding:8px 12px; border-radius:6px; border:1px solid #cbd5e1; font-size:0.875rem;">
            <div>
                <strong>${o.model}</strong> <span style="color:var(--text-muted)">(${o.pairs} pares)</span>
            </div>
            <button type="button" class="btn btn-ghost" style="color:#ef4444; padding:4px; margin:0;" onclick="removeBatchOrder(${idx})">&times; Quitar</button>
        </div>
    `).join('');
};

const removeBatchOrder = (idx) => {
    currentBatch.splice(idx, 1);
    renderBatchOrders();
};

const submitBatch = () => {
    if (currentBatch.length === 0) return;

    // Numbering logic dynamically
    let currentMaxNum = state.orders.length;

    currentBatch.forEach(order => {
        currentMaxNum++;
        order.num = `ORD-${currentMaxNum.toString().padStart(4, '0')}`;

        const cortadorId = order._batchMeta.cortadorId;
        const cortadorPrice = order._batchMeta.cortadorPrice;
        const initialPhaseId = order._batchMeta.initialPhaseId;
        const initialPhaseIdx = PHASES.findIndex(p => p.id === initialPhaseId);

        delete order._batchMeta; // Clean up payload
        state.orders.push(order);

        PHASES.forEach((phase, idx) => {
            const isSkipped = idx < initialPhaseIdx;
            const isCurrent = idx === initialPhaseIdx;

            state.tasks.push({
                id: uid(),
                orderId: order.id,
                orderNum: order.num,
                model: order.model,
                phaseId: phase.id,
                phaseName: phase.name,
                phaseIcon: phase.icon,
                order: phase.order,
                pairs: order.pairs,
                status: isSkipped ? 'terminada' : (isCurrent ? (cortadorId ? 'en_proceso' : 'pendiente') : 'bloqueada'),
                assignedTo: isCurrent ? cortadorId : null,
                finishedAt: isSkipped ? new Date().toISOString() : null,
                payment: isCurrent ? (cortadorPrice * order.pairs) : 0,
                paid: isSkipped ? true : false
            });
        });

        // Si la orden tiene el proceso Pintar Suela, generar tarea extra de Pintura
        if (order.processes?.pintarSuela) {
            state.tasks.push({
                id: uid(),
                orderId: order.id,
                orderNum: order.num,
                model: order.model,
                phaseId: 'pintura',
                phaseName: 'Pintura',
                phaseIcon: '🖌️',
                order: 99,
                pairs: order.pairs,
                status: 'pendiente',
                assignedTo: null,
                finishedAt: null,
                payment: 0,
                paid: false,
                extraTask: true
            });
        }
    });

    addEvent(`${currentBatch.length} Órdenes creadas en lote (Esperando Autorización)`, 'success');
    saveState();
    closeModal('orderModal');
    renderOrders();
    notify(`${currentBatch.length} Órdenes guardadas y esperando autorización`);
    currentBatch = [];
};

const editOrder = (id) => {
    if (document.getElementById('batchContainerWrapper')) document.getElementById('batchContainerWrapper').style.display = 'none';
    if (document.getElementById('btnSubmitBatch')) document.getElementById('btnSubmitBatch').style.display = 'none';
    if (document.getElementById('btnAddToBatch')) document.getElementById('btnAddToBatch').textContent = 'Guardar Cambios';

    const order = state.orders.find(o => o.id === id);
    if (!order) return;

    // Setup cortador dropdown just in case
    const cortadorSelect = document.getElementById('orderCortador');
    const cortadores = state.users.filter(u => u.role === 'cortador' && u.status !== 'inactivo');
    cortadorSelect.innerHTML = '<option value="">-- Pendiente por asignar --</option>' +
        cortadores.map(u => `<option value="${u.id}">${u.fullName || u.user}</option>`).join('');

    document.getElementById('orderEditId').value = order.id;
    document.getElementById('orderModel').value = order.model || '';
    document.getElementById('orderPairs').value = order.pairs || 0;
    document.getElementById('orderDeadline').value = order.date || '';
    document.getElementById('orderNotes').value = order.notes || '';
    document.getElementById('orderColor').value = order.color || '';

    const soleSelect = document.getElementById('orderSoleType');
    soleSelect.innerHTML = state.soleTypes.length === 0 ? '<option value="">-- Sin suelas --</option>' : state.soleTypes.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    document.getElementById('orderSoleType').value = order.soleType || (state.soleTypes[0]?.id || '');
    updateSolePhotoPreview();

    // Sizes
    const sizes = order.sizeDistribution || {};
    for (let i = 35; i <= 43; i++) {
        const input = document.getElementById('sz' + i);
        if (input) input.value = sizes[i] || 0;
    }
    calculateTotalPairs();

    // Processes
    const procs = order.processes || {};

    const procB = document.getElementById('procBordado');
    procB.checked = procs.bordado || false;
    document.getElementById('bordadoDetail').style.display = procB.checked ? 'block' : 'none';
    document.getElementById('procBordadoCard').style.borderColor = procB.checked ? '#6366f1' : '#e5e7eb';
    document.getElementById('procBordadoCard').style.background = procB.checked ? '#eef2ff' : 'white';
    document.getElementById('procBordadoColor').value = procs.bordadoDetail || '';

    const procE = document.getElementById('procEstampado');
    procE.checked = procs.estampado || false;
    document.getElementById('estampadoDetail').style.display = procE.checked ? 'block' : 'none';
    document.getElementById('procEstampadoCard').style.borderColor = procE.checked ? '#f59e0b' : '#e5e7eb';
    document.getElementById('procEstampadoCard').style.background = procE.checked ? '#fffbeb' : 'white';
    document.getElementById('procEstampadoColor').value = procs.estampadoDetail || '';

    const procP = document.getElementById('procPintarSuela');
    procP.checked = procs.pintarSuela || false;
    document.getElementById('pintarSuelaDetail').style.display = procP.checked ? 'block' : 'none';
    document.getElementById('procPintarSuelaCard').style.borderColor = procP.checked ? '#10b981' : '#e5e7eb';
    document.getElementById('procPintarSuelaCard').style.background = procP.checked ? '#ecfdf5' : 'white';
    document.getElementById('procPintarSuelaColor').value = procs.pintarSuelaDetail || '';

    openModal('orderModal');
};

const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const checkSolePending = (order) => {
    if (!order || !order.soleType || !order.sizeDistribution) return false;
    if (order.solesDeducted) return false;
    const typeObj = state.soleTypes.find(t => t.id === order.soleType);
    if (!typeObj) return ['Modelo eliminado'];

    const missingSizes = [];
    for (let sz in order.sizeDistribution) {
        const needed = order.sizeDistribution[sz];
        if (needed > 0) {
            const available = typeObj.sizes[sz] || 0;
            if (available < needed) {
                missingSizes.push(`#${sz} (Faltan ${needed - available})`);
            }
        }
    }
    return missingSizes.length > 0 ? missingSizes : false;
};

let showOnlyPendingSoles = false;

const togglePendingSolesFilter = () => {
    showOnlyPendingSoles = !showOnlyPendingSoles;
    const btn = document.getElementById('btnFilterPendingSoles');
    if (showOnlyPendingSoles) {
        btn.style.background = '#fee2e2';
        btn.style.borderColor = '#ef4444';
        btn.innerText = '⚠️ Ocultar Pendientes';
    } else {
        btn.style.background = 'white';
        btn.style.borderColor = '#fca5a5';
        btn.innerText = '⚠️ Suelas Pendientes';
    }
    renderOrders();
};

const updateOrdersStats = (orders) => {
    const t = document.getElementById('stat-ord-total');
    const p = document.getElementById('stat-ord-proceso');
    const w = document.getElementById('stat-ord-pendiente');
    if (t) t.textContent = orders.length;
    if (p) p.textContent = orders.filter(o => o.status === 'en_proceso').length;
    if (w) w.textContent = orders.filter(o => o.status === 'sin_autorizar').length;
};

const buildOrderRow = (o) => {
    const tasks = state.tasks.filter(t => t.orderId === o.id);
    const done = tasks.filter(t => t.status === 'terminada').length;
    const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

    // Progress bar color
    const barColor = progress >= 100 ? 'var(--success-500)'
        : progress >= 60 ? 'var(--brand-500)'
            : progress >= 30 ? 'var(--warning-500)'
                : '#94a3b8';

    // Status badge
    let statusBadge = '';
    if (o.status === 'sin_autorizar') {
        statusBadge = `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font-size:0.7rem;font-weight:700;background:#fffbeb;color:#92400e;border:1px solid #fde68a">
            <span style="width:5px;height:5px;border-radius:50%;background:#f59e0b"></span>En espera
        </span>`;
    } else if (progress >= 100) {
        statusBadge = `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font-size:0.7rem;font-weight:700;background:#dcfce7;color:#166534;border:1px solid #bbf7d0">
            <span style="width:5px;height:5px;border-radius:50%;background:#16a34a"></span>Completada
        </span>`;
    } else {
        statusBadge = `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font-size:0.7rem;font-weight:700;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe">
            <span style="width:5px;height:5px;border-radius:50%;background:var(--brand-500);animation:pulse 1.5s infinite"></span>En proceso
        </span>`;
    }

    // Sole pending badge
    const pendingResult = checkSolePending(o);
    const isSolePending = pendingResult !== false;
    let pendingBadge = '';
    if (isSolePending) {
        const missingText = pendingResult.join(', ');
        pendingBadge = `<div style="display:inline-flex;align-items:flex-start;gap:6px;padding:6px 10px;border-radius:8px;background:#fee2e2;border:1px solid #fca5a5;margin-top:6px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" style="margin-top:1px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
                <div style="font-size:0.7rem;font-weight:700;color:#dc2626">Suela insuficiente</div>
                <div style="font-size:0.68rem;color:#b91c1c;margin-top:1px">${missingText}</div>
            </div>
        </div>`;
    }

    // Process badges
    const procBadges = [
        o.processes?.bordado ? `<span style="background:#ede9fe;color:#5b21b6;padding:2px 7px;border-radius:4px;font-size:0.68rem;font-weight:700">Bordado</span>` : '',
        o.processes?.estampado ? `<span style="background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:4px;font-size:0.68rem;font-weight:700">Estampado</span>` : '',
        o.processes?.pintarSuela ? `<span style="background:#ecfdf5;color:#065f46;padding:2px 7px;border-radius:4px;font-size:0.68rem;font-weight:700">Pintura Suela</span>` : '',
    ].filter(Boolean).join('');

    const sole = state.soleTypes?.find(s => s.id === o.soleType);
    const isAdmin = state.currentUser?.role === 'admin';
    const isObserver = state.currentUser?.role === 'observador';

    return `
        <tr>
            <td>
                <div style="display:flex;flex-direction:column;gap:2px">
                    <code style="font-size:0.82rem;font-weight:700;color:var(--brand-700);background:var(--brand-50);padding:2px 8px;border-radius:5px;letter-spacing:0.02em">${o.num}</code>
                </div>
            </td>
            <td>
                <div style="display:flex;align-items:flex-start;gap:12px">
                    ${o.photo
            ? `<img src="${o.photo}" style="width:44px;height:44px;object-fit:cover;border-radius:10px;border:1.5px solid var(--border-light);flex-shrink:0">`
            : `<div style="width:44px;height:44px;background:linear-gradient(135deg,#eef2ff,#e0e7ff);border-radius:10px;display:grid;place-items:center;flex-shrink:0;color:var(--brand-300)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 16c0-1.5.8-3 2.2-3.8l4.5-3c.8-.5 1.3-1.5 1.3-2.5V4.5c0-.8.8-1.3 1.5-.9l2.2 1.1c.8.4 1.3 1.1 1.5 1.9l.8 3c.4 1.5 1.5 2.6 3 3h.8c.8 0 1.2.7 1.2 1.3v2c0 .7-.5 1.2-1.2 1.2H4.2c-.7 0-1.2-.5-1.2-1.2v-.4z" fill="currentColor" opacity=".3"/></svg></div>`
        }
                    <div style="min-width:0">
                        <div style="font-weight:700;color:var(--text-primary);font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">${o.model}</div>
                        ${o.color ? `<div style="font-size:0.73rem;color:var(--text-secondary);margin-top:1px">Color: <strong>${o.color}</strong></div>` : ''}
                        ${sole ? `<div style="font-size:0.73rem;color:var(--text-muted)">Suela: <strong>${sole.name}</strong></div>` : ''}
                        ${procBadges ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">${procBadges}</div>` : ''}
                        ${pendingBadge}
                    </div>
                </div>
            </td>
            <td>
                <div style="display:flex;flex-direction:column;align-items:flex-start;gap:1px">
                    <span style="font-family:'Outfit',sans-serif;font-size:1.1rem;font-weight:800;color:var(--text-primary);line-height:1">${o.pairs}</span>
                    <span style="font-size:0.68rem;color:var(--text-muted);font-weight:500">pares</span>
                </div>
            </td>
            <td>
                <div style="display:flex;flex-direction:column;gap:5px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
                        <span style="font-size:0.72rem;font-weight:700;color:${barColor}">${progress}%</span>
                        <span style="font-size:0.68rem;color:var(--text-muted)">${done}/${tasks.length} fases</span>
                    </div>
                    <div style="height:7px;background:var(--gray-100);border-radius:99px;overflow:hidden">
                        <div style="height:100%;width:${progress}%;background:${barColor};border-radius:99px;transition:width 0.6s cubic-bezier(0.16,1,0.3,1)"></div>
                    </div>
                </div>
            </td>
            <td>${statusBadge}</td>
            <td>
                <div style="display:flex;flex-direction:column;gap:1px">
                    <span style="font-weight:700;font-size:0.85rem;color:var(--text-primary)">${formatDate(o.date)}</span>
                    ${o.date && new Date(o.date) < new Date() && progress < 100 ? `<span style="font-size:0.68rem;color:var(--danger-500);font-weight:600">Vencida</span>` : ''}
                </div>
            </td>
            <td>
                <div style="display:flex;justify-content:center;gap:6px;flex-wrap:nowrap">
                    ${!isObserver ? `
                    <button onclick="editOrder('${o.id}')" title="Editar" style="width:32px;height:32px;border:1px solid var(--border-light);background:white;border-radius:7px;cursor:pointer;display:grid;place-items:center;color:var(--text-secondary);transition:all 0.15s" onmouseover="this.style.background='var(--brand-50)';this.style.borderColor='var(--brand-300)';this.style.color='var(--brand-600)'" onmouseout="this.style.background='white';this.style.borderColor='var(--border-light)';this.style.color='var(--text-secondary)'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>` : ''}
                    ${isAdmin ? `
                    <button onclick="deleteOrder('${o.id}')" title="Eliminar" style="width:32px;height:32px;border:1px solid var(--border-light);background:white;border-radius:7px;cursor:pointer;display:grid;place-items:center;color:var(--text-secondary);transition:all 0.15s" onmouseover="this.style.background='var(--danger-50)';this.style.borderColor='#fca5a5';this.style.color='var(--danger-600)'" onmouseout="this.style.background='white';this.style.borderColor='var(--border-light)';this.style.color='var(--text-secondary)'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                    </button>` : ''}
                </div>
            </td>
        </tr>
    `;
};

const renderOrders = () => {
    const tbody = document.getElementById('ordersTableBody');
    let ordersToRender = state.orders;

    if (showOnlyPendingSoles) {
        ordersToRender = ordersToRender.filter(o => checkSolePending(o) !== false);
    }

    updateOrdersStats(state.orders);

    if (ordersToRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:60px 20px">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.25;margin:0 auto 12px;display:block"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div style="font-weight:600;font-size:0.9rem">No hay órdenes para mostrar</div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = ordersToRender.map(buildOrderRow).join('');
};

const searchOrders = (query) => {
    const tbody = document.getElementById('ordersTableBody');
    const q = query.toLowerCase();
    const filtered = q
        ? state.orders.filter(o =>
            o.num?.toLowerCase().includes(q) ||
            o.model?.toLowerCase().includes(q) ||
            o.bagCode?.toLowerCase().includes(q) ||
            o.color?.toLowerCase().includes(q)
        )
        : state.orders;
    tbody.innerHTML = filtered.length === 0
        ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">Sin resultados</td></tr>`
        : filtered.map(buildOrderRow).join('');
};


const autorizarOrden = (id) => {
    if (state.currentUser?.role !== 'admin') {
        notify('Solo los administradores pueden autorizar órdenes.', 'error');
        return;
    }
    const order = state.orders.find(o => o.id === id);
    if (!order) return;

    order.status = 'en_proceso';

    const orderTasks = state.tasks.filter(t => t.orderId === id).sort((a, b) => a.order - b.order);
    const firstBlocked = orderTasks.find(t => t.status === 'bloqueada');

    if (firstBlocked) {
        firstBlocked.status = firstBlocked.assignedTo ? 'en_proceso' : 'pendiente';
    }

    addEvent(`Orden ${order.num} autorizada. Pasando a producción.`, 'success');
    saveState();
    renderOrders();
    // Render tasks only if user is on tasks page
    if (currentPage === 'tasks') renderTasks();
    notify(`Orden ${order.num} autorizada exitosamente`);
};

const deleteOrder = (id) => {
    if (state.currentUser?.role !== 'admin') {
        notify('Solo los administradores pueden eliminar registros.', 'error');
        return;
    }
    const idx = state.orders.findIndex(o => o.id === id);
    if (idx !== -1) {
        if (!confirm('¿Eliminar esta orden?')) return;
        const removed = state.orders.splice(idx, 1)[0];

        // Restore inventory if order had soles deducted
        if (removed.solesDeducted && removed.soleType) {
            const typeObj = state.soleTypes.find(t => t.id === removed.soleType);
            if (typeObj && removed.sizeDistribution) {
                let restoredPairs = 0;
                for (let sz in removed.sizeDistribution) {
                    const needed = removed.sizeDistribution[sz];
                    if (needed > 0) {
                        typeObj.sizes[sz] = (typeObj.sizes[sz] || 0) + needed;
                        restoredPairs += needed;
                    }
                }
                if (restoredPairs > 0) {
                    notify(`Se reintegraron ${restoredPairs} pares de suelas al almacén.`, 'info');
                }
            }
        }

        state.trash.push({ type: 'order', data: removed, time: new Date().toISOString() });
        state.tasks = state.tasks.filter(t => t.orderId !== id);

        let trashStatus = removed.status === 'sin_autorizar' ? 'cancelada' : 'cancelada_en_proceso';
        removed.status = trashStatus;

        addEvent(`Orden ${removed.num} cancelada y enviada a papelera`, 'warning');
        saveState();
        renderOrders();
    }
};

// --- Feature: Warehouse ---

const switchWarehouseTab = (tab) => {
    const tabs = ['materiales', 'suelas', 'compras'];
    tabs.forEach(t => {
        const btn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) {
            btn.style.color = tab === t ? 'var(--brand-600)' : 'var(--text-secondary)';
            btn.style.borderBottom = tab === t ? '2px solid var(--brand-600)' : '2px solid transparent';
        }
    });
    document.getElementById('viewMateriales').style.display = tab === 'materiales' ? 'block' : 'none';
    document.getElementById('viewSuelas').style.display = tab === 'suelas' ? 'block' : 'none';
    document.getElementById('viewCompras').style.display = tab === 'compras' ? 'block' : 'none';
    if (tab === 'compras') renderWarehouse();
};

const adjustSoleStock = (typeId, size, amt) => {
    const type = state.soleTypes.find(t => t.id === typeId);
    if (!type) return;
    type.sizes[size] = Math.max(0, (type.sizes[size] || 0) + amt);
    saveState();
    renderWarehouse();
};

let solePurchaseLineCount = 0;

const openSolePurchaseModal = (initialTypeId = null) => {
    if (state.currentUser?.role !== 'admin') {
        notify('Solo administradores pueden registrar compras.', 'error');
        return;
    }
    renderSoleDatalist();
    document.getElementById('spForm').reset();
    document.getElementById('spDate').valueAsDate = new Date();
    document.getElementById('spLinesContainer').innerHTML = '';
    document.getElementById('spTotalPairsCalc').textContent = '0';
    solePurchaseLineCount = 0;

    // Add first line automatically
    addSolePurchaseLine(initialTypeId);
    calcSolePurchaseTotal();

    openModal('solePurchaseModal');
};

const renderSoleDatalist = () => {
    const dl = document.getElementById('soleTypesDatalist');
    if (!dl) return;
    dl.innerHTML = state.soleTypes.map(t => `<option value="${t.name}">`).join('');
};

const addSolePurchaseLine = (preSelectTypeId = null) => {
    solePurchaseLineCount++;
    const lineId = `spLine_${solePurchaseLineCount}`;
    const photoPreviewId = `spPhoto_${solePurchaseLineCount}`;

    const optionsHtml = state.soleTypes.map(t =>
        `<option value="${t.id}" ${t.id === preSelectTypeId ? 'selected' : ''}>${t.name}</option>`
    ).join('');

    // Helper to get photo HTML for a type ID
    const getPhotoForType = (typeId) => {
        const t = state.soleTypes.find(x => x.id === typeId);
        if (t?.photo) {
            return `<img src="${t.photo}" style="width:36px;height:36px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border-light);cursor:pointer" onclick="triggerSolePhotoUpload('${lineId}')" title="Actualizar foto">`;
        }
        return `<div style="width:36px;height:36px;background:linear-gradient(135deg,#eef2ff,#e0e7ff);border-radius:8px;display:grid;place-items:center;color:var(--brand-400);cursor:pointer" onclick="triggerSolePhotoUpload('${lineId}')" title="Subir foto">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        </div>`;
    };

    const preSelectType = preSelectTypeId ? state.soleTypes.find(x => x.id === preSelectTypeId) : null;
    const initialPhoto = getPhotoForType(preSelectTypeId);

    const szInput = (sz) =>
        `<td style="padding:5px 4px"><input type="number" class="sp-sz" data-sz="${sz}" min="0" value="0"
            style="width:52px;padding:6px 4px;text-align:center;border:1.5px solid var(--border-light);border-radius:7px;font-size:0.82rem;font-weight:600;background:#f8fafc;outline:none;transition:border-color 0.15s"
            onfocus="this.style.borderColor='var(--brand-400)';this.style.background='white'"
            onblur="this.style.borderColor='var(--border-light)';this.style.background='#f8fafc'"
            oninput="calcSolePurchaseTotal()"></td>`;

    const tr = document.createElement('tr');
    tr.id = lineId;
    tr.style.borderBottom = '1px solid var(--border-light)';
    tr.innerHTML = `
        <td style="padding:8px 12px">
            <div style="display:flex;align-items:center;gap:8px">
                <div id="${photoPreviewId}">${initialPhoto}</div>
                <input type="text" class="sp-type-input" list="soleTypesDatalist" required
                    placeholder="Escribe el nombre..."
                    value="${preSelectType ? preSelectType.name : ''}"
                    style="flex:1;padding:7px 10px;border:1.5px solid var(--border-light);border-radius:8px;font-size:0.8rem;font-family:'Inter',sans-serif;background:white;outline:none;transition:border-color 0.15s;color:var(--text-primary)"
                    onfocus="this.style.borderColor='var(--brand-400)'"
                    onblur="this.style.borderColor='var(--border-light)'"
                    onchange="updateSolePurchasePhotoFromInput('${lineId}','${photoPreviewId}')">
            </div>
        </td>
        ${szInput(35)}${szInput(36)}${szInput(37)}${szInput(38)}${szInput(39)}${szInput(40)}${szInput(41)}${szInput(42)}${szInput(43)}
        <td style="padding:8px 10px;text-align:center">
            <span class="sp-line-total" style="font-family:'Outfit',sans-serif;font-size:1rem;font-weight:800;color:var(--brand-600)">0</span>
        </td>
        <td style="padding:8px 8px;text-align:center">
            <button type="button" onclick="removeSolePurchaseLine('${lineId}')" title="Eliminar"
                style="width:30px;height:30px;border:1px solid var(--border-light);background:white;border-radius:7px;cursor:pointer;display:grid;place-items:center;color:var(--text-muted);transition:all 0.15s"
                onmouseover="this.style.background='var(--danger-50)';this.style.borderColor='#fca5a5';this.style.color='var(--danger-600)'"
                onmouseout="this.style.background='white';this.style.borderColor='var(--border-light)';this.style.color='var(--text-muted)'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
        </td>
    `;
    document.getElementById('spLinesContainer').appendChild(tr);
    calcSolePurchaseTotal();
};

const updateAllSolePurchaseSelects = () => {
    const selects = document.querySelectorAll('.sp-type-select');
    selects.forEach(select => {
        const currentVal = select.value;
        const optionsHtml = state.soleTypes.map(t =>
            `<option value="${t.id}" ${t.id === currentVal ? 'selected' : ''}>${t.name}</option>`
        ).join('');
        select.innerHTML = '<option value="">— Seleccionar suela —</option>' + optionsHtml;
    });
};

const updateSolePurchasePhotoFromInput = (lineId, photoId) => {
    const tr = document.getElementById(lineId);
    const input = tr.querySelector('.sp-type-input');
    const name = input.value.trim();
    const typeObj = state.soleTypes.find(t => t.name.toLowerCase() === name.toLowerCase());

    const container = document.getElementById(photoId);
    if (!container) return;

    if (typeObj?.photo) {
        container.innerHTML = `<img src="${typeObj.photo}" style="width:36px;height:36px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border-light);cursor:pointer" onclick="triggerSolePhotoUpload('${lineId}')" title="Actualizar foto">`;
    } else {
        container.innerHTML = `<div style="width:36px;height:36px;background:linear-gradient(135deg,#eef2ff,#e0e7ff);border-radius:8px;display:grid;place-items:center;color:var(--brand-400);cursor:pointer" onclick="triggerSolePhotoUpload('${lineId}')" title="Subir foto">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        </div>`;
    }
};

// Update sole photo preview when user changes the select
const updateSolePurchasePhoto = (lineId, photoId) => {
    const tr = document.getElementById(lineId);
    const container = document.getElementById(photoId);
    if (!tr || !container) return;
    const typeId = tr.querySelector('.sp-type-select')?.value;
    const t = state.soleTypes.find(x => x.id === typeId);
    if (t?.photo) {
        container.innerHTML = `<img src="${t.photo}" style="width:36px;height:36px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border-light);cursor:pointer" onclick="triggerSolePhotoUpload('${lineId}')" title="Actualizar foto">`;
    } else {
        container.innerHTML = `<div style="width:36px;height:36px;background:linear-gradient(135deg,#eef2ff,#e0e7ff);border-radius:8px;display:grid;place-items:center;color:var(--brand-400);cursor:pointer" onclick="triggerSolePhotoUpload('${lineId}')" title="Subir foto">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        </div>`;
    }
};

let activeSpPhotoUploadLine = null;
const triggerSolePhotoUpload = (lineId) => {
    const tr = document.getElementById(lineId);
    if (!tr) return;
    const typeInput = tr.querySelector('.sp-type-input');
    const typeName = typeInput?.value.trim();
    if (!typeName) {
        notify('Por favor ingresa primero un nombre de suela.', 'info');
        return;
    }
    activeSpPhotoUploadLine = lineId;
    document.getElementById('spSolePhotoInput').click();
};

document.getElementById('spSolePhotoInput')?.addEventListener('change', async function () {
    const file = this.files[0];
    if (!file || !activeSpPhotoUploadLine) return;

    const tr = document.getElementById(activeSpPhotoUploadLine);
    const typeInput = tr?.querySelector('.sp-type-input');
    const typeName = typeInput?.value.trim();
    let type = state.soleTypes.find(t => t.name.toLowerCase() === typeName.toLowerCase());

    if (!type) {
        // If type doesn't exist, create it
        type = {
            id: uid(),
            name: typeName,
            sizes: { '35': 0, '36': 0, '37': 0, '38': 0, '39': 0, '40': 0, '41': 0, '42': 0, '43': 0 }
        };
        state.soleTypes.push(type);
        renderSoleDatalist(); // Update datalist with new type
    }

    if (type) {
        const photoData = await readFileAsBase64(file);
        type.photo = photoData;
        saveState();
        notify('Foto de suela actualizada', 'success');
        updateSolePurchasePhotoFromInput(activeSpPhotoUploadLine, tr.querySelector('[id^="spPhoto_"]').id);
        renderWarehouse(); // Reflect in tables
    }
    this.value = ''; // Reset input
});

const updatePladeSolePhoto = () => {
    const select = document.getElementById('pcSoleType');
    const preview = document.getElementById('pcSolePhotoPreview');
    if (!select || !preview) return;
    const t = state.soleTypes.find(x => x.id === select.value);
    if (t?.photo) {
        preview.innerHTML = `<img src="${t.photo}" style="width:100%;height:100%;object-fit:cover">`;
        preview.style.borderColor = 'var(--brand-300)';
    } else {
        preview.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;
        preview.style.borderColor = 'var(--brand-100)';
    }
};


const removeSolePurchaseLine = (lineId) => {
    const el = document.getElementById(lineId);
    if (el) {
        el.remove();
        calcSolePurchaseTotal();
    }
};

const calcSolePurchaseTotal = () => {
    let grandTotal = 0;
    document.querySelectorAll('#spLinesContainer tr').forEach(tr => {
        let lineTotal = 0;
        tr.querySelectorAll('.sp-sz').forEach(input => {
            lineTotal += parseInt(input.value) || 0;
        });
        const totalEl = tr.querySelector('.sp-line-total');
        if (totalEl) totalEl.textContent = lineTotal;
        grandTotal += lineTotal;
    });
    const totalCalcEl = document.getElementById('spTotalPairsCalc');
    if (totalCalcEl) totalCalcEl.textContent = grandTotal;
};

const handleSolePurchaseSubmit = (e) => {
    e.preventDefault();
    if (state.currentUser?.role !== 'admin') { notify('Sin permisos.', 'error'); return; }

    const lines = document.querySelectorAll('#spLinesContainer tr');
    if (lines.length === 0) {
        notify('Debe agregar al menos un producto a la compra.', 'error');
        return;
    }

    const supplier = document.getElementById('spSupplier').value;
    const dateInput = document.getElementById('spDate').value;
    const purchaseDate = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();

    let totalPurchasedData = [];
    let grandTotalPairs = 0;

    for (let tr of lines) {
        const inputEl = tr.querySelector('.sp-type-input');
        const soleName = inputEl?.value.trim();
        if (!soleName) {
            notify('Por favor ingrese el nombre de la suela en todas las filas.', 'error');
            return;
        }

        let typeObj = state.soleTypes.find(t => t.name.toLowerCase() === soleName.toLowerCase());

        // AUTO-REGISTER if not exists
        if (!typeObj) {
            typeObj = {
                id: uid(),
                name: soleName,
                sizes: { '35': 0, '36': 0, '37': 0, '38': 0, '39': 0, '40': 0, '41': 0, '42': 0, '43': 0 }
            };
            state.soleTypes.push(typeObj);
            renderSoleDatalist(); // Update datalist with new type
        }

        const typeId = typeObj.id;

        if (!typeObj) continue;

        const sizes = {};
        let linePairs = 0;
        tr.querySelectorAll('.sp-sz').forEach(input => {
            const sz = input.getAttribute('data-sz');
            const val = parseInt(input.value) || 0;
            sizes[sz] = val;
            linePairs += val;
        });

        if (linePairs > 0) {
            totalPurchasedData.push({ typeId, typeObj, sizes, linePairs });
            grandTotalPairs += linePairs;
        }
    }

    if (totalPurchasedData.length === 0) {
        notify('Ingrese al menos un par en alguno de los productos.', 'error');
        return;
    }

    // Process purchases
    for (let item of totalPurchasedData) {
        // Add to inventory
        for (let sz in item.sizes) {
            if (item.sizes[sz] > 0) {
                item.typeObj.sizes[sz] = (item.typeObj.sizes[sz] || 0) + item.sizes[sz];
            }
        }

        // Log purchase (creates one history record per product type to keep existing display intact)
        state.solePurchases.push({
            id: uid(),
            typeId: item.typeId,
            supplier,
            sizes: item.sizes,
            totalPairs: item.linePairs,
            date: purchaseDate,
            registeredBy: state.currentUser?.user || 'admin'
        });
    }

    addEvent(`Compra consolidada de ${grandTotalPairs} pares (varias suelas) registrada`, 'success');
    saveState();
    closeModal('solePurchaseModal');
    renderWarehouse();
    notify(`Compra registrada: +${grandTotalPairs} pares en total`);
};

const voidSolePurchase = (id) => {
    if (state.currentUser?.role !== 'admin') { notify('Sin permisos para anular.', 'error'); return; }

    const p = state.solePurchases.find(x => x.id === id);
    if (!p) return;
    if (p.void) { notify('Esta compra ya está anulada.', 'info'); return; }

    const reason = prompt('¿Por qué deseas ANULAR esta compra? (Opcional):');
    if (reason === null) return; // Cancelled

    if (!confirm('¿Confirmas que deseas ANULAR esta compra? Esto restará las cantidades del inventario.')) return;

    const typeObj = state.soleTypes.find(t => t.id === p.typeId);
    if (typeObj) {
        // Rollback inventory
        for (let sz in p.sizes) {
            const val = p.sizes[sz] || 0;
            if (val > 0) {
                typeObj.sizes[sz] = Math.max(0, (typeObj.sizes[sz] || 0) - val);
            }
        }
    }

    p.void = true;
    p.voidReason = reason || 'Sin motivo especificado';
    p.voidedAt = new Date().toISOString();
    p.voidedBy = state.currentUser?.user || 'admin';

    addEvent(`Compra de suelas (${p.totalPairs} pares) ANULADA: ${p.voidReason}`, 'warning');
    saveState();
    renderWarehouse();
    notify('Compra anulada y existencias actualizadas.', 'success');
};


const openSoleTypeModal = (id = null) => {
    document.getElementById('soleTypeForm').reset();
    document.getElementById('soleTypeId').value = id || '';
    // Reset photo preview
    document.getElementById('soleTypePhotoPreview').style.display = 'none';
    document.getElementById('soleTypePhotoImg').src = '';

    // Live preview when user picks a photo
    document.getElementById('soleTypePhoto').onchange = function () {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('soleTypePhotoImg').src = ev.target.result;
                document.getElementById('soleTypePhotoPreview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    };

    if (id) {
        document.getElementById('soleTypeModalTitle').textContent = 'Editar Tipo de Suela';
        const type = state.soleTypes.find(t => t.id === id);
        if (type) {
            document.getElementById('soleTypeName').value = type.name;
            document.getElementById('st_sz35').value = type.sizes['35'] || 0;
            document.getElementById('st_sz36').value = type.sizes['36'] || 0;
            document.getElementById('st_sz37').value = type.sizes['37'] || 0;
            document.getElementById('st_sz38').value = type.sizes['38'] || 0;
            document.getElementById('st_sz39').value = type.sizes['39'] || 0;
            document.getElementById('st_sz40').value = type.sizes['40'] || 0;
            document.getElementById('st_sz41').value = type.sizes['41'] || 0;
            document.getElementById('st_sz42').value = type.sizes['42'] || 0;
            document.getElementById('st_sz43').value = type.sizes['43'] || 0;
            if (type.photo) {
                document.getElementById('soleTypePhotoImg').src = type.photo;
                document.getElementById('soleTypePhotoPreview').style.display = 'block';
            }
        }
    } else {
        document.getElementById('soleTypeModalTitle').textContent = 'Registrar Tipo de Suela';
    }
    openModal('soleTypeModal');
};

const handleSoleTypeSubmit = async (e) => {
    e.preventDefault();
    if (state.currentUser?.role === 'observador') {
        notify('Modo Observador: No tienes permisos.', 'error');
        return;
    }
    const id = document.getElementById('soleTypeId').value;
    const name = document.getElementById('soleTypeName').value;
    const photoFile = document.getElementById('soleTypePhoto').files[0];
    let photoData = null;
    if (photoFile) {
        photoData = await readFileAsBase64(photoFile);
    }

    if (id) {
        const type = state.soleTypes.find(t => t.id === id);
        if (type) {
            type.name = name;
            type.sizes['35'] = parseInt(document.getElementById('st_sz35').value) || 0;
            type.sizes['36'] = parseInt(document.getElementById('st_sz36').value) || 0;
            type.sizes['37'] = parseInt(document.getElementById('st_sz37').value) || 0;
            type.sizes['38'] = parseInt(document.getElementById('st_sz38').value) || 0;
            type.sizes['39'] = parseInt(document.getElementById('st_sz39').value) || 0;
            type.sizes['40'] = parseInt(document.getElementById('st_sz40').value) || 0;
            type.sizes['41'] = parseInt(document.getElementById('st_sz41').value) || 0;
            type.sizes['42'] = parseInt(document.getElementById('st_sz42').value) || 0;
            type.sizes['43'] = parseInt(document.getElementById('st_sz43').value) || 0;
            if (photoData) type.photo = photoData;
            notify('Tipo de suela actualizado', 'success');
        }
    } else {
        const sizes = {
            '35': parseInt(document.getElementById('st_sz35').value) || 0,
            '36': parseInt(document.getElementById('st_sz36').value) || 0,
            '37': parseInt(document.getElementById('st_sz37').value) || 0,
            '38': parseInt(document.getElementById('st_sz38').value) || 0,
            '39': parseInt(document.getElementById('st_sz39').value) || 0,
            '40': parseInt(document.getElementById('st_sz40').value) || 0,
            '41': parseInt(document.getElementById('st_sz41').value) || 0,
            '42': parseInt(document.getElementById('st_sz42').value) || 0,
            '43': parseInt(document.getElementById('st_sz43').value) || 0
        };
        state.soleTypes.push({ id: uid(), name, sizes, photo: photoData });
        notify('Tipo de suela registrado', 'success');
    }
    saveState();
    closeModal('soleTypeModal');
    renderWarehouse();
    updateAllSolePurchaseSelects();
};

const handleMaterialSubmit = (e) => {
    e.preventDefault();
    if (state.currentUser?.role === 'observador') {
        notify('Modo Observador: No tienes permisos.', 'error');
        return;
    }
    const material = {
        id: uid(),
        code: document.getElementById('matCode').value,
        name: document.getElementById('matName').value,
        stock: parseInt(document.getElementById('matStock').value),
        min: parseInt(document.getElementById('matMin').value)
    };
    state.materials.push(material);
    saveState();
    closeModal('materialModal');
    renderWarehouse();
    notify('Material registrado');
};

const renderWarehouse = () => {
    renderSoleDatalist();
    // Render Materiales Generales
    const tbody = document.getElementById('warehouseTableBody');
    tbody.innerHTML = state.materials.map(m => `
        <tr>
            <td><code>${m.code}</code></td>
            <td>${m.name}</td>
            <td><strong>${m.stock}</strong></td>
            <td>
                <span class="badge" style="background:${m.stock <= m.min ? '#fef2f2;color:#ef4444' : '#f0fdf4;color:#10b981'}">
                    ${m.stock <= m.min ? 'Bajo Stock' : 'Disponible'}
                </span>
            </td>
            <td>
                ${state.currentUser?.role !== 'observador' ? `<button class="btn btn-ghost" onclick="adjustStock('${m.id}', 10)">+10</button>` : ''}
                ${state.currentUser?.role === 'admin' ? `<button class="btn btn-ghost" onclick="deleteMaterial('${m.id}')">🗑</button>` : ''}
            </td>
        </tr>
    `).join('');

    // Render Almacén de Suelas (Tipos)
    const soleContainer = document.getElementById('soleTypesContainer');
    if (soleContainer) {
        if (!state.soleTypes || state.soleTypes.length === 0) {
            soleContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No hay tipos de suela registrados.</div>';
        } else {
            // Pre-calculate blocked soles per type and size
            const blockedMap = {};
            state.soleTypes.forEach(t => {
                blockedMap[t.id] = { '35': 0, '36': 0, '37': 0, '38': 0, '39': 0, '40': 0, '41': 0, '42': 0, '43': 0 };
            });

            state.orders.forEach(o => {
                if (o.status === 'en_proceso' || o.status === 'produccion') {
                    if (o.soleType && blockedMap[o.soleType] && o.sizeDistribution) {
                        for (let sz in o.sizeDistribution) {
                            blockedMap[o.soleType][sz] += (o.sizeDistribution[sz] || 0);
                        }
                    }
                }
            });

            soleContainer.innerHTML = state.soleTypes.map(type => {
                const blocked = blockedMap[type.id];
                const sizes = ['35', '36', '37', '38', '39', '40', '41', '42', '43'];
                const totalFree = sizes.reduce((s, sz) => s + (type.sizes[sz] || 0), 0);
                const totalBlocked = sizes.reduce((s, sz) => s + (blocked[sz] || 0), 0);
                const hasLowStock = sizes.some(sz => (type.sizes[sz] || 0) === 0);

                return `
                <div style="background:white;border-radius:18px;border:1px solid var(--border-light);box-shadow:var(--shadow-md);overflow:hidden;margin-bottom:4px">
                    <!-- Card Header -->
                    <div style="display:flex;align-items:center;gap:16px;padding:16px 20px;border-bottom:1px solid var(--border-light);background:linear-gradient(135deg,#f8fafc,#f1f5f9)">
                        <!-- Photo -->
                        ${type.photo
                        ? `<img src="${type.photo}" style="width:56px;height:56px;object-fit:cover;border-radius:12px;border:2px solid var(--border-light);flex-shrink:0;box-shadow:var(--shadow-sm)">`
                        : `<div style="width:56px;height:56px;background:linear-gradient(135deg,#eef2ff,#e0e7ff);border-radius:12px;display:grid;place-items:center;flex-shrink:0;color:var(--brand-400)">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                               </div>`
                    }
                        <!-- Info -->
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:800;font-size:1rem;color:var(--text-primary);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${type.name}</div>
                            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
                                <span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:99px;font-size:0.72rem;font-weight:700;border:1px solid #bbf7d0">
                                    <span style="width:5px;height:5px;border-radius:50%;background:#16a34a"></span>
                                    ${totalFree} libres
                                </span>
                                ${totalBlocked > 0 ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#eef2ff;color:#4338ca;padding:3px 10px;border-radius:99px;font-size:0.72rem;font-weight:700;border:1px solid #c7d2fe">🔒 ${totalBlocked} en uso</span>` : ''}
                                ${hasLowStock ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:99px;font-size:0.72rem;font-weight:700;border:1px solid #fde68a">⚠️ Tallas agotadas</span>` : ''}
                            </div>
                        </div>
                        <!-- Actions -->
                        ${state.currentUser?.role === 'admin' ? `
                        <div style="display:flex;gap:4px">
                            <button onclick="openSoleTypeModal('${type.id}')" class="btn btn-ghost" style="padding:8px;color:var(--brand-600)" title="Editar Nombre/Foto">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onclick="openSolePurchaseModal('${type.id}')"
                                style="display:inline-flex;align-items:center;gap:7px;padding:9px 16px;background:linear-gradient(135deg,var(--success-500),#059669);color:white;border:none;border-radius:10px;font-size:0.8rem;font-weight:700;cursor:pointer;transition:all 0.15s;flex-shrink:0;box-shadow:0 2px 8px rgba(16,185,129,0.3)"
                                onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(16,185,129,0.4)'"
                                onmouseout="this.style.transform='none';this.style.boxShadow='0 2px 8px rgba(16,185,129,0.3)'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                                Registrar Compra
                            </button>
                        </div>` : ''}
                    </div>

                    <!-- Size Grid -->
                    <div style="padding:14px 20px;background:white">
                        <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:8px">
                            ${sizes.map(size => {
                        const free = type.sizes[size] || 0;
                        const blk = blocked[size] || 0;
                        const isEmpty = free === 0;
                        const bg = isEmpty ? '#fff1f2' : '#f0fdf4';
                        const numColor = isEmpty ? 'var(--danger-600)' : 'var(--success-600)';
                        return `
                                <div style="background:${bg};border-radius:10px;padding:8px 4px;text-align:center;border:1px solid ${isEmpty ? '#fecdd3' : '#bbf7d0'}">
                                    <div style="font-size:0.62rem;font-weight:700;color:var(--text-muted);letter-spacing:0.05em;margin-bottom:4px">#${size}</div>
                                    <div style="font-family:'Outfit',sans-serif;font-size:1.2rem;font-weight:800;color:${numColor};line-height:1">${free}</div>
                                    <div style="font-size:0.55rem;color:var(--text-muted);margin-top:2px;font-weight:600">libres</div>
                                    ${blk > 0 ? `<div style="margin-top:4px;padding:2px 4px;background:#eef2ff;border-radius:4px;font-size:0.6rem;font-weight:700;color:#4338ca">🔒${blk}</div>` : ''}
                                </div>`;
                    }).join('')}
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // Render Historial de Compras de Suelas
    const purchaseHistEl = document.getElementById('solePurchaseHistory');
    if (purchaseHistEl) {
        const purchases = [...(state.solePurchases || [])].reverse();
        if (purchases.length === 0) {
            purchaseHistEl.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">No hay compras registradas aún.</td></tr>';
        } else {
            purchaseHistEl.innerHTML = purchases.map(p => {
                const typeObj = state.soleTypes.find(t => t.id === p.typeId);
                const sizesStr = Object.entries(p.sizes).filter(([, v]) => v > 0).map(([k, v]) => `#${k}: ${v}`).join(', ');
                const isVoid = !!p.void;

                return `<tr style="${isVoid ? 'text-decoration:line-through;opacity:0.6;background:#fff5f5' : ''}">
                    <td style="font-size:0.8rem">
                        ${new Date(p.date).toLocaleDateString('es-ES')}
                        ${isVoid ? `<br><span style="color:var(--danger-600);font-weight:800;font-size:0.65rem;text-decoration:none !important;display:inline-block">ANULADA</span><br><em style="font-size:0.6rem;text-decoration:none !important;display:inline-block">Motivo: ${p.voidReason || '—'}</em>` : ''}
                    </td>
                    <td style="font-size:0.8rem;font-weight:600">${typeObj?.name || '—'}</td>
                    <td style="font-size:0.8rem">${sizesStr}</td>
                    <td style="font-size:0.8rem">${p.supplier || '—'}</td>
                    <td style="font-size:0.8rem;font-weight:700;color:var(--brand-600)">${p.totalPairs} pares</td>
                    <td style="font-size:0.8rem">${p.registeredBy || '—'}</td>
                    <td style="text-align:center">
                        ${(!isVoid && state.currentUser?.role === 'admin') ? `
                            <button onclick="voidSolePurchase('${p.id}')" class="btn btn-ghost" style="padding:4px;color:var(--danger-500)" title="Anular Compra">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                            </button>
                        ` : '—'}
                    </td>
                </tr>`;
            }).join('');
        }
    }
};

const adjustStock = (id, amt) => {
    const m = state.materials.find(x => x.id === id);
    if (m) {
        m.stock += amt;
        saveState();
        renderWarehouse();
    }
};

const deleteMaterial = (id) => {
    const idx = state.materials.findIndex(m => m.id === id);
    if (idx !== -1) {
        const removed = state.materials.splice(idx, 1)[0];
        state.trash.push({ type: 'material', data: removed, time: new Date().toISOString() });
        saveState();
        renderWarehouse();
    }
};

// --- Feature: Tasks & Production ---
let activePhase = 'cortador';

const renderTasks = () => {
    const tabs = document.getElementById('phaseTabs');
    const isAdmin = state.currentUser.role === 'admin';
    const isObserver = state.currentUser.role === 'observador';

    // Show all tabs for Admin and Observer
    const hasPinturaTasks = state.tasks.some(t => t.phaseId === 'pintura');
    const pinturaTab = hasPinturaTasks ? { id: 'pintura', name: 'Pintura', icon: '🖌️', order: 99 } : null;
    const allTabs = pinturaTab ? [...PHASES, pinturaTab] : PHASES;

    if (isAdmin || isObserver) {
        tabs.innerHTML = allTabs.map(p => `
            <button class="btn ${activePhase === p.id ? 'btn-primary' : 'btn-ghost'}" onclick="setPhase('${p.id}')">
                ${p.icon} ${p.name}
            </button>
        `).join('');
    } else {
        // Para trabajador de pintura (rol 'pintura')
        if (state.currentUser.role === 'pintura') {
            tabs.innerHTML = `
                <div style="background:var(--brand-50);padding:8px 16px;border-radius:var(--radius-md);color:var(--brand-700);font-weight:700">
                    🖌️ ÁREA: Pintura
                </div>
            `;
            activePhase = 'pintura';
        } else {
            tabs.innerHTML = `
                <div style="background:var(--brand-50);padding:8px 16px;border-radius:var(--radius-md);color:var(--brand-700);font-weight:700">
                    ${PHASES.find(p => p.id === state.currentUser.role)?.icon} ÁREA: ${PHASES.find(p => p.id === state.currentUser.role)?.name}
                </div>
            `;
            activePhase = state.currentUser.role;
        }
    }

    const grid = document.getElementById('tasksGrid');
    let tasks = state.tasks.filter(t => t.phaseId === activePhase);

    // Si es trabajador normal (no admin, no almacén, no observador), solo muestra las tareas asignadas a este usuario
    const isWorker = !isAdmin && !isObserver && (state.currentUser.role !== 'almacen_dist');

    if (isWorker) {
        tasks = tasks.filter(t => t.assignedTo === state.currentUser.id);
    }

    // --- Inventario de Producto Terminado (Almacén Final) ---
    const inventoryContainer = document.getElementById('inventorySummary') || (() => {
        const div = document.createElement('div');
        div.id = 'inventorySummary';
        grid.parentNode.insertBefore(div, grid);
        return div;
    })();

    if (activePhase === 'almacen_dist') {
        const finishedTasks = state.tasks.filter(t => t.phaseId === 'almacen_dist' && t.status === 'terminada');
        const inventory = {};
        finishedTasks.forEach(t => {
            const order = state.orders.find(o => o.id === t.orderId);
            if (!inventory[t.model]) {
                inventory[t.model] = { pairs: 0, photo: order?.photo || null, orders: new Set() };
            }
            inventory[t.model].pairs += t.pairs;
            inventory[t.model].orders.add(t.orderNum);
        });

        const totalPairs = Object.values(inventory).reduce((sum, v) => sum + v.pairs, 0);
        const modelCount = Object.keys(inventory).length;

        inventoryContainer.innerHTML = `
            <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);border:1px solid #bbf7d0">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
                    <div style="width:44px;height:44px;background:var(--success-500);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:white">📦</div>
                    <div>
                        <h3 style="margin:0;color:#166534">Inventario de Producto Terminado</h3>
                        <div style="font-size:0.85rem;color:#15803d">${modelCount} modelo${modelCount !== 1 ? 's' : ''} · ${totalPairs} pares en total</div>
                    </div>
                </div>
                ${modelCount === 0 ? '<div style="text-align:center;padding:20px;color:#6b7280;font-size:0.9rem">Aún no hay productos terminados en almacén</div>' : `
                    <table style="width:100%;border-collapse:collapse">
                        <thead>
                            <tr style="border-bottom:2px solid #86efac">
                                <th style="text-align:left;padding:8px 12px;color:#166534;font-size:0.8rem;text-transform:uppercase">Modelo</th>
                                <th style="text-align:center;padding:8px 12px;color:#166534;font-size:0.8rem;text-transform:uppercase">Pares</th>
                                <th style="text-align:left;padding:8px 12px;color:#166534;font-size:0.8rem;text-transform:uppercase">Órdenes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(inventory).map(([model, data]) => `
                                <tr style="border-bottom:1px solid #dcfce7">
                                    <td style="padding:10px 12px">
                                        <div style="display:flex;align-items:center;gap:10px">
                                            ${data.photo ? `<img src="${data.photo}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid #bbf7d0">` : `<div style="width:36px;height:36px;background:#dcfce7;border-radius:6px;display:flex;align-items:center;justify-content:center">👟</div>`}
                                            <strong style="color:#14532d">${model}</strong>
                                        </div>
                                    </td>
                                    <td style="text-align:center;padding:10px 12px">
                                        <span style="background:#22c55e;color:white;padding:4px 14px;border-radius:20px;font-weight:700;font-size:0.95rem">${data.pairs}</span>
                                    </td>
                                    <td style="padding:10px 12px;font-size:0.8rem;color:#15803d">${[...data.orders].join(', ')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        `;
    } else {
        inventoryContainer.innerHTML = '';

        // Show Area Warehouse (Stock from previous phase)
        const incomingStock = getIncomingStock(activePhase);
        const phaseIdx = PHASES.findIndex(p => p.id === activePhase);

        if (phaseIdx > 0 && incomingStock > 0) {
            const prevPhase = PHASES[phaseIdx - 1];
            const warehouseDiv = document.createElement('div');
            warehouseDiv.className = 'area-warehouse-card';
            warehouseDiv.innerHTML = `
            < div class="area-warehouse-icon" > ${prevPhase.icon}</div >
                <div style="flex:1">
                    <h4 style="margin:0;color:var(--brand-700)">Almacén de Entrada (desde ${prevPhase.name})</h4>
                    <div style="font-size:0.875rem;color:var(--text-secondary)">Hay <strong class="stock-badge-pill">${incomingStock}</strong> pares listos esperando ser procesados en esta área.</div>
                </div>
        `;
            grid.parentNode.insertBefore(warehouseDiv, grid);
        }
    }

    if (tasks.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)">No hay tareas asignadas para ti en esta fase</div>';
        return;
    }

    const activeTasks = tasks.filter(t => t.status !== 'terminada');
    const finishedTasks = tasks.filter(t => t.status === 'terminada');

    const renderCard = (t) => {
        const order = state.orders.find(o => o.id === t.orderId);
        const pendingResult = checkSolePending(order);
        const isSolePending = pendingResult !== false;

        let pendingBadge = '';
        if (t.phaseId === 'solador' && isSolePending) {
            const missingText = pendingResult.join(', ');
            pendingBadge = `<div style="display:flex;align-items:flex-start;gap:6px;padding:8px 10px;border-radius:8px;background:#fee2e2;border:1px solid #fca5a5;margin-bottom:12px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" style="margin-top:2px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                    <div style="font-size:0.75rem;font-weight:700;color:#dc2626">Suela insuficiente</div>
                    <div style="font-size:0.7rem;color:#b91c1c;margin-top:2px">${missingText}</div>
                </div>
            </div>`;
        }

        let statusColor = t.status === 'terminada' ? '#16a34a' : t.status === 'en_proceso' ? '#6366f1' : t.status === 'pendiente' ? '#f59e0b' : '#cbd5e1';

        const statusCfg = {
            en_proceso: { label: 'En Proceso', bg: '#eef2ff', color: '#4338ca', dot: '#6366f1', pulse: true },
            pendiente: { label: 'Pendiente', bg: '#fffbeb', color: '#92400e', dot: '#f59e0b', pulse: false },
            terminada: { label: 'Terminada', bg: '#dcfce7', color: '#166534', dot: '#16a34a', pulse: false },
            bloqueada: { label: 'Bloqueada', bg: '#f1f5f9', color: '#94a3b8', dot: '#cbd5e1', pulse: false },
        };
        let cfg = statusCfg[t.status] || statusCfg.bloqueada;
        if (t.phaseId === 'solador' && isSolePending) {
            cfg = { label: '⚠️ Suela Faltante', bg: '#ffedd5', color: '#c2410c', dot: '#ea580c', pulse: true };
            statusColor = '#ea580c';
        }

        const sole = state.soleTypes.find(s => s.id === order?.soleType);
        const workerName = t.assignedTo
            ? (state.users.find(u => u.id === t.assignedTo)?.fullName || state.users.find(u => u.id === t.assignedTo)?.user || 'Trabajador')
            : 'Pendiente por asignar';

        // Previous task history timeline
        const previousTasks = state.tasks.filter(pt => pt.orderId === t.orderId && pt.order < t.order && pt.assignedTo);
        const historyMap = {};
        previousTasks.forEach(pt => {
            const u = state.users.find(user => user.id === pt.assignedTo);
            const name = u ? (u.fullName || u.user) : 'Trabajador';
            if (!historyMap[pt.phaseName]) historyMap[pt.phaseName] = new Set();
            historyMap[pt.phaseName].add(name);
        });

        const historyHtml = Object.keys(historyMap).length > 0 ? `
            <div style="background:#f8fafc;padding:10px 12px;border-radius:10px;margin-bottom:12px;border:1px solid var(--border-light)">
                <div style="font-size:0.65rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">📋 Historial de Fases</div>
                <div style="display:flex;flex-direction:column;gap:5px">
                    ${Object.keys(historyMap).map(phase => `
                        <div style="display:flex;align-items:center;gap:8px">
                            <div style="width:6px;height:6px;border-radius:50%;background:#22c55e;flex-shrink:0"></div>
                            <span style="font-size:0.72rem;color:var(--brand-700);font-weight:700">${phase}:</span>
                            <span style="font-size:0.72rem;color:var(--text-secondary)">${Array.from(historyMap[phase]).join(', ')}</span>
                        </div>
                    `).join('')}
                </div>
            </div>` : '';

        return `
            <div style="background:white;border-radius:16px;border:1px solid var(--border-light);box-shadow:var(--shadow-md);overflow:hidden;border-top:3px solid ${statusColor}">
                <!-- Card Header -->
                <div style="padding:14px 16px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center">
                    <code style="font-size:0.78rem;font-weight:800;color:var(--brand-700);background:var(--brand-50);padding:3px 10px;border-radius:6px;letter-spacing:0.04em">${t.orderNum}</code>
                    <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font-size:0.7rem;font-weight:700;background:${cfg.bg};color:${cfg.color}">
                        <span style="width:6px;height:6px;border-radius:50%;background:${cfg.dot}${cfg.pulse ? ';animation:pulse 1.5s infinite' : ''}"></span>
                        ${cfg.label}
                    </span>
                </div>

                <!-- Order Info -->
                <div style="padding:14px 16px">
                    <div style="display:flex;gap:12px;margin-bottom:12px">
                        ${order?.photo
                ? `<img src="${order.photo}" style="width:64px;height:64px;object-fit:cover;border-radius:12px;border:2px solid var(--border-light);flex-shrink:0;box-shadow:var(--shadow-sm)">`
                : `<div style="width:64px;height:64px;background:linear-gradient(135deg,#eef2ff,#e0e7ff);border-radius:12px;display:grid;place-items:center;flex-shrink:0;color:var(--brand-300)"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 16c0-1.5.8-3 2.2-3.8l4.5-3c.8-.5 1.3-1.5 1.3-2.5V4.5c0-.8.8-1.3 1.5-.9l2.2 1.1c.8.4 1.3 1.1 1.5 1.9l.8 3c.4 1.5 1.5 2.6 3 3h.8c.8 0 1.2.7 1.2 1.3v2c0 .7-.5 1.2-1.2 1.2H4.2c-.7 0-1.2-.5-1.2-1.2v-.4z" fill="currentColor" opacity=".3"/></svg></div>`
            }
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:800;font-size:1rem;color:var(--text-primary);line-height:1.2;margin-bottom:5px">${t.model}</div>
                            <div style="display:flex;flex-direction:column;gap:3px">
                                ${order?.color ? `<div style="font-size:0.75rem;color:var(--text-secondary);display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#6b7280"></span>Color: <strong>${order.color}</strong></div>` : ''}
                                ${sole ? `<div style="font-size:0.75rem;color:var(--text-secondary);display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#fcd34d"></span>Suela: <strong>${sole.name}</strong></div>` : ''}
                                <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
                                    <span style="font-family:'Outfit',sans-serif;font-size:1.1rem;font-weight:800;color:var(--brand-600)">${t.pairs}</span>
                                    <span style="font-size:0.72rem;color:var(--text-muted);font-weight:600">pares</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Worker badge -->
                    <div style="display:flex;align-items:center;gap:7px;padding:7px 10px;background:${t.assignedTo ? 'var(--brand-50)' : '#f8fafc'};border-radius:8px;border:1px solid ${t.assignedTo ? 'var(--brand-100)' : 'var(--border-light)'};margin-bottom:10px">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${t.assignedTo ? 'var(--brand-500)' : 'var(--text-muted)'}" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span style="font-size:0.75rem;font-weight:600;color:${t.assignedTo ? 'var(--brand-700)' : 'var(--text-muted)'}">${workerName}</span>
                    </div>

                    ${order?.notes ? `<div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:10px;font-style:italic;padding:6px 10px;background:#f8fafc;border-radius:7px;border-left:3px solid var(--border-light)">📝 "${order.notes}"</div>` : ''}

                    <!-- Process badges -->
                    ${order?.processes && (order.processes.bordado || order.processes.estampado || order.processes.pintarSuela) ? `
                    <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;padding:10px;background:var(--brand-50);border-radius:10px;border:1px solid var(--brand-100)">
                        ${order.processes.bordado ? `<div style="display:flex;align-items:center;gap:6px;font-size:0.75rem"><span style="font-weight:700;color:#5b21b6;background:#ede9fe;padding:2px 8px;border-radius:5px">🧵 BORDADO</span>${order.processes.bordadoDetail ? `<span style="color:#6366f1;font-weight:500">${order.processes.bordadoDetail}</span>` : ''}</div>` : ''}
                        ${order.processes.estampado ? `<div style="display:flex;align-items:center;gap:6px;font-size:0.75rem"><span style="font-weight:700;color:#92400e;background:#fef3c7;padding:2px 8px;border-radius:5px">🎨 ESTAMPADO</span>${order.processes.estampadoDetail ? `<span style="color:#d97706;font-weight:500">${order.processes.estampadoDetail}</span>` : ''}</div>` : ''}
                        ${order.processes.pintarSuela ? `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:0.75rem"><span style="font-weight:700;color:#065f46;background:#d1fae5;padding:2px 8px;border-radius:5px">🖌️ PINTAR</span>${order.processes.pintarSuelaDetail ? `<span style="color:#059669;font-weight:500;background:#ecfdf5;padding:1px 7px;border-radius:4px">${order.processes.pintarSuelaDetail}</span>` : ''}${order.processes.pintarSuelaPhoto ? `<img src="${order.processes.pintarSuelaPhoto}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid #10b981;box-shadow:var(--shadow-sm);transition:transform 0.2s" onmouseover="this.style.transform='scale(3.5) translateX(20%)';this.style.zIndex='100'" onmouseout="this.style.transform='scale(1)';this.style.zIndex='1'" title="Guía de Pintura Suela">` : ''}</div>` : ''}
                    </div>` : ''}

                    ${historyHtml}

                    ${pendingBadge}

                    <!-- Action buttons -->
                    <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
                        ${t.status === 'pendiente' ? `
                            ${t.phaseId === 'solador' && isSolePending
                    ? `<button disabled style="display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 16px;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:10px;font-weight:700;font-size:0.8rem;cursor:not-allowed;opacity:0.8">🚫 Esperando Suelas</button>`
                    : `<button onclick="startTask('${t.id}')" style="display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 16px;background:linear-gradient(135deg,var(--brand-500),#8b5cf6);color:white;border:none;border-radius:10px;font-weight:700;font-size:0.82rem;cursor:pointer;transition:all 0.15s;box-shadow:0 2px 8px rgba(99,102,241,0.3)" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 14px rgba(99,102,241,0.4)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 2px 8px rgba(99,102,241,0.3)'">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    Iniciar Tarea
                                </button>`
                }` : ''}
                        ${t.status === 'en_proceso' && isAdmin ? `
                            <button onclick="completeTask('${t.id}')" style="display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 16px;background:linear-gradient(135deg,var(--success-500),#059669);color:white;border:none;border-radius:10px;font-weight:700;font-size:0.82rem;cursor:pointer;transition:all 0.15s;box-shadow:0 2px 8px rgba(16,185,129,0.3)" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 14px rgba(16,185,129,0.4)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 2px 8px rgba(16,185,129,0.3)'">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg>
                                Finalizar y Entregar
                            </button>` : ''}
                        ${t.status === 'en_proceso' && !isAdmin ? `
                            <button onclick="workerFinishTask('${t.id}')" style="display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 16px;background:linear-gradient(135deg,var(--success-500),#059669);color:white;border:none;border-radius:10px;font-weight:700;font-size:0.82rem;cursor:pointer;transition:all 0.15s;box-shadow:0 2px 8px rgba(16,185,129,0.3)" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 14px rgba(16,185,129,0.4)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 2px 8px rgba(16,185,129,0.3)'">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg>
                                Marcar como Terminada
                            </button>` : ''}
                        ${t.status === 'bloqueada' ? `
                            <div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:8px;background:#f8fafc;border-radius:8px;border:1px dashed var(--border-light)">⏳ Esperando fase anterior...</div>` : ''}
                        ${t.status === 'terminada' ? `
                            <div style="font-size:0.78rem;color:var(--success-600);font-weight:700;text-align:center;padding:8px;background:#dcfce7;border-radius:8px;border:1px solid #bbf7d0">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:middle;margin-right:4px"><path d="M5 12l5 5L20 7"/></svg>
                                Entregado el ${formatDate(t.finishedAt)}
                            </div>` : ''}
                    </div>
                </div>
            </div>
        `;
    };

    let html = '';

    // Configurar el layout de columnas
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '24px';
    grid.style.alignItems = 'start';

    // Columna de Pendientes / En Proceso
    html += `
        <div style="background: #f8fafc; border-radius: 16px; padding: 16px; border: 1px solid var(--border-light); min-height: 400px; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid var(--gray-200);">
                <h3 style="margin:0; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 8px; font-weight: 800;">
                    <span style="width: 12px; height: 12px; border-radius: 50%; background: var(--brand-500);"></span>
                    Pendientes / Proceso
                </h3>
                <span style="font-size: 0.85rem; font-weight: 700; background: white; padding: 4px 10px; border-radius: 99px; color: var(--brand-700); box-shadow: var(--shadow-sm);">${activeTasks.length}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:16px; flex: 1;">
                ${activeTasks.length > 0
            ? activeTasks.map(renderCard).join('')
            : '<div style="text-align:center; padding: 40px 20px; color: var(--text-muted); font-size: 0.9rem; margin: auto;">No hay tareas en proceso</div>'}
            </div>
        </div>
    `;

    // Columna de Terminadas
    html += `
        <div style="background: #f0fdf4; border-radius: 16px; padding: 16px; border: 1px dashed #bbf7d0; min-height: 400px; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #dcfce7;">
                <h3 style="margin:0; font-size: 1.1rem; color: #166534; display: flex; align-items: center; gap: 8px; font-weight: 800;">
                    <span style="width: 12px; height: 12px; border-radius: 50%; background: var(--success-500);"></span>
                    Terminadas
                </h3>
                <span style="font-size: 0.85rem; font-weight: 700; background: white; padding: 4px 10px; border-radius: 99px; color: #15803d; box-shadow: var(--shadow-sm); border: 1px solid #bbf7d0;">${finishedTasks.length}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:16px; flex: 1; opacity: 0.9;">
                ${finishedTasks.length > 0
            ? finishedTasks.map(renderCard).join('')
            : '<div style="text-align:center; padding: 40px 20px; color: #166534; opacity: 0.6; font-size: 0.9rem; margin: auto;">No hay tareas terminadas</div>'}
            </div>
        </div>
    `;

    grid.innerHTML = html;
};


const setPhase = (pid) => { activePhase = pid; renderTasks(); };

const startTask = (id) => {
    if (state.currentUser?.role === 'observador') {
        notify('Modo Observador: No puedes iniciar tareas.', 'error');
        return;
    }
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;

    if (t.phaseId === 'solador') {
        const order = state.orders.find(o => o.id === t.orderId);
        if (checkSolePending(order)) {
            notify('No puedes iniciar esta tarea: faltan suelas en el inventario.', 'error');
            return;
        }

        if (!order.solesDeducted) {
            const typeObj = state.soleTypes.find(st => st.id === order.soleType);
            if (typeObj && order.sizeDistribution) {
                for (let sz in order.sizeDistribution) {
                    const needed = order.sizeDistribution[sz];
                    if (needed > 0) {
                        typeObj.sizes[sz] = Math.max(0, (typeObj.sizes[sz] || 0) - needed);
                    }
                }
            }
            order.solesDeducted = true;
        }
    }

    // Populate workers for this area
    const workerSelect = document.getElementById('taskWorkerSelect');
    const workers = state.users.filter(u => u.role === t.phaseId && u.status !== 'inactivo');

    workerSelect.innerHTML = '<option value="">-- Pendiente por asignar (Yo recibo) --</option>' +
        workers.map(u => `<option value="${u.id}">${u.fullName || u.user}</option>`).join('');

    if (t.assignedTo) {
        workerSelect.value = t.assignedTo;
    }

    document.getElementById('startTaskId').value = id;
    document.getElementById('startTaskInfo').innerHTML = `Iniciando < strong > ${t.model}</strong > (${t.orderNum}) - Fase: ${t.phaseName} `;

    // Auto-fill payment. If it was pre-calculated/assigned, divide by pairs
    const currentPrice = t.payment ? (t.payment / t.pairs) : state.pricePerPair;
    document.getElementById('taskPaymentInput').value = currentPrice;

    document.getElementById('startTaskPairs').textContent = t.pairs;
    calculateTaskTotal();

    openModal('startTaskModal');
};

const calculateTaskTotal = () => {
    const taskId = document.getElementById('startTaskId').value;
    const t = state.tasks.find(x => x.id === taskId);
    if (!t) return;

    const price = parseFloat(document.getElementById('taskPaymentInput').value) || 0;
    const total = price * t.pairs;
    document.getElementById('startTaskTotal').textContent = formatCurrency(total);
};

const handleStartTaskSubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('startTaskId').value;
    const payment = parseFloat(document.getElementById('taskPaymentInput').value) || 0;
    const workerId = document.getElementById('taskWorkerSelect').value;

    const t = state.tasks.find(x => x.id === id);
    if (!t) return;

    t.status = 'en_proceso';
    // Assign to selected worker if any
    t.assignedTo = workerId || null;
    t.payment = payment * t.pairs; // Calculate total payment = price * pairs

    const wUser = workerId ? state.users.find(u => u.id === workerId) : null;
    const workerName = wUser ? (wUser.fullName || wUser.user) : 'Pendiente por asignar';
    addEvent(`Producción iniciada: ${t.model} (${t.phaseName}) - Cobro: ${formatCurrency(payment)} (${workerName})`, 'info');
    saveState();
    closeModal('startTaskModal');
    renderTasks();
};

let currentCompletingTask = null;
let currentNextTask = null;

const openAssignGuarnicionModal = (currentId, nextId) => {
    currentCompletingTask = currentId;
    currentNextTask = nextId;

    const nextTask = state.tasks.find(x => x.id === nextId);
    const nextPhase = PHASES.find(p => p.id === nextTask.phaseId);

    // Filter workers by the next phase's area
    const workerSelect = document.getElementById('agWorkerSelect');
    const workers = state.users.filter(u => u.role === nextTask.phaseId && u.status !== 'inactivo');

    workerSelect.innerHTML = '<option value="">-- Pendiente por asignar (Yo recibo) --</option>' +
        workers.map(u => `<option value="${u.id}">${u.fullName || u.user}</option>`).join('');

    // Update modal title to show which phase
    const modalTitle = document.querySelector('#assignGuarnicionModal .modal-header h2');
    if (modalTitle) modalTitle.textContent = `Asignar a ${nextPhase ? nextPhase.icon + ' ' + nextPhase.name : 'siguiente fase'} `;

    document.getElementById('agMaxPairs').textContent = nextTask ? nextTask.pairs : 0;
    document.getElementById('agPairsInput').max = nextTask ? nextTask.pairs : 0;
    document.getElementById('agPairsInput').value = nextTask ? nextTask.pairs : 0;
    document.getElementById('agTotalPairs').textContent = nextTask ? nextTask.pairs : 0;

    document.getElementById('agPaymentInput').value = state.pricePerPair;

    // Clarify payment label
    const paymentLabel = document.querySelector('#assignGuarnicionForm .admin-payment-field label');
    if (paymentLabel) {
        paymentLabel.innerHTML = `Monto a Pagar al <strong>${nextPhase?.name || 'Siguiente'}</strong> ($ por Par)`;
    }

    calculateAgTotal();
    openModal('assignGuarnicionModal');
};

const calculateAgTotal = () => {
    const pairs = parseInt(document.getElementById('agPairsInput').value) || 0;
    document.getElementById('agTotalPairs').textContent = pairs;
    const price = parseFloat(document.getElementById('agPaymentInput').value) || 0;
    document.getElementById('agTotalCalc').textContent = formatCurrency(pairs * price);
};

const handleAssignGuarnicionSubmit = (e) => {
    e.preventDefault();
    const workerId = document.getElementById('agWorkerSelect').value;
    const payment = parseFloat(document.getElementById('agPaymentInput').value) || 0;
    const assignedPairs = parseInt(document.getElementById('agPairsInput').value) || 0;

    // Worker selection is now optional - admin can receive work without assigning

    const t = state.tasks.find(x => x.id === currentCompletingTask);
    const nextTask = state.tasks.find(x => x.id === currentNextTask);

    if (assignedPairs <= 0 || assignedPairs > nextTask.pairs) {
        notify('Cantidad de pares inválida', 'error');
        return;
    }

    if (assignedPairs < nextTask.pairs) {
        // Split future block
        const futureTasks = state.tasks.filter(x => x.orderId === t.orderId && x.order >= t.order && x.id !== t.id && x.id !== nextTask.id);

        // Clones for assigned chunk
        const cloneT = { ...t, id: uid(), pairs: assignedPairs, status: 'terminada', finishedAt: new Date().toISOString() };
        const cloneNext = { ...nextTask, id: uid(), pairs: assignedPairs, status: 'pendiente', assignedTo: workerId, payment: payment * assignedPairs };

        state.tasks.push(cloneT, cloneNext);

        // Clones for the rest of phases downstream
        futureTasks.forEach(ft => {
            state.tasks.push({ ...ft, id: uid(), pairs: assignedPairs });
            ft.pairs -= assignedPairs; // reduce original
        });

        // reduce original pairs
        t.pairs -= assignedPairs;
        nextTask.pairs -= assignedPairs;

        // t and nextTask remain in their previous states (en_proceso/bloqueada) with reduced pairs
    } else {
        // Full assign
        t.status = 'terminada';
        t.finishedAt = new Date().toISOString();

        nextTask.status = 'pendiente';
        nextTask.assignedTo = workerId;
        nextTask.payment = payment * assignedPairs;
    }

    const wUser = state.users.find(u => u.id === workerId);
    const workerName = wUser ? (wUser.fullName || wUser.user) : '';
    const nextPhaseName = nextTask.phaseName || 'siguiente fase';
    addEvent(`Se entregaron ${assignedPairs} pares a ${nextPhaseName} (${workerName})`, 'success');

    saveState();
    closeModal('assignGuarnicionModal');
    renderTasks();
    notify(`Asignado a ${nextPhaseName} exitosamente`);
};

const openFinishTaskModal = (id) => {
    const t = state.tasks.find(x => x.id === id);
    currentCompletingTask = id;
    document.getElementById('ftMaxPairs').textContent = t.pairs;
    document.getElementById('ftPairsInput').max = t.pairs;
    document.getElementById('ftPairsInput').value = t.pairs;
    openModal('finishTaskModal');
};

const handleFinishTaskSubmit = (e) => {
    e.preventDefault();
    const deliveredPairs = parseInt(document.getElementById('ftPairsInput').value) || 0;
    const t = state.tasks.find(x => x.id === currentCompletingTask);

    if (deliveredPairs <= 0 || deliveredPairs > t.pairs) {
        notify('Cantidad de pares inválida', 'error');
        return;
    }

    // --- Removed Sole Deduction from Solador ---
    // Soles are now deducted upfront when the order is authorized (autorizarOrden) 
    // to strictly lock physical inventory.

    if (deliveredPairs < t.pairs) {
        const futureTasks = state.tasks.filter(x => x.orderId === t.orderId && x.order > t.order && x.pairs === t.pairs);

        const cloneT = { ...t, id: uid(), pairs: deliveredPairs, status: 'terminada', finishedAt: new Date().toISOString() };
        state.tasks.push(cloneT);

        futureTasks.forEach(ft => {
            const cloneFt = { ...ft, id: uid(), pairs: deliveredPairs };
            if (ft.order === t.order + 1) {
                cloneFt.status = 'pendiente';
            }
            state.tasks.push(cloneFt);
            ft.pairs -= deliveredPairs;
        });

        t.pairs -= deliveredPairs;
        addEvent(`Fase ${t.phaseName} entregó ${deliveredPairs} pares.`, 'success');
    } else {
        t.status = 'terminada';
        t.finishedAt = new Date().toISOString();

        const nextTask = state.tasks.find(n => n.orderId === t.orderId && n.order === t.order + 1 && n.pairs === t.pairs);
        if (nextTask) {
            nextTask.status = 'pendiente';
        } else {
            const orderTasks = state.tasks.filter(n => n.orderId === t.orderId);
            if (orderTasks.every(ot => ot.status === 'terminada' || ot.status === 'papelera')) {
                const o = state.orders.find(ord => ord.id === t.orderId);
                if (o) o.status = 'completada';
            }
        }
        addEvent(`Fase ${t.phaseName} terminada completa: ${t.model} `, 'success');
    }

    saveState();
    closeModal('finishTaskModal');
    renderTasks();
};

const completeTask = (id) => {
    const t = state.tasks.find(x => x.id === id);

    // Si es una tarea extra (Pintura), simplemente finalizarla sin seguir el flujo
    if (t.extraTask || t.phaseId === 'pintura') {
        t.status = 'terminada';
        t.finishedAt = new Date().toISOString();
        addEvent(`Tarea de Pintura completada: ${t.model} (${t.orderNum})`, 'success');
        saveState();
        renderTasks();
        notify(`Tarea de Pintura marcada como terminada`);
        return;
    }

    // Find the next phase task with matching pairs
    const nextTask = state.tasks.find(n => n.orderId === t.orderId && n.order === t.order + 1 && n.pairs === t.pairs);

    // If there's a next phase (not the last phase), open worker assignment modal
    if (nextTask && nextTask.phaseId !== 'almacen_dist') {
        // Bypass worker assignment modal for cortador phase to proceed automatically
        if (t.phaseId === 'cortador') {
            t.status = 'terminada';
            t.finishedAt = new Date().toISOString();

            nextTask.status = 'pendiente';
            nextTask.assignedTo = null;
            nextTask.payment = state.pricePerPair * t.pairs;

            addEvent(`Se avanzaron ${t.pairs} pares a ${nextTask.phaseName || 'siguiente fase'}`, 'success');

            saveState();
            renderTasks();
            notify(`Avanzado a ${nextTask.phaseName || 'siguiente fase'} exitosamente`);
            return;
        }

        openAssignGuarnicionModal(t.id, nextTask.id);
        return;
    }

    // Otherwise just finish the task (last phase or no matching next task)
    openFinishTaskModal(id);
};

// Worker-only: mark task as done without assigning next phase (Opens Pin Modal)
const workerFinishTask = (id) => {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;

    if (!t.assignedTo) {
        notify('No se puede finalizar la tarea: no tiene trabajador asignado.', 'error');
        return;
    }

    if (state.currentUser.role !== 'admin' && state.currentUser.id !== t.assignedTo) {
        notify('Solo el trabajador asignado puede entregar esta tarea.', 'error');
        return;
    }

    document.getElementById('pinTaskId').value = id;
    document.getElementById('pinInput').value = '';
    openModal('pinVerificationModal');
};

const handlePinVerificationSubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('pinTaskId').value;
    const pin = document.getElementById('pinInput').value.trim();
    const t = state.tasks.find(x => x.id === id);

    if (!t) return;

    // Validar con el CÓDIGO MAESTRO GLOBAL
    const masterPin = state.masterCode;

    if (!masterPin || pin !== masterPin) {
        notify('CÓDIGO DE TRABAJADOR incorrecto. Solicite el código nuevo al administrador.', 'error');
        return;
    }

    t.status = 'terminada';
    t.finishedAt = new Date().toISOString();

    // Auto-queue next task
    const nextTask = state.tasks.find(n => n.orderId === t.orderId && n.order === t.order + 1 && n.pairs === t.pairs);
    if (nextTask) {
        nextTask.status = 'pendiente';
    } else {
        const orderTasks = state.tasks.filter(n => n.orderId === t.orderId);
        if (orderTasks.every(ot => ot.status === 'terminada' || ot.status === 'papelera')) {
            const o = state.orders.find(ord => ord.id === t.orderId);
            if (o) o.status = 'completada';
        }
    }

    let workerName = 'Trabajador';
    if (t.assignedTo) {
        const wUser = state.users.find(u => u.id === t.assignedTo);
        if (wUser) workerName = wUser.fullName || wUser.user;
    }

    addEvent(`${workerName} terminó ${t.pairs} pares en ${t.phaseName}: ${t.model}`, 'success');

    // Invalidad el código maestro (usar una sola vez)
    state.masterCode = null;
    const masterDisplay = document.getElementById('globalMasterCodeDisplay');
    if (masterDisplay) masterDisplay.textContent = '----';

    saveState();
    closeModal('pinVerificationModal');
    renderTasks();
    notify('Tarea completada exitosamente. El código ha expirado.');
};
// --- Feature: Sales (Ventas) ---
const openSaleModal = (model, available) => {
    document.getElementById('saleModel').value = model;
    document.getElementById('saleModelName').textContent = model;
    document.getElementById('saleAvailable').textContent = available;
    document.getElementById('salePairs').max = available;
    document.getElementById('salePairs').value = '';
    document.getElementById('saleClient').value = '';
    document.getElementById('salePrice').value = '25.00';
    document.getElementById('saleTotalCalc').textContent = formatCurrency(0);
    openModal('saleModal');
};

const calculateSaleTotal = () => {
    const pairs = parseInt(document.getElementById('salePairs').value) || 0;
    const price = parseFloat(document.getElementById('salePrice').value) || 0;
    document.getElementById('saleTotalCalc').textContent = formatCurrency(pairs * price);
};

const handleSaleSubmit = (e) => {
    e.preventDefault();
    if (state.currentUser?.role === 'observador') {
        notify('Modo Observador: No puedes registrar ventas.', 'error');
        return;
    }
    const model = document.getElementById('saleModel').value;
    const pairs = parseInt(document.getElementById('salePairs').value);
    const client = document.getElementById('saleClient').value;
    const price = parseFloat(document.getElementById('salePrice').value) || 0;
    const available = parseInt(document.getElementById('saleAvailable').textContent);

    if (pairs <= 0 || pairs > available) {
        notify('Cantidad de pares inválida', 'error');
        return;
    }

    const sale = {
        id: uid(),
        model: model,
        pairs: pairs,
        client: client,
        pricePerPair: price,
        total: pairs * price,
        date: new Date().toISOString(),
        soldBy: state.currentUser?.user || 'admin'
    };

    state.sales.push(sale);
    addEvent(`Venta registrada: ${pairs} pares de "${model}" a ${client || 'cliente no especificado'} por ${formatCurrency(sale.total)} `, 'success');
    saveState();
    closeModal('saleModal');
    renderTasks();
    if (currentPage === 'sales') renderSales();
    notify(`Venta de ${pairs} pares de "${model}" registrada exitosamente`);

    // Automatically trigger print for the new sale
    setTimeout(() => printSale(sale.id), 500);
};

const printSale = (saleId) => {
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) return;

    document.getElementById('receiptDate').textContent = new Date(sale.date).toLocaleString('es-ES');
    document.getElementById('receiptClient').textContent = sale.client || 'Mostrador';
    document.getElementById('receiptSeller').textContent = sale.soldBy || 'Local';
    document.getElementById('receiptQty').textContent = sale.pairs;
    document.getElementById('receiptModel').textContent = sale.model;
    document.getElementById('receiptTotal').textContent = formatCurrency(sale.total);
    document.getElementById('receiptGrandTotal').textContent = formatCurrency(sale.total);

    window.print();
};

// --- Feature: Sales Page ---
const getFinishedInventory = () => {
    const finishedTasks = state.tasks.filter(t => t.phaseId === 'almacen_dist' && t.status === 'terminada');
    const inventory = {};
    finishedTasks.forEach(t => {
        const order = state.orders.find(o => o.id === t.orderId);
        if (!inventory[t.model]) {
            inventory[t.model] = { produced: 0, photo: order?.photo || null, orders: new Set() };
        }
        inventory[t.model].produced += t.pairs;
        inventory[t.model].orders.add(t.orderNum);
    });
    state.sales.forEach(s => {
        if (inventory[s.model]) {
            if (!inventory[s.model].sold) inventory[s.model].sold = 0;
            inventory[s.model].sold += s.pairs;
        }
    });
    Object.keys(inventory).forEach(m => {
        inventory[m].sold = inventory[m].sold || 0;
        inventory[m].available = inventory[m].produced - inventory[m].sold;
    });
    return inventory;
};

const renderSales = () => {
    const inventory = getFinishedInventory();
    const totalAvailable = Object.values(inventory).reduce((sum, v) => sum + v.available, 0);
    const totalSold = Object.values(inventory).reduce((sum, v) => sum + v.sold, 0);
    const totalRevenue = state.sales.reduce((sum, s) => sum + s.total, 0);
    const modelCount = Object.keys(inventory).length;

    // ── Stock table rows ──────────────────────────────────────
    let inventoryRows = '';
    Object.entries(inventory).forEach(([model, data]) => {
        const photoHtml = data.photo
            ? `<img src="${data.photo}" style="width:40px;height:40px;object-fit:cover;border-radius:10px;border:1.5px solid var(--border-light);flex-shrink:0">`
            : `<div style="width:40px;height:40px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:10px;display:grid;place-items:center;flex-shrink:0;color:var(--success-600)">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 16c0-1.5.8-3 2.2-3.8l4.5-3c.8-.5 1.3-1.5 1.3-2.5V4.5c0-.8.8-1.3 1.5-.9l2.2 1.1c.8.4 1.3 1.1 1.5 1.9l.8 3c.4 1.5 1.5 2.6 3 3h.8c.8 0 1.2.7 1.2 1.3v2c0 .7-.5 1.2-1.2 1.2H4.2c-.7 0-1.2-.5-1.2-1.2v-.4z" fill="currentColor" opacity=".35"/></svg>
               </div>`;

        const stockLevel = data.available === 0 ? 'empty' : data.available < 5 ? 'low' : 'ok';
        const stockBadge = stockLevel === 'ok'
            ? `<span style="display:inline-flex;align-items:center;gap:5px;background:#dcfce7;color:#166534;padding:4px 12px;border-radius:99px;font-size:0.78rem;font-weight:700;border:1px solid #bbf7d0"><span style="width:5px;height:5px;border-radius:50%;background:#16a34a"></span>${data.available}</span>`
            : stockLevel === 'low'
                ? `<span style="display:inline-flex;align-items:center;gap:5px;background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:99px;font-size:0.78rem;font-weight:700;border:1px solid #fde68a"><span style="width:5px;height:5px;border-radius:50%;background:#f59e0b"></span>${data.available} ⚠️</span>`
                : `<span style="display:inline-flex;align-items:center;gap:5px;background:#f1f5f9;color:#64748b;padding:4px 12px;border-radius:99px;font-size:0.78rem;font-weight:700;border:1px solid #e2e8f0">Sin stock</span>`;

        const actionHtml = data.available > 0
            ? `<button onclick="openSaleModal('${model}', ${data.available})" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;background:linear-gradient(135deg,var(--success-500),#059669);color:white;border:none;border-radius:8px;font-size:0.78rem;font-weight:700;cursor:pointer;transition:all 0.15s;box-shadow:0 2px 8px rgba(16,185,129,0.3)" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 14px rgba(16,185,129,0.4)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 2px 8px rgba(16,185,129,0.3)'">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                Vender
              </button>`
            : `<span style="color:var(--text-muted);font-size:0.78rem;font-style:italic">Sin stock</span>`;

        inventoryRows += `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:12px">
                        ${photoHtml}
                        <div style="font-weight:700;color:var(--text-primary);font-size:0.9rem">${model}</div>
                    </div>
                </td>
                <td style="text-align:center">
                    <span style="background:#eef2ff;color:#4338ca;padding:4px 12px;border-radius:99px;font-weight:700;font-size:0.82rem">${data.produced}</span>
                </td>
                <td style="text-align:center">
                    <span style="background:#fee2e2;color:#991b1b;padding:4px 12px;border-radius:99px;font-weight:700;font-size:0.82rem">${data.sold}</span>
                </td>
                <td style="text-align:center">${stockBadge}</td>
                <td style="text-align:center">${actionHtml}</td>
            </tr>`;
    });

    const inventoryTableHtml = modelCount === 0
        ? `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
               <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.2;margin:0 auto 12px;display:block"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
               <div style="font-weight:600;font-size:0.9rem">No hay productos terminados en el Almacén Final</div>
           </div>`
        : `<table style="width:100%;border-collapse:collapse">
               <thead>
                   <tr>
                       <th style="text-align:left;padding:12px 20px;font-size:0.69rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);border-bottom:1px solid var(--border-light)">Modelo</th>
                       <th style="text-align:center;padding:12px 20px;font-size:0.69rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);border-bottom:1px solid var(--border-light)">Producidos</th>
                       <th style="text-align:center;padding:12px 20px;font-size:0.69rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);border-bottom:1px solid var(--border-light)">Vendidos</th>
                       <th style="text-align:center;padding:12px 20px;font-size:0.69rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);border-bottom:1px solid var(--border-light)">Disponibles</th>
                       <th style="text-align:center;padding:12px 20px;font-size:0.69rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);border-bottom:1px solid var(--border-light)">Acción</th>
                   </tr>
               </thead>
               <tbody>${inventoryRows}</tbody>
           </table>`;

    // ── Inventory panel HTML ──────────────────────────────────
    const panel = document.getElementById('salesInventoryPanel');
    panel.innerHTML = `
        <!-- KPI Stats -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:22px">
            <div style="background:white;border-radius:16px;padding:18px 20px;border:1px solid var(--border-light);box-shadow:var(--shadow-sm);border-top:3px solid var(--brand-500);display:flex;align-items:center;gap:14px">
                <div style="width:44px;height:44px;border-radius:12px;background:#eef2ff;display:grid;place-items:center;color:var(--brand-600);flex-shrink:0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                </div>
                <div>
                    <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:3px">Total Ventas</div>
                    <div style="font-family:'Outfit',sans-serif;font-size:1.7rem;font-weight:800;line-height:1;color:var(--text-primary)">${state.sales.length}</div>
                </div>
            </div>
            <div style="background:white;border-radius:16px;padding:18px 20px;border:1px solid var(--border-light);box-shadow:var(--shadow-sm);border-top:3px solid var(--success-500);display:flex;align-items:center;gap:14px">
                <div style="width:44px;height:44px;border-radius:12px;background:#ecfdf5;display:grid;place-items:center;color:var(--success-600);flex-shrink:0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 16c0-1.5.8-3 2.2-3.8l4.5-3c.8-.5 1.3-1.5 1.3-2.5V4.5c0-.8.8-1.3 1.5-.9l2.2 1.1c.8.4 1.3 1.1 1.5 1.9l.8 3c.4 1.5 1.5 2.6 3 3h.8c.8 0 1.2.7 1.2 1.3v2c0 .7-.5 1.2-1.2 1.2H4.2c-.7 0-1.2-.5-1.2-1.2v-.4z" fill="currentColor" opacity=".25"/></svg>
                </div>
                <div>
                    <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:3px">Pares Vendidos</div>
                    <div style="font-family:'Outfit',sans-serif;font-size:1.7rem;font-weight:800;line-height:1;color:var(--success-600)">${totalSold}</div>
                </div>
            </div>
            <div style="background:white;border-radius:16px;padding:18px 20px;border:1px solid var(--border-light);box-shadow:var(--shadow-sm);border-top:3px solid var(--warning-500);display:flex;align-items:center;gap:14px">
                <div style="width:44px;height:44px;border-radius:12px;background:#fffbeb;display:grid;place-items:center;color:var(--warning-600);flex-shrink:0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                </div>
                <div>
                    <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:3px">Disponibles</div>
                    <div style="font-family:'Outfit',sans-serif;font-size:1.7rem;font-weight:800;line-height:1;color:var(--warning-600)">${totalAvailable}</div>
                </div>
            </div>
            <div style="background:white;border-radius:16px;padding:18px 20px;border:1px solid var(--border-light);box-shadow:var(--shadow-sm);border-top:3px solid #8b5cf6;display:flex;align-items:center;gap:14px">
                <div style="width:44px;height:44px;border-radius:12px;background:#faf5ff;display:grid;place-items:center;color:#7c3aed;flex-shrink:0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div>
                    <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:3px">Ingresos</div>
                    <div style="font-family:'Outfit',sans-serif;font-size:1.5rem;font-weight:800;line-height:1;color:#7c3aed;letter-spacing:-0.02em">${formatCurrency(totalRevenue)}</div>
                </div>
            </div>
        </div>

        <!-- Stock desde Almacén Final -->
        <div style="background:white;border-radius:20px;border:1px solid var(--border-light);box-shadow:var(--shadow-md);margin-bottom:8px;overflow:hidden">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid var(--border-light);background:var(--gray-50)">
                <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:34px;height:34px;background:#ecfdf5;border-radius:9px;display:grid;place-items:center;color:var(--success-600)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <div>
                        <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary)">Stock del Almacén Final</div>
                        <div style="font-size:0.72rem;color:var(--text-muted)">${modelCount} modelo${modelCount !== 1 ? 's' : ''} disponible${modelCount !== 1 ? 's' : ''}</div>
                    </div>
                </div>
                <span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:99px;font-size:0.72rem;font-weight:700;border:1px solid #bbf7d0">${totalAvailable} pares</span>
            </div>
            ${inventoryTableHtml}
        </div>
    `;

    // ── Sales history table ───────────────────────────────────
    renderSalesHistoryTable(state.sales);
};

const renderSalesHistoryTable = (sales) => {
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;
    if (!sales || sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:60px 20px">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.2;margin:0 auto 12px;display:block"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div style="font-weight:600;font-size:0.9rem">No hay ventas registradas</div>
        </td></tr>`;
        return;
    }
    tbody.innerHTML = [...sales].reverse().map(s => {
        const dateStr = new Date(s.date).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        return `
            <tr>
                <td>
                    <div style="font-weight:600;font-size:0.85rem;color:var(--text-primary)">${dateStr}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted)">${new Date(s.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td>
                    <div style="font-weight:700;color:var(--text-primary)">${s.model}</div>
                </td>
                <td style="text-align:center">
                    <span style="background:#dbeafe;color:#1d4ed8;padding:4px 12px;border-radius:99px;font-weight:700;font-size:0.82rem">${s.pairs} par${s.pairs !== 1 ? 'es' : ''}</span>
                </td>
                <td>
                    ${s.client
                ? `<div style="font-weight:600;font-size:0.85rem">${s.client}</div>`
                : `<span style="color:var(--text-muted);font-style:italic;font-size:0.82rem">—</span>`
            }
                </td>
                <td style="text-align:right">
                    <span style="font-size:0.85rem;color:var(--text-secondary);font-weight:500">${formatCurrency(s.pricePerPair)}</span>
                </td>
                <td style="text-align:right">
                    <span style="font-family:'Outfit',sans-serif;font-size:1rem;font-weight:800;color:var(--success-600)">${formatCurrency(s.total)}</span>
                </td>
                <td style="text-align:center">
                    <button onclick="printSale('${s.id}')" title="Imprimir Recibo" style="width:32px;height:32px;border:1px solid var(--border-light);background:white;border-radius:7px;cursor:pointer;display:grid;place-items:center;color:var(--text-secondary);transition:all 0.15s" onmouseover="this.style.background='var(--brand-50)';this.style.borderColor='var(--brand-300)';this.style.color='var(--brand-600)'" onmouseout="this.style.background='white';this.style.borderColor='var(--border-light)';this.style.color='var(--text-secondary)'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    </button>
                </td>
            </tr>`;
    }).join('');
};

const searchSalesHistory = (query) => {
    const q = query.toLowerCase();
    const filtered = q
        ? state.sales.filter(s =>
            s.model?.toLowerCase().includes(q) ||
            s.client?.toLowerCase().includes(q)
        )
        : state.sales;
    renderSalesHistoryTable(filtered);
};


const openSaleModalFromPage = () => {
    const inventory = getFinishedInventory();
    const models = Object.entries(inventory).filter(([_, d]) => d.available > 0);
    if (models.length === 0) {
        notify('No hay productos disponibles para vender', 'error');
        return;
    }
    if (models.length === 1) {
        openSaleModal(models[0][0], models[0][1].available);
    } else {
        // Show a selection list
        const modelList = models.map(([m, d], i) => `${i + 1}. ${m} (${d.available} pares)`).join('\n');
        const choice = prompt(`Seleccione el modelo a vender: \n\n${modelList} \n\nIngrese el número: `);
        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < models.length) {
            openSaleModal(models[idx][0], models[idx][1].available);
        }
    }
};



// --- Feature: Payroll (Nómina) ---
const updatePayroll = () => {
    state.pricePerPair = parseFloat(document.getElementById('pricePerPair').value) || 0;
    saveState();
    renderPayroll();
};

const renderPayroll = () => {
    const tbody = document.getElementById('payrollTableBody');
    let grandTotal = 0;

    document.getElementById('pricePerPair').value = state.pricePerPair;

    const workerSummary = state.users.filter(u => u.role !== 'admin' && u.status !== 'inactivo').map(u => {
        const tasks = state.tasks.filter(t => t.assignedTo === u.id && t.status === 'terminada');

        const totalOwed = tasks.filter(t => !t.paid).reduce((sum, t) => sum + (t.payment || (state.pricePerPair * t.pairs)), 0);
        const totalPaid = tasks.filter(t => t.paid).reduce((sum, t) => sum + (t.payment || (state.pricePerPair * t.pairs)), 0);
        const totalPairs = tasks.reduce((sum, t) => sum + t.pairs, 0);

        grandTotal += totalOwed;

        return { ...u, name: u.fullName || u.user, area: u.role, phone: u.phone, pairs: totalPairs, tasksCount: tasks.length, totalOwed, totalPaid };
    });

    // Handle unassigned tasks
    const unassignedTasks = state.tasks.filter(t => t.assignedTo === null && t.status === 'terminada');
    const unassignedOwed = unassignedTasks.filter(t => !t.paid).reduce((sum, t) => sum + (t.payment || (state.pricePerPair * t.pairs)), 0);
    const unassignedPaid = unassignedTasks.filter(t => t.paid).reduce((sum, t) => sum + (t.payment || (state.pricePerPair * t.pairs)), 0);
    grandTotal += unassignedOwed;

    document.getElementById('payrollTotal').textContent = formatCurrency(grandTotal);

    let html = workerSummary.filter(w => w.tasksCount > 0).map(w => `
        <tr>
            <td><strong>${w.name}</strong></td>
            <td>${PHASES.find(ph => ph.id === w.area)?.name || (w.area === 'pintura' ? '🖌️ Pintura de Suela' : w.area)}</td>
            <td>${w.pairs} pares (${w.tasksCount} tareas)</td>
            <td>
                <div style="font-size:0.875rem">
                    <div style="color:var(--danger-500);font-weight:700">Deuda: ${formatCurrency(w.totalOwed)}</div>
                    <div style="color:var(--success-500);font-size:0.75rem">Pagado: ${formatCurrency(w.totalPaid)}</div>
                </div>
            </td>
            <td>
                ${w.totalOwed > 0 ? `<button class="btn btn-primary btn-sm" onclick="payWorker('${w.id}')">Marcar Pagado</button>` : '<span style="color:var(--success-500);font-weight:600;font-size:0.875rem">✓ Al día</span>'}
            </td>
        </tr>
    `).join('');

    if (unassignedTasks.length > 0) {
        html += `
        <tr style="background:var(--brand-50)">
                <td><strong>Pendiente por asignar</strong></td>
                <td>—</td>
                <td>${unassignedTasks.reduce((s, t) => s + t.pairs, 0)} pares (${unassignedTasks.length} tareas)</td>
                <td>
                    <div style="font-size:0.875rem">
                        <div style="color:var(--danger-500);font-weight:700">Deuda: ${formatCurrency(unassignedOwed)}</div>
                        <div style="color:var(--success-500);font-size:0.75rem">Pagado: ${formatCurrency(unassignedPaid)}</div>
                    </div>
                </td>
                <td>
                    ${unassignedOwed > 0 ? `<button class="btn btn-primary btn-sm" onclick="payWorker(null)">Marcar Pagado</button>` : '<span style="color:var(--success-500);font-weight:600;font-size:0.875rem">✓ Al día</span>'}
                </td>
            </tr>
    `;
    }

    tbody.innerHTML = html;

    if (workerSummary.filter(w => w.tasksCount > 0).length === 0 && unassignedTasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px">Sin producción registrada</td></tr>';
    }

    const pHistoryBody = document.getElementById('paymentHistoryTableBody');
    if (pHistoryBody) {
        if (!state.payments || state.payments.length === 0) {
            pHistoryBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:40px">No hay pagos registrados</td></tr>';
        } else {
            pHistoryBody.innerHTML = [...state.payments].reverse().map(p => `
                <tr>
                    <td>${new Date(p.date).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>${p.workerName}</strong></td>
                    <td style="color:var(--success-500);font-weight:700">${formatCurrency(p.amount)}</td>
                    <td><span class="badge" style="background:var(--brand-50);color:var(--brand-600)">${p.registeredBy}</span></td>
                </tr>
            `).join('');
        }
    }
};

const payWorker = (workerId) => {
    const tasks = state.tasks.filter(t => t.assignedTo === workerId && t.status === 'terminada' && !t.paid);
    if (tasks.length === 0) return;

    const amount = tasks.reduce((sum, t) => sum + (t.payment || (state.pricePerPair * t.pairs)), 0);
    const wUser = workerId ? state.users.find(u => u.id === workerId) : null;
    const name = wUser ? (wUser.fullName || wUser.user) : 'personal pendiente por asignar';

    if (confirm(`¿Confirmar pago de ${formatCurrency(amount)} a ${name}?`)) {
        tasks.forEach(t => t.paid = true);

        if (!state.payments) state.payments = [];
        state.payments.push({
            id: uid(),
            workerId: workerId || 'unassigned',
            workerName: name,
            amount: amount,
            date: new Date().toISOString(),
            registeredBy: state.currentUser?.user || 'Sistema'
        });

        addEvent(`Pago realizado a ${name}: ${formatCurrency(amount)} `, 'success');
        saveState();
        renderPayroll();
        notify(`Pago realizado a ${name} `);
    }
};

// --- Feature: Trash ---
const renderTrash = () => {
    const tbody = document.getElementById('trashTableBody');
    tbody.innerHTML = state.trash.slice().reverse().map((t, idx) => `
        <tr>
            <td><span class="badge">${t.type.toUpperCase()}</span></td>
            <td>${t.data.name || t.data.model || t.data.num}</td>
            <td>${new Date(t.time).toLocaleString()}</td>
            <td>
                <button class="btn btn-ghost" onclick="restoreFromTrash(${state.trash.length - 1 - idx})">Restaurar</button>
            </td>
        </tr>
    `).join('');
};

// Removed emptyTrash as per request

const restoreFromTrash = (idx) => {
    const item = state.trash.splice(idx, 1)[0];
    if (item.type === 'order') state.orders.push(item.data);
    if (item.type === 'material') state.materials.push(item.data);
    if (item.type === 'worker') {
        const data = item.data;
        if (!state.users.find(u => u.id === data.id)) {
            state.users.push({
                id: data.id, fullName: data.name, user: data.username || data.name, pass: data.password || '123',
                status: data.status || 'activo', role: data.area, phone: data.phone, permissions: ['dashboard', 'tasks']
            });
        }
    }
    saveState();
    renderTrash();
    notify('Elemento restaurado');
};

// --- Feature: Access Management (ERP Style) ---
const handleAccessSubmit = (e) => {
    e.preventDefault();

    const perms = [];
    document.querySelectorAll('.perm-check:checked').forEach(cb => perms.push(cb.value));

    const editId = document.getElementById('accessEditId').value;
    const userData = {
        fullName: document.getElementById('accessFullName').value,
        phone: document.getElementById('accessPhone').value || '',
        user: document.getElementById('accessUser').value,
        role: document.getElementById('accessRole').value,
        pass: document.getElementById('accessPass').value,
        status: document.getElementById('accessStatus').value,
        isSupervisor: document.getElementById('accessIsSupervisor').checked,
        permissions: perms
    };

    if (editId) {
        const idx = state.users.findIndex(u => u.id === editId);
        if (idx !== -1) {
            state.users[idx] = { ...state.users[idx], ...userData };
            notify('Usuario actualizado con éxito');
        }
    } else {
        if (state.users.find(u => u.user === userData.user)) {
            notify('El nombre de usuario ya existe', 'error');
            return;
        }
        const newUser = { id: uid(), lastLogin: null, isConnected: false, ...userData };
        state.users.push(newUser);
        notify('Usuario registrado con éxito');
    }

    saveState();
    closeModal('accessModal');
    renderAccess();
};

const editAccess = (id) => {
    const u = state.users.find(x => x.id === id);
    if (!u) return;

    document.getElementById('accessModalTitle').textContent = 'Editar Usuario y Permisos';
    document.getElementById('accessEditId').value = u.id;
    document.getElementById('accessFullName').value = u.fullName || '';
    document.getElementById('accessPhone').value = u.phone || '';
    document.getElementById('accessUser').value = u.user;
    document.getElementById('accessPass').value = u.pass;
    document.getElementById('accessStatus').value = u.status || 'activo';
    document.getElementById('accessRole').value = u.role;
    document.getElementById('accessIsSupervisor').checked = u.isSupervisor || false;

    // Set permissions
    document.querySelectorAll('.perm-check').forEach(cb => {
        cb.checked = (u.permissions || []).includes(cb.value);
    });

    openModal('accessModal');
};

const openNewAccessModal = () => {
    document.getElementById('accessForm').reset();
    document.getElementById('accessEditId').value = '';
    document.getElementById('accessModalTitle').textContent = 'Registro de Usuario';
    document.querySelectorAll('.perm-check').forEach(cb => cb.checked = false);
    openModal('accessModal');
};

// Role display mapping
const ROLE_META = {
    admin: { label: 'Admin', bg: '#faf5ff', color: '#7c3aed', border: '#e9d5ff' },
    cortador: { label: 'Cortador', bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
    guarnicion: { label: 'Guarnición', bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
    solador: { label: 'Solador', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    acabado: { label: 'Acabado', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    almacen_dist: { label: 'Almacén', bg: '#f0f9ff', color: '#0c4a6e', border: '#bae6fd' },
    pintura: { label: 'Pintura', bg: '#fdf4ff', color: '#86198f', border: '#f0abfc' },
    observador: { label: 'Observador', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
};

const AVATAR_COLORS = [
    '#4f46e5', '#7c3aed', '#059669', '#b45309', '#0284c7', '#dc2626', '#0891b2', '#9333ea'
];

const getUserAvatarColor = (userId) => {
    let hash = 0;
    for (let i = 0; i < (userId || 'u').length; i++) hash = (hash * 31 + (userId || 'u').charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const buildUserRow = (u) => {
    const meta = ROLE_META[u.role] || ROLE_META.observador;
    const avatarColor = getUserAvatarColor(u.id);
    const initial = (u.fullName || u.user || '?').charAt(0).toUpperCase();
    const lastLogin = u.lastLogin
        ? new Date(u.lastLogin).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '<span style="color:var(--text-muted);font-style:italic">Sin acceso</span>';
    const isCurrentAdmin = state.currentUser?.role === 'admin';

    return `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="width:38px;height:38px;border-radius:50%;background:${avatarColor};display:grid;place-items:center;font-weight:700;color:white;font-size:0.88rem;flex-shrink:0;letter-spacing:-0.01em">
                        ${initial}
                    </div>
                    <div>
                        <div style="font-weight:700;color:var(--text-primary);font-size:0.9rem;line-height:1.3">
                            ${u.fullName || u.user}
                            ${u.isSupervisor ? '<span class="supervisor-tag" style="margin-left:6px">SUPERVISOR</span>' : ''}
                        </div>
                        <div style="font-size:0.73rem;color:var(--text-muted);margin-top:1px">${u.status === 'inactivo' ? '⛔ Inactivo' : '✓ Cuenta activa'}</div>
                    </div>
                </div>
            </td>
            <td>
                <code style="background:var(--gray-100);padding:3px 9px;border-radius:6px;font-size:0.82rem;font-weight:600;color:var(--text-secondary);letter-spacing:0.02em">${u.user}</code>
            </td>
            <td>
                <span style="display:inline-flex;align-items:center;padding:4px 12px;border-radius:99px;font-size:0.72rem;font-weight:700;letter-spacing:0.05em;background:${meta.bg};color:${meta.color};border:1px solid ${meta.border}">
                    ${meta.label.toUpperCase()}
                </span>
            </td>
            <td>
                ${u.isConnected
            ? '<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;font-size:0.72rem;font-weight:700;background:#dcfce7;color:#166534;border:1px solid #bbf7d0"><span style="width:6px;height:6px;border-radius:50%;background:#16a34a;box-shadow:0 0 5px #16a34a"></span>ACTIVO</span>'
            : '<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;font-size:0.72rem;font-weight:700;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1"><span style="width:6px;height:6px;border-radius:50%;background:#94a3b8"></span>INACTIVO</span>'
        }
            </td>
            <td style="font-size:0.8rem;color:var(--text-secondary)">${lastLogin}</td>
            <td>
                <div style="display:flex;justify-content:center;gap:6px">
                    ${isCurrentAdmin ? `
                    <button onclick="editAccess('${u.id}')" title="Editar usuario" style="width:34px;height:34px;border:1px solid var(--border-light);background:white;border-radius:8px;cursor:pointer;display:grid;place-items:center;color:var(--text-secondary);transition:all 0.15s" onmouseover="this.style.background='var(--brand-50)';this.style.borderColor='var(--brand-300)';this.style.color='var(--brand-600)'" onmouseout="this.style.background='white';this.style.borderColor='var(--border-light)';this.style.color='var(--text-secondary)'">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>` : ''}
                    ${isCurrentAdmin && u.id !== 'admin' ? `
                    <button onclick="deleteAccess('${u.id}')" title="Eliminar usuario" style="width:34px;height:34px;border:1px solid var(--border-light);background:white;border-radius:8px;cursor:pointer;display:grid;place-items:center;color:var(--text-secondary);transition:all 0.15s" onmouseover="this.style.background='var(--danger-50)';this.style.borderColor='#fca5a5';this.style.color='var(--danger-600)'" onmouseout="this.style.background='white';this.style.borderColor='var(--border-light)';this.style.color='var(--text-secondary)'">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>` : ''}
                </div>
            </td>
        </tr>
    `;
};

const updateAccessStats = () => {
    const total = document.getElementById('stat-total-users');
    const active = document.getElementById('stat-active-users');
    const admins = document.getElementById('stat-admin-users');
    if (total) total.textContent = state.users.length;
    if (active) active.textContent = state.users.filter(u => u.status !== 'inactivo').length;
    if (admins) admins.textContent = state.users.filter(u => u.role === 'admin').length;
};

const renderAccess = () => {
    const tbody = document.getElementById('accessTableBody');
    if (!tbody) return;
    tbody.innerHTML = state.users.map(buildUserRow).join('');
    const rowInfo = document.getElementById('rowCountInfo');
    if (rowInfo) rowInfo.textContent = `${state.users.length} registros`;
    updateAccessStats();
};


const deleteAccess = (id) => {
    if (state.currentUser?.role !== 'admin') {
        notify('Solo los administradores pueden eliminar registros.', 'error');
        return;
    }
    if (confirm('¿Eliminar este acceso permanentemente?')) {
        state.users = state.users.filter(u => u.id !== id);
        saveState();
        renderAccess();
    }
};

const filterUsers = (query) => {
    const tbody = document.getElementById('accessTableBody');
    if (!tbody) return;

    const q = query.toLowerCase();
    const filtered = q
        ? state.users.filter(u =>
            (u.fullName || '').toLowerCase().includes(q) ||
            u.user.toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q)
        )
        : state.users;

    tbody.innerHTML = filtered.map(buildUserRow).join('');
    const rowInfo = document.getElementById('rowCountInfo');
    if (rowInfo) rowInfo.textContent = `${filtered.length} de ${state.users.length} registros`;
};


// --- Initial Setup ---
const updateDate = () => {
    const now = new Date();
    document.getElementById('topDate').textContent = now.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// Start the app
document.addEventListener('DOMContentLoaded', () => {
    updateDate();
    checkSession(); // Added for Auth

    // Initial Master Code Display
    const display = document.getElementById('globalMasterCodeDisplay');
    if (display) display.textContent = state.masterCode || '----';

    // Auto-update clock
    setInterval(updateDate, 60000);

    window.addEventListener('beforeunload', () => {
        if (state.currentUser) {
            const userInState = state.users.find(u => u.id === state.currentUser.id);
            if (userInState) {
                userInState.isConnected = false;
                saveState();
            }
        }
    });
});

// Expose globals for onclick handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.startTask = startTask;
window.completeTask = completeTask;
window.setPhase = setPhase;
window.deleteOrder = deleteOrder;
window.adjustStock = adjustStock;
window.deleteMaterial = deleteMaterial;
window.updatePayroll = updatePayroll;
window.payWorker = payWorker;
window.restoreFromTrash = restoreFromTrash;
window.handleOrderSubmit = handleOrderSubmit;
window.handleMaterialSubmit = handleMaterialSubmit;
window.handleStartTaskSubmit = handleStartTaskSubmit;
window.handleLogin = handleLogin;
window.logout = logout;
window.handlePinVerificationSubmit = handlePinVerificationSubmit;
window.handleAccessSubmit = handleAccessSubmit;
window.editAccess = editAccess;
window.deleteAccess = deleteAccess;
window.filterUsers = filterUsers;
window.printSale = printSale;
window.autorizarOrden = autorizarOrden;
window.notify = notify;
window.navigate = navigate;
window.editOrder = editOrder;
window.openOrderModal = openOrderModal;
window.openSoleTypeModal = openSoleTypeModal;
window.handleSoleTypeSubmit = handleSoleTypeSubmit;
window.openSolePurchaseModal = openSolePurchaseModal;
window.handleSolePurchaseSubmit = handleSolePurchaseSubmit;
window.addSolePurchaseLine = addSolePurchaseLine;
window.removeSolePurchaseLine = removeSolePurchaseLine;
window.calcSolePurchaseTotal = calcSolePurchaseTotal;
window.adjustSoleStock = adjustSoleStock;
window.switchWarehouseTab = switchWarehouseTab;
window.openSaleModalFromPage = openSaleModalFromPage;
window.handleSaleSubmit = handleSaleSubmit;
window.calculateSaleTotal = calculateSaleTotal;
window.workerFinishTask = workerFinishTask;
window.openAssignGuarnicionModal = openAssignGuarnicionModal;
window.handleAssignGuarnicionSubmit = handleAssignGuarnicionSubmit;
window.openFinishTaskModal = openFinishTaskModal;
window.handleFinishTaskSubmit = handleFinishTaskSubmit;
window.openNewAccessModal = openNewAccessModal;
window.calculateOrderCortadorTotal = calculateOrderCortadorTotal;
window.calculateTotalPairs = calculateTotalPairs;
window.updateOrderInitialPhaseUI = updateOrderInitialPhaseUI;

window.togglePendingSolesFilter = togglePendingSolesFilter;

// --- Render History ---
const renderHistory = () => {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    // Read date filters
    const filterStartStr = document.getElementById('historyFilterStart')?.value;
    const filterEndStr = document.getElementById('historyFilterEnd')?.value;

    let eventsToShow = [...state.events];

    if (filterStartStr) {
        const startNum = new Date(filterStartStr + 'T00:00:00').getTime();
        eventsToShow = eventsToShow.filter(e => new Date(e.timestamp).getTime() >= startNum);
    }

    if (filterEndStr) {
        const endNum = new Date(filterEndStr + 'T23:59:59').getTime();
        eventsToShow = eventsToShow.filter(e => new Date(e.timestamp).getTime() <= endNum);
    }

    tbody.innerHTML = '';

    if (eventsToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;">No hay eventos registrados en ese rango de fechas</td></tr>';
        return;
    }

    // Mostramos los eventos más recientes primero
    const reversedEvents = eventsToShow.reverse();

    reversedEvents.forEach(evt => {
        const tr = document.createElement('tr');
        const date = new Date(evt.timestamp).toLocaleString('es-ES', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        // Asignar color según tipo
        let typeBadge = '';
        if (evt.type === 'success') typeBadge = '<span class="badge badge-success">Operación Completada</span>';
        else if (evt.type === 'info') typeBadge = '<span class="badge badge-info">Ingreso / Movimiento</span>';
        else if (evt.type === 'warning') typeBadge = '<span class="badge badge-warning">Modificación</span>';
        else if (evt.type === 'error') typeBadge = '<span class="badge badge-danger">Eliminación / Error</span>';
        else typeBadge = `<span class="badge badge-info">${evt.type}</span>`;

        tr.innerHTML = `
            <td style="padding:16px 24px;white-space:nowrap">${date}</td>
            <td style="padding:16px 24px;font-weight:500">${evt.message}</td>
            <td style="padding:16px 24px">${typeBadge}</td>
        `;
        tbody.appendChild(tr);
    });
};

window.updatePladeSolePhoto = updatePladeSolePhoto;
window.triggerSolePhotoUpload = triggerSolePhotoUpload;
window.voidSolePurchase = voidSolePurchase;
window.renderHistory = renderHistory;

// --- Feature: Plade Orders UI ---
let mCart = [];

const initPladeNewOrder = () => {
    mCart = [];
    document.getElementById('pladeDateStart').value = new Date().toISOString().split('T')[0];

    // Set deadline 7 days from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    document.getElementById('pladeDateEnd').value = d.toISOString().split('T')[0];

    // Populate Cortadores
    const cortadorSelect = document.getElementById('pladeGlobalCortador');
    const cortadores = state.users.filter(u => u.role === 'cortador' && u.status !== 'inactivo');
    cortadorSelect.innerHTML = '<option value="">-- Pendiente por asignar --</option>' +
        cortadores.map(u => `<option value="${u.id}">${u.fullName || u.user}</option>`).join('');

    renderPladeQuickItems();
    renderPladeCart();
};

const renderPladeQuickItems = (query = '') => {
    const grid = document.getElementById('pladeQuickItemsGrid');

    // Get unique models from history/state
    const uniqueModels = [...new Set(state.orders.map(o => o.model))].filter(Boolean);

    let items = uniqueModels;
    if (query) {
        items = items.filter(m => m.toLowerCase().includes(query.toLowerCase()));
    }

    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:#94a3b8;">No hay modelos frecuentes.</div>';
        return;
    }

    grid.innerHTML = items.map(m => `
        <div class="plade-quick-item" onclick="openPladeCustomItemModal('${m}')">
            <div class="plade-quick-item-badge">${m}</div>
            <div style="font-size:0.75rem; color:#64748b;">+ Añadir</div>
        </div>
    `).join('');
};

const filterPladeModels = () => {
    renderPladeQuickItems(document.getElementById('pladeSearch').value);
};

const openPladeCustomItemModal = (modelName = '') => {
    document.getElementById('pladeCustomItemForm').reset();
    document.getElementById('pcModel').value = modelName;

    const soleSelect = document.getElementById('pcSoleType');
    soleSelect.innerHTML = state.soleTypes.length === 0 ? '<option value="">-- Sin suelas --</option>' : state.soleTypes.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    calculatePladeModalPairs();
    openModal('pladeCustomItemModal');
};

const calculatePladeModalPairs = () => {
    let total = 0;
    for (let i = 35; i <= 43; i++) {
        total += parseInt(document.getElementById('pc_sz' + i)?.value) || 0;
    }
    document.getElementById('pcPairsDisplay').textContent = total;
    document.getElementById('pcPairs').value = total;
};

let pcPhotoData = null;
document.getElementById('pcPhoto')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => pcPhotoData = e.target.result;
        reader.readAsDataURL(file);
    } else {
        pcPhotoData = null;
    }
});

let pcPintarSuelaPhotoData = null;
document.getElementById('pcPintarSuelaPhoto')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => pcPintarSuelaPhotoData = e.target.result;
        reader.readAsDataURL(file);
    } else {
        pcPintarSuelaPhotoData = null;
    }
});

const handlePladeItemSubmit = (e) => {
    e.preventDefault();
    const pairs = parseInt(document.getElementById('pcPairs').value) || 0;
    if (pairs === 0) {
        notify('Debe ingresar al menos 1 par en las tallas.', 'error');
        return;
    }

    const colorInput = document.getElementById('pcColor').value || '';
    const colorArray = colorInput.split(',').map(c => c.trim()).filter(Boolean);
    if (colorArray.length === 0) {
        colorArray.push('');
    }

    let addedCount = 0;

    colorArray.forEach(colorVal => {
        const item = {
            model: document.getElementById('pcModel').value,
            pairs: pairs,
            sizeDistribution: {
                '35': parseInt(document.getElementById('pc_sz35').value) || 0,
                '36': parseInt(document.getElementById('pc_sz36').value) || 0,
                '37': parseInt(document.getElementById('pc_sz37').value) || 0,
                '38': parseInt(document.getElementById('pc_sz38').value) || 0,
                '39': parseInt(document.getElementById('pc_sz39').value) || 0,
                '40': parseInt(document.getElementById('pc_sz40').value) || 0,
                '41': parseInt(document.getElementById('pc_sz41').value) || 0,
                '42': parseInt(document.getElementById('pc_sz42').value) || 0,
                '43': parseInt(document.getElementById('pc_sz43').value) || 0
            },
            soleType: document.getElementById('pcSoleType').value,
            color: colorVal,
            photo: pcPhotoData,
            processes: {
                bordado: document.getElementById('pcBordado').checked,
                bordadoDetail: document.getElementById('pcBordadoDetail').value,
                estampado: document.getElementById('pcEstampado').checked,
                estampadoDetail: document.getElementById('pcEstampadoDetail').value,
                pintarSuela: document.getElementById('pcPintarSuela').checked,
                pintarSuelaDetail: document.getElementById('pcPintarSuelaDetail').value,
                pintarSuelaPhoto: pcPintarSuelaPhotoData
            }
        };

        mCart.push(item);
        addedCount++;
    });

    renderPladeCart();
    closeModal('pladeCustomItemModal');

    pcPhotoData = null;
    pcPintarSuelaPhotoData = null;

    if (addedCount > 1) {
        notify(`${addedCount} modelos añadidos al carrito`, 'success');
    } else {
        notify('Modelo añadido al carrito', 'success');
    }
};

const renderPladeCart = () => {
    const tbody = document.getElementById('pladeCartTable');
    let totalPairs = 0;

    tbody.innerHTML = mCart.map((item, idx) => {
        totalPairs += item.pairs;
        let sizeStr = Object.entries(item.sizeDistribution).filter(([k, v]) => v > 0).map(([k, v]) => `#${k}(${v})`).join(' ');
        let soleName = state.soleTypes.find(t => t.id === item.soleType)?.name || 'N/A';

        return `
            <tr>
                <td style="font-weight:700; color:var(--brand-600);">${item.model}</td>
                <td>
                    ${soleName} <br>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${item.color}</span>
                </td>
                <td style="font-size:0.8rem;">${sizeStr}</td>
                <td style="text-align:center; font-weight:800; font-size:1.1rem;">${item.pairs}</td>
                <td>
                    <button type="button" class="btn btn-ghost" style="color:var(--danger-500); padding:4px;" onclick="removePladeCartItem(${idx})">🗑</button>
                </td>
            </tr>
        `;
    }).join('');

    if (mCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">El carrito está vacío. Seleccione modelos a la izquierda.</td></tr>';
    }

    document.getElementById('pladeTotalModels').textContent = mCart.length;
    document.getElementById('pladeTotalPairs').textContent = totalPairs;
    document.getElementById('pladeSubmitBtn').disabled = mCart.length === 0;
};

const removePladeCartItem = (idx) => {
    mCart.splice(idx, 1);
    renderPladeCart();
};

const submitPladeBatch = () => {
    try {
        if (mCart.length === 0) {
            notify('El carrito está vacío', 'error');
            return;
        }

        const workerId = document.getElementById('pladeGlobalCortador')?.value || null;
        const priceInput = document.getElementById('pladeGlobalCosto');
        const price = priceInput ? parseFloat(priceInput.value) : state.pricePerPair;

        const phaseSelect = document.getElementById('pladeGlobalPhase');
        const phaseId = phaseSelect ? phaseSelect.value : 'cortador';

        const initialPhaseIdx = PHASES.findIndex(p => p.id === phaseId);
        const dateStart = document.getElementById('pladeDateStart')?.value || new Date().toISOString();
        const dateEnd = document.getElementById('pladeDateEnd')?.value || '';
        const globalNotes = document.getElementById('pladeGlobalNotes')?.value || '';

        let currentMaxNum = state.orders.length;
        const orderCount = mCart.length;

        mCart.forEach(item => {
            currentMaxNum++;
            const orderNum = `ORD-${currentMaxNum.toString().padStart(4, '0')}`;

            const order = {
                id: uid(),
                num: orderNum,
                model: item.model,
                pairs: item.pairs,
                date: dateEnd,
                notes: globalNotes,
                photo: item.photo,
                color: item.color,
                soleType: item.soleType,
                bagCode: null,
                sizeDistribution: item.sizeDistribution,
                processes: item.processes,
                status: 'en_proceso',
                createdAt: new Date().toISOString()
            };

            state.orders.push(order);

            PHASES.forEach((phase, idx) => {
                const isSkipped = idx < initialPhaseIdx;
                const isCurrent = idx === initialPhaseIdx;

                state.tasks.push({
                    id: uid(),
                    orderId: order.id,
                    orderNum: order.num,
                    model: order.model,
                    phaseId: phase.id,
                    phaseName: phase.name,
                    phaseIcon: phase.icon,
                    order: phase.order,
                    pairs: order.pairs,
                    status: isSkipped ? 'terminada' : 'bloqueada',
                    assignedTo: isCurrent ? workerId : null,
                    finishedAt: isSkipped ? new Date().toISOString() : null,
                    payment: isCurrent ? (price * order.pairs) : 0,
                    paid: isSkipped ? true : false
                });
            });
        });

        addEvent(`${orderCount} Órdenes creadas desde Carrito`, 'success');
        saveState();

        mCart = []; // clean
        renderPladeCart();

        navigate('orders');
        notify(`Se han generado ${orderCount} órdenes exitosamente.`);
    } catch (err) {
        console.error('Error in submitPladeBatch:', err);
        notify('Error al procesar el lote. Revisa la consola o contacta soporte.', 'error');
    }
};

window.filterPladeModels = filterPladeModels;
window.openPladeCustomItemModal = openPladeCustomItemModal;
window.calculatePladeModalPairs = calculatePladeModalPairs;
window.handlePladeItemSubmit = handlePladeItemSubmit;
window.removePladeCartItem = removePladeCartItem;
window.submitPladeBatch = submitPladeBatch;
window.initPladeNewOrder = initPladeNewOrder;
window.generateMasterCode = generateMasterCode;
// --- Feature: Data Backup (Export/Import) ---
window.exportBackup = () => {
    try {
        const backupData = {
            version: '2.0',
            date: new Date().toISOString(),
            state: state
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `fabricontrol_respaldo_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        notify('Respaldo descargado con éxito.', 'success');
        addEvent(`Respaldo de seguridad generado por ${state.currentUser.user}`, 'info');
    } catch (err) {
        notify('Error al generar el respaldo.', 'error');
        console.error(err);
    }
};

window.importBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('⚠️ ADVERTENCIA: Importar un respaldo sobrescribirá TODA la información actual (borrará las órdenes y usuarios actuales para reemplazarlos por los del archivo). ¿Estás completamente seguro de continuar?')) {
        event.target.value = ''; // Reset input
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const rawData = e.target.result;
            const parsedData = JSON.parse(rawData);

            if (parsedData.state) {
                // Ensure the basic structure exists to avoid breaking the app if it's an old backup
                state = {
                    ...state,
                    ...parsedData.state
                };
                saveState();

                alert('Respaldo importado correctamente. El sistema se recargará para aplicar los cambios.');
                window.location.reload();
            } else {
                notify('El archivo no tiene el formato válido de FabriControl.', 'error');
            }
        } catch (err) {
            notify('Error al leer el archivo. Asegúrate de que sea un respaldo válido (.json).', 'error');
            console.error(err);
        }
        event.target.value = ''; // Reset input
    };
    reader.readAsText(file);
};

// --- Splash Screen Logic ---
(function initSplash() {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;
    // Ensure login overlay is hidden during splash
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.display = 'none';

    setTimeout(() => {
        splash.classList.add('hidden');
        // After fade-out transition, show login if no session
        setTimeout(() => {
            splash.style.display = 'none';
            if (!state.currentUser) {
                if (loginOverlay) loginOverlay.style.display = 'flex';
            }
        }, 650);
    }, 1300);
})();
