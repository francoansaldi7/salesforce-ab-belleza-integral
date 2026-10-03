// Main dashboard for the AB Belleza Integral salon app.
// Displays today's appointments, KPI tiles, and quick-action flows.
import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { formatCurrency, initials, splitMultiPicklist, statusClass } from 'c/salonUtils';
// Apex methods for loading salon data
import getTodayAppointments from '@salesforce/apex/SalonController.getTodayAppointments';
import getPendingAppointments from '@salesforce/apex/SalonController.getPendingAppointments';
import getMonthlyBalance from '@salesforce/apex/SalonController.getMonthlyBalance';
import getOpenAppointmentsCount from '@salesforce/apex/SalonController.getOpenAppointmentsCount';
import getLowStockCount from '@salesforce/apex/SalonController.getLowStockCount';
import getDormantClientsCount from '@salesforce/apex/SalonController.getDormantClientsCount';
import getLowStockProducts from '@salesforce/apex/SalonController.getLowStockProducts';
import getDormantClients from '@salesforce/apex/SalonController.getDormantClients';
import updateAppointmentStatus from '@salesforce/apex/SalonController.updateAppointmentStatus';
import getMonthlyBalanceDetail from '@salesforce/apex/SalonController.getMonthlyBalanceDetail';

export default class SalonHome extends NavigationMixin(LightningElement) {

    // ── Estado ──────────────────────────────────────────────────────────────

    @track todayAppointments     = [];      // appointments scheduled for today
    @track pendingAppointments   = [];      // all open appointments (Programada/Confirmada/En Progreso)
    @track appointmentView       = 'today'; // controls which list is visible: 'today' | 'pending'
    @track monthlyBalance        = 0;       // current month income minus expenses
    @track openAppointmentsCount = 0;       // shown in the KPI tile
    @track lowStockCount         = 0;       // number of products below their alert threshold
    @track dormantClientsCount   = 0;       // clients with no visit in the last 60 days
    @track isLoadingAppointments = true;
    @track isLoadingKpis         = true;
    @track showFlow              = false;   // toggles the embedded screen-flow overlay
    @track activeFlowName        = '';      // API name of the flow to launch
    @track activeFlowLabel       = '';      // title shown in the flow overlay header

    // Modal historial de balance
    showBalanceModal   = false;
    selectedYear       = new Date().getFullYear();
    selectedMonth      = new Date().getMonth() + 1; // 1-based
    @track balanceDetail = null;  // MonthlyBalanceDetail from Apex — @track needed for nested object mutation
    isLoadingBalance   = false;

    // Modales detalle — shown when the user clicks a KPI tile
    @track showLowStockModal  = false;
    @track showDormantModal   = false;
    @track lowStockProducts   = [];  // data for the Low Stock detail modal
    @track dormantClients     = [];  // data for the Dormant Clients detail modal
    @track isLoadingLowStock  = false;
    @track isLoadingDormant   = false;

    // ── Ciclo de vida ────────────────────────────────────────────────────────

    _pollInterval = null; // reference stored so it can be cancelled on destroy

    connectedCallback() {
        this.loadData();
        // Refresh KPIs silently every 60 s to pick up changes made elsewhere
        this._pollInterval = setInterval(() => this._pollKpis(), 60000);
    }

    // Always clear the interval to avoid memory leaks when the component is removed.
    disconnectedCallback() {
        clearInterval(this._pollInterval);
    }

    // ── Carga de datos ───────────────────────────────────────────────────────

    // Fetches appointments and KPIs in two independent Promise.all batches so
    // appointments and KPI spinners resolve independently.
    loadData() {
        this.isLoadingAppointments = true;
        this.isLoadingKpis = true;

        // Load today's and pending appointments at the same time
        Promise.all([
            getTodayAppointments(),
            getPendingAppointments()
        ])
        .then(([todayData, pendingData]) => {
            // _mapAppt enriches each record with display-ready properties (time, formatted amount, CSS class)
            this.todayAppointments   = todayData.map(a => this._mapAppt(a, false));
            this.pendingAppointments = pendingData.map(a => this._mapAppt(a, true));
            this.isLoadingAppointments = false;
        })
        .catch(error => {
            this.isLoadingAppointments = false;
            this.showError('No se pudieron cargar las citas: ' + (error.body?.message || error.message));
        });

        // Load all four KPIs in parallel
        Promise.all([
            getMonthlyBalance(),
            getOpenAppointmentsCount(),
            getLowStockCount(),
            getDormantClientsCount()
        ])
        .then(([balance, openAppts, lowStock, dormant]) => {
            this.monthlyBalance        = balance   || 0; // || 0 guards against null from Apex
            this.openAppointmentsCount = openAppts || 0;
            this.lowStockCount         = lowStock  || 0;
            this.dormantClientsCount   = dormant   || 0;
            this.isLoadingKpis         = false;
        })
        .catch(error => {
            this.isLoadingKpis = false;
            this.showError('No se pudieron cargar los indicadores: ' + (error.body?.message || error.message));
        });
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    // Returns today's date formatted as a long string for the dashboard subtitle.
    get today() {
        return new Date().toLocaleDateString('es-AR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // Returns whichever appointment list the view toggle currently points to.
    get activeAppointments() {
        return this.appointmentView === 'today'
            ? this.todayAppointments
            : this.pendingAppointments;
    }

    get hasAppointments() {
        return this.activeAppointments.length > 0;
    }

    // Displayed as a badge count next to the panel title.
    get appointmentCount() {
        return this.activeAppointments.length;
    }

    get emptyMessage() {
        return this.appointmentView === 'today'
            ? 'No hay citas programadas para hoy.'
            : 'No hay citas próximas.';
    }

    // Changes the panel heading when the user switches between Today and Upcoming views.
    get panelTitle() {
        return this.appointmentView === 'today' ? 'Citas de Hoy' : 'Citas Pendientes';
    }

    // Adds the '--active' modifier to the currently selected view button.
    get todayBtnClass() {
        return 'view-btn' + (this.appointmentView === 'today' ? ' view-btn--active' : '');
    }

    get pendingBtnClass() {
        return 'view-btn' + (this.appointmentView === 'pending' ? ' view-btn--active' : '');
    }

    get monthlyBalanceFormatted() {
        return this.formatCurrency(this.monthlyBalance);
    }

    get monthlyBalanceNegative() {
        return this.monthlyBalance < 0;
    }

    // Applies a red CSS class when the balance is negative.
    get monthlyBalanceClass() {
        return this.monthlyBalance < 0 ? 'balance-negative' : '';
    }

    // ── Balance Modal getters ────────────────────────────────────────────────

    get monthOptions() {
        const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        return names.map((label, i) => ({ label, value: String(i + 1) }));
    }

    get yearOptions() {
        const current = new Date().getFullYear();
        return [current, current - 1, current - 2].map(y => ({ label: String(y), value: String(y) }));
    }

    get selectedMonthValue()  { return String(this.selectedMonth); }
    get selectedYearValue()   { return String(this.selectedYear);  }

    get balanceMonthLabel() {
        const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        return `${names[this.selectedMonth - 1]} ${this.selectedYear}`;
    }

    get balanceIncome()   { return this.formatCurrency(this.balanceDetail ? this.balanceDetail.income : 0); }
    get balanceExpenses() { return this.formatCurrency(this.balanceDetail ? this.balanceDetail.expenses : 0); }
    get balanceNet()      { return this.formatCurrency(this.balanceDetail ? this.balanceDetail.balance : 0); }
    get balanceNetClass() { return this.balanceDetail && this.balanceDetail.balance < 0 ? 'balance-card__value balance-card__value--negative' : 'balance-card__value'; }

    get balanceTransactions() { return this.balanceDetail ? this.balanceDetail.transactions : []; }
    get hasBalanceTransactions() { return this.balanceTransactions.length > 0; }

    // Used by the modal template to decide whether to show the list or the empty state.
    get hasLowStockProducts() {
        return this.lowStockProducts.length > 0;
    }

    get hasDormantClients() {
        return this.dormantClients.length > 0;
    }

    // ── Navegación a cita ─────────────────────────────────────────────────────

    handleAppointmentClick(event) {
        // Ignore clicks that originate from the status-change dropdown
        if (event.target.closest('lightning-button-menu')) return;
        const id = event.currentTarget.dataset.id;
        this.refs.editModal.open(id, this._appointmentLabel(id));
    }

    handleAppointmentDeleted() {
        this.loadData();
    }

    // "Ana Pérez · mié 14/10 · 15:00": identifies the appointment in the delete confirmation.
    _appointmentLabel(id) {
        const appt = [...this.todayAppointments, ...this.pendingAppointments].find(a => a.Id === id);
        if (!appt) return '';
        return `${appt.Client__r?.Full_Name__c || ''} · ${this._formatDateLabel(appt.Appointment_Date__c)}`;
    }

    handleOpenHistory() {
        this[NavigationMixin.Navigate]({
            type: 'standard__navItemPage',
            attributes: { apiName: 'Historial_de_Citas' }
        });
    }

    handleEditSuccess(event) {
        const saved  = event.detail.fields;
        const id     = event.detail.id;

        // Update the appointment in-place using the fields returned by the UI API
        // so the dashboard reflects changes immediately without waiting for an Apex round-trip.
        const patch = {
            Status__c:           saved.Status__c?.value,
            Total_Amount__c:     saved.Total_Amount__c?.value,
            Amount_Paid__c:      saved.Amount_Paid__c?.value,
            Appointment_Date__c: saved.Appointment_Date__c?.value,
            Services__c:         saved.Services__c?.value,
            Payment_Method__c:   saved.Payment_Method__c?.value,
        };

        const applyPatch = (list, showDate) =>
            list.map(a => a.Id === id ? this._mapAppt({ ...a, ...patch }, showDate) : a);

        this.todayAppointments   = applyPatch(this.todayAppointments,   false);
        this.pendingAppointments = applyPatch(this.pendingAppointments, true);

        // The edit modal already confirmed the save with a toast.
        this._silentRefreshAppointments(); // refresh without triggering the loading spinner
    }

    // ── Toggle de vista ───────────────────────────────────────────────────────

    // Switches the appointment panel between "Today" and "Upcoming" using data-view on the button.
    handleViewToggle(event) {
        this.appointmentView = event.currentTarget.dataset.view;
    }

    // ── Modales de detalle KPI ────────────────────────────────────────────────

    // Opens the Low Stock detail modal and loads the product list on demand (lazy load).
    handleLowStockClick() {
        this.showLowStockModal = true;
        this.isLoadingLowStock = true;
        this.lowStockProducts  = [];
        getLowStockProducts()
            .then(data => {
                this.lowStockProducts  = data;
                this.isLoadingLowStock = false;
            })
            .catch(() => { this.isLoadingLowStock = false; });
    }

    closeLowStockModal() {
        this.showLowStockModal = false;
    }

    // Opens the Dormant Clients modal and enriches each client record with a formatted last-visit date.
    handleDormantClick() {
        this.showDormantModal = true;
        this.isLoadingDormant = true;
        this.dormantClients   = [];
        getDormantClients()
            .then(data => {
                this.dormantClients = data.map(c => ({
                    ...c,
                    // Last_Visit_Date__c is a date-only field; format it without a
                    // timezone shift (see _fmtDateOnly).
                    lastVisitFormatted: c.Last_Visit_Date__c
                        ? this._fmtDateOnly(c.Last_Visit_Date__c)
                        : 'Sin visitas registradas'
                }));
                this.isLoadingDormant = false;
            })
            .catch(() => { this.isLoadingDormant = false; });
    }

    closeDormantModal() {
        this.showDormantModal = false;
    }

    // ── Modal de Balance Histórico ────────────────────────────────────────────

    handleBalanceTileClick() {
        this.showBalanceModal = true;
        this._loadBalanceDetail();
    }

    closeBalanceModal() {
        this.showBalanceModal = false;
    }

    handleBalanceMonthChange(event) {
        this.selectedMonth = parseInt(event.detail.value, 10);
        this._loadBalanceDetail();
    }

    handleBalanceYearChange(event) {
        this.selectedYear = parseInt(event.detail.value, 10);
        this._loadBalanceDetail();
    }

    // Token incremented on each call; only the response matching the latest token is applied.
    // This prevents a slow earlier request from overwriting a faster later one.
    _balanceRequestToken = 0;

    _loadBalanceDetail() {
        const token = ++this._balanceRequestToken;
        this.isLoadingBalance = true;
        this.balanceDetail    = null;
        getMonthlyBalanceDetail({ year: this.selectedYear, month: this.selectedMonth })
            .then(data => {
                if (token !== this._balanceRequestToken) return; // stale response — discard
                // Enrich each transaction with a formatted date for display
                this.balanceDetail = {
                    ...data,
                    transactions: (data.transactions || []).map(t => ({
                        ...t,
                        // Transaction_Date__c is a date-only field; format it without a
                        // timezone shift (see _fmtDateOnly).
                        formattedDate: this._fmtDateOnly(t.Transaction_Date__c),
                        formattedAmount: this.formatCurrency(t.Amount__c),
                        isIngreso: t.Transaction_Type__c === 'Ingreso'
                    }))
                };
                this.isLoadingBalance = false;
            })
            .catch(error => {
                if (token !== this._balanceRequestToken) return;
                this.isLoadingBalance = false;
                this.showError('No se pudo cargar el balance: ' + (error.body?.message || error.message));
            });
    }

    // ── Acciones rápidas: abrir flujos ────────────────────────────────────────

    // Each method sets activeFlowName (the Salesforce Flow API name) and shows the overlay.
    openNewAppointmentFlow() {
        this.activeFlowName  = 'Flujo_Nueva_Cita';
        this.activeFlowLabel = 'Nueva Cita';
        this.showFlow        = true;
    }

    openExpenseFlow() {
        this.activeFlowName  = 'Flujo_Registrar_Gasto';
        this.activeFlowLabel = 'Registrar Gasto';
        this.showFlow        = true;
    }

    openProductSaleFlow() {
        this.activeFlowName  = 'Flujo_Venta_Producto';
        this.activeFlowLabel = 'Vender Producto';
        this.showFlow        = true;
    }

    // Closes the flow overlay (e.g., user clicked the X button before finishing).
    closeFlow() {
        this.showFlow = false;
        this.activeFlowName = '';
    }

    // lightning-flow fires statuschange when the flow finishes. FINISHED_SCREEN means
    // the last screen was displayed; FINISHED means it ended without a screen.
    handleFlowStatusChange(event) {
        const status = event.detail.status;
        if (status === 'FINISHED' || status === 'FINISHED_SCREEN') {
            this.showFlow = false;
            this.showToast('Listo', 'Operación completada con éxito.', 'success');
            this.loadData(); // refresh all panels so newly created records appear immediately
        }
    }

    // ── Cambiar estado de cita ────────────────────────────────────────────────

    // Called when the user picks a status from the dropdown menu on an appointment row.
    handleStatusChange(event) {
        const newStatus     = event.detail.value;
        const appointmentId = event.currentTarget.dataset.id;

        if (newStatus === 'Eliminar') {
            this.refs.editModal.confirmDelete(appointmentId, this._appointmentLabel(appointmentId));
            return;
        }

        updateAppointmentStatus({ appointmentId, newStatus })
            .then(() => {
                this.showToast('Estado actualizado', `La cita fue marcada como "${newStatus}".`, 'success');
                this.loadData();
            })
            .catch(error => {
                // Error shape differs depending on whether it's an AuraHandledException or a DML error.
                const msg = error?.body?.message
                    || (Array.isArray(error?.body) ? error.body[0]?.message : null)
                    || error?.message
                    || 'Error desconocido';
                this.showError('No se pudo actualizar el estado: ' + msg);
            });
    }

    // ── Utilidades privadas ───────────────────────────────────────────────────

    // Refreshes the appointment lists in the background without showing the loading spinner.
    // Used after an inline edit so the in-place update is visible immediately.
    _silentRefreshAppointments() {
        Promise.all([getTodayAppointments(), getPendingAppointments()])
            .then(([todayData, pendingData]) => {
                this.todayAppointments   = todayData.map(a => this._mapAppt(a, false));
                this.pendingAppointments = pendingData.map(a => this._mapAppt(a, true));
            })
            .catch(() => {}); // silent — in-place update already shows the change
    }

    // Silent background KPI refresh — errors are swallowed to avoid interrupting the user.
    _pollKpis() {
        Promise.all([
            getMonthlyBalance(),
            getOpenAppointmentsCount(),
            getLowStockCount(),
            getDormantClientsCount()
        ])
        .then(([balance, openAppts, lowStock, dormant]) => {
            this.monthlyBalance        = balance   || 0;
            this.openAppointmentsCount = openAppts || 0;
            this.lowStockCount         = lowStock  || 0;
            this.dormantClientsCount   = dormant   || 0;
        })
        .catch(() => {}); // intentionally silent
    }

    // Enriches a raw Apex appointment record with display-ready properties.
    // showDate=true is used for pending appointments; false shows only the time for today's list.
    _mapAppt(appt, showDate) {
        return {
            ...appt,
            displayLabel:    showDate ? this._formatDateLabel(appt.Appointment_Date__c)
                                      : this._formatTime(appt.Appointment_Date__c),
            formattedAmount: this.formatCurrency(appt.Amount_Paid__c),
            initials:        initials(appt.Client__r?.Full_Name__c),
            services:        splitMultiPicklist(appt.Services__c),
            statusClass:     statusClass(appt.Status__c)
        };
    }

    // Formats a Salesforce date-only field ("YYYY-MM-DD") as "DD/MM/YYYY".
    // We intentionally do NOT use `new Date(str)` here: that parses a date-only
    // string as UTC midnight, which renders as the previous day in negative-offset
    // timezones (e.g. Argentina, UTC-3) — the July 1 → June 30 bug. Splitting the
    // string keeps the date exactly as stored, with no timezone conversion.
    _fmtDateOnly(dateOnlyString) {
        if (!dateOnlyString) return '';
        const [y, m, d] = dateOnlyString.split('-');
        return `${d}/${m}/${y}`;
    }

    // Returns only the HH:MM time portion of a datetime string.
    _formatTime(dateTimeString) {
        if (!dateTimeString) return '';
        return new Date(dateTimeString).toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit'
        });
    }

    // Returns "Hoy · HH:MM" for today's appointments, or "DDD DD/MM · HH:MM" for others.
    _formatDateLabel(dateTimeString) {
        if (!dateTimeString) return '';
        const d = new Date(dateTimeString);
        const isToday = d.toDateString() === new Date().toDateString();
        const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        if (isToday) return 'Hoy · ' + time;
        return d.toLocaleDateString('es-AR', {
            weekday: 'short', day: '2-digit', month: '2-digit'
        }) + ' · ' + time;
    }

    // Formats a number as Argentine pesos using the browser's Intl API.
    formatCurrency(amount) {
        return formatCurrency(amount);
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    // Convenience wrapper that always fires an error-variant toast.
    showError(message) {
        this.showToast('Error', message, 'error');
    }
}