// Historial de Citas: todas las citas (completadas, canceladas, etc.) con filtros,
// resumen, orden y paginado. Click en una fila → editar; click en la clienta → su ficha.
import { LightningElement, wire } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAppointmentHistory from '@salesforce/apex/SalonController.getAppointmentHistory';
import { STATUSES, errorMessage, formatCurrency, splitMultiPicklist, statusClass } from 'c/salonUtils';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

const PERIODS = [
    { value: 'month', label: 'Este mes' },
    { value: '3months', label: 'Últimos 3 meses' },
    { value: 'year', label: 'Este año' },
    { value: 'all', label: 'Todo' },
    { value: 'custom', label: 'Personalizado' }
];

function toIsoDate(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${mm}-${dd}`;
}

export default class SalonHistory extends NavigationMixin(LightningElement) {
    selectedStatuses = [];
    period = '3months';
    customFrom = '';
    customTo = '';
    searchTerm = '';
    committedSearch = '';
    newestFirst = true;
    pageNumber = 1;

    records = [];
    totalCount = 0;
    countByStatus = {};
    totalBilled = 0;
    isLoading = false;
    hasLoaded = false;

    requestSequence = 0;
    searchTimeoutId;
    initialized = false;

    // "Ver historial completo" desde la ficha de una clienta llega con ?c__cliente=<nombre>.
    @wire(CurrentPageReference)
    setPageReference(pageRef) {
        const client = pageRef?.state?.c__cliente;
        if (client && client !== this.committedSearch) {
            this.searchTerm = client;
            this.committedSearch = client;
            this.period = 'all';
            this.pageNumber = 1;
            if (this.initialized) {
                this.load();
            }
        }
    }

    connectedCallback() {
        this.initialized = true;
        this.load();
    }

    disconnectedCallback() {
        clearTimeout(this.searchTimeoutId);
    }

    // ── Carga ─────────────────────────────────────────────────────────────────

    get dateRange() {
        const today = new Date();
        switch (this.period) {
            case 'month':
                return { from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: toIsoDate(today) };
            case '3months':
                return { from: toIsoDate(new Date(today.getFullYear(), today.getMonth() - 2, 1)), to: toIsoDate(today) };
            case 'year':
                return { from: toIsoDate(new Date(today.getFullYear(), 0, 1)), to: toIsoDate(new Date(today.getFullYear(), 11, 31)) };
            case 'custom':
                return { from: this.customFrom || null, to: this.customTo || null };
            default:
                return { from: null, to: null };
        }
    }

    load() {
        const requestId = ++this.requestSequence;
        const isCurrent = () => requestId === this.requestSequence;
        const { from, to } = this.dateRange;
        this.isLoading = true;

        getAppointmentHistory({
            statuses: this.selectedStatuses,
            fromDate: from,
            toDate: to,
            clientSearch: this.committedSearch,
            newestFirst: this.newestFirst,
            pageNumber: this.pageNumber
        })
            .then(result => {
                if (!isCurrent()) {
                    return;
                }
                this.records = result.records;
                this.totalCount = result.totalCount;
                this.countByStatus = result.countByStatus || {};
                this.totalBilled = result.totalBilled || 0;
                this.hasLoaded = true;
            })
            .catch(error => {
                if (isCurrent()) {
                    this.dispatchEvent(new ShowToastEvent({
                        title: 'Error',
                        message: errorMessage(error, 'No se pudo cargar el historial.'),
                        variant: 'error'
                    }));
                }
            })
            .finally(() => {
                if (isCurrent()) {
                    this.isLoading = false;
                }
            });
    }

    reloadFromFirstPage() {
        this.pageNumber = 1;
        this.load();
    }

    // ── Presentación ─────────────────────────────────────────────────────────

    get statusChips() {
        return STATUSES.map(status => {
            const selected = this.selectedStatuses.includes(status);
            return {
                value: status,
                label: status,
                count: this.countByStatus[status] || 0,
                className: `chip ${statusClass(status).replace('status-pill ', '')}${selected ? ' chip--selected' : ''}`,
                ariaPressed: String(selected)
            };
        });
    }

    get periodOptions() {
        return PERIODS.map(p => ({
            ...p,
            className: `segment${this.period === p.value ? ' segment--active' : ''}`,
            ariaPressed: String(this.period === p.value)
        }));
    }

    get isCustomPeriod() {
        return this.period === 'custom';
    }

    get summary() {
        const count = status => this.countByStatus[status] || 0;
        return {
            total: this.totalCount,
            completed: count('Completada'),
            cancelled: count('Cancelada'),
            noShow: count('No Asistió'),
            billed: formatCurrency(this.totalBilled)
        };
    }

    get rows() {
        return this.records.map(appt => {
            const date = new Date(appt.Appointment_Date__c);
            return {
                id: appt.Id,
                clientId: appt.Client__c,
                clientName: appt.Client__r?.Full_Name__c,
                isVip: appt.Client__r?.VIP_Client__c,
                day: date.toLocaleDateString('es-AR', { day: '2-digit' }),
                month: date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
                year: date.getFullYear(),
                weekdayTime: `${date.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')} · ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
                services: splitMultiPicklist(appt.Services__c),
                status: appt.Status__c,
                statusClass: statusClass(appt.Status__c),
                amount: formatCurrency(appt.Total_Amount__c),
                paymentMethod: appt.Payment_Method__c
            };
        });
    }

    get hasRows() {
        return this.records.length > 0;
    }

    get showEmpty() {
        return this.hasLoaded && !this.isLoading && !this.hasRows;
    }

    get sortLabel() {
        return this.newestFirst ? 'Más recientes primero' : 'Más antiguas primero';
    }

    get totalPages() {
        return Math.max(1, Math.ceil(this.totalCount / PAGE_SIZE));
    }

    get showPagination() {
        return this.totalPages > 1;
    }

    get paginationLabel() {
        return `Página ${this.pageNumber} de ${this.totalPages}`;
    }

    get isFirstPage() {
        return this.pageNumber <= 1;
    }

    get isLastPage() {
        return this.pageNumber >= this.totalPages;
    }

    // ── Filtros ───────────────────────────────────────────────────────────────

    handleStatusToggle(event) {
        const status = event.currentTarget.dataset.status;
        this.selectedStatuses = this.selectedStatuses.includes(status)
            ? this.selectedStatuses.filter(s => s !== status)
            : [...this.selectedStatuses, status];
        this.reloadFromFirstPage();
    }

    handleClearStatuses() {
        this.selectedStatuses = [];
        this.reloadFromFirstPage();
    }

    handlePeriodChange(event) {
        this.period = event.currentTarget.dataset.period;
        if (this.period !== 'custom') {
            this.reloadFromFirstPage();
        }
    }

    handleCustomFromChange(event) {
        this.customFrom = event.target.value;
        this.reloadFromFirstPage();
    }

    handleCustomToChange(event) {
        this.customTo = event.target.value;
        this.reloadFromFirstPage();
    }

    handleSearchInput(event) {
        this.searchTerm = event.target.value;
        clearTimeout(this.searchTimeoutId);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.searchTimeoutId = setTimeout(() => {
            this.committedSearch = this.searchTerm.trim();
            this.reloadFromFirstPage();
        }, SEARCH_DEBOUNCE_MS);
    }

    handleSortToggle() {
        this.newestFirst = !this.newestFirst;
        this.reloadFromFirstPage();
    }

    handlePreviousPage() {
        if (!this.isFirstPage) {
            this.pageNumber -= 1;
            this.load();
        }
    }

    handleNextPage() {
        if (!this.isLastPage) {
            this.pageNumber += 1;
            this.load();
        }
    }

    // ── Acciones de fila ─────────────────────────────────────────────────────

    handleRowClick(event) {
        this.refs.editModal.open(event.currentTarget.dataset.id);
    }

    handleRowKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleRowClick(event);
        }
    }

    handleClientClick(event) {
        event.stopPropagation();
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId: event.currentTarget.dataset.clientId, objectApiName: 'Salon_Client__c', actionName: 'view' }
        });
    }

    handleSaved() {
        this.load();
    }
}
