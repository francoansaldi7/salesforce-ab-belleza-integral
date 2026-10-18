// Calendario de citas: un mes con los días con citas en rojo. Al tocar un día se abre la lista
// de citas de ese día; al tocar una cita se abre la ventana de edición de siempre (editar o eliminar).
import { LightningElement, api } from 'lwc';
import getAppointmentDaysInMonth from '@salesforce/apex/SalonController.getAppointmentDaysInMonth';
import getAppointmentsForDay from '@salesforce/apex/SalonController.getAppointmentsForDay';
import { MONTH_NAMES, errorMessage, formatCurrency, formatTime, splitMultiPicklist, statusClass } from 'c/salonUtils';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function isoDate(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default class SalonCalendar extends LightningElement {
    isOpen = false;
    year;
    month; // 1-12
    countByDay = {};
    isLoadingMonth = false;
    monthError = '';

    selectedDay = null; // número de día dentro del mes mostrado
    dayAppointments = [];
    isLoadingDay = false;
    dayError = '';

    weekdays = WEEKDAYS;
    monthRequest = 0;
    dayRequest = 0;

    /** Abre el calendario en el mes actual. */
    @api
    open() {
        const today = new Date();
        this.year = today.getFullYear();
        this.month = today.getMonth() + 1;
        this.selectedDay = null;
        this.isOpen = true;
        this.loadMonth();
    }

    // ── Carga ─────────────────────────────────────────────────────────────────

    loadMonth() {
        const requestId = ++this.monthRequest;
        this.isLoadingMonth = true;
        this.monthError = '';
        getAppointmentDaysInMonth({ year: this.year, month: this.month })
            .then(result => {
                if (requestId === this.monthRequest) {
                    this.countByDay = result || {};
                }
            })
            .catch(error => {
                if (requestId === this.monthRequest) {
                    this.countByDay = {};
                    this.monthError = errorMessage(error, 'No se pudo cargar el calendario.');
                }
            })
            .finally(() => {
                if (requestId === this.monthRequest) {
                    this.isLoadingMonth = false;
                }
            });
    }

    loadDay() {
        const requestId = ++this.dayRequest;
        this.isLoadingDay = true;
        this.dayError = '';
        getAppointmentsForDay({ day: isoDate(this.year, this.month, this.selectedDay) })
            .then(result => {
                if (requestId === this.dayRequest) {
                    this.dayAppointments = result || [];
                }
            })
            .catch(error => {
                if (requestId === this.dayRequest) {
                    this.dayAppointments = [];
                    this.dayError = errorMessage(error, 'No se pudieron cargar las citas del día.');
                }
            })
            .finally(() => {
                if (requestId === this.dayRequest) {
                    this.isLoadingDay = false;
                }
            });
    }

    // ── Calendario ────────────────────────────────────────────────────────────

    get monthLabel() {
        return `${MONTH_NAMES[this.month - 1]} ${this.year}`;
    }

    get isCurrentMonth() {
        const today = new Date();
        return this.year === today.getFullYear() && this.month === today.getMonth() + 1;
    }

    get showBackToToday() {
        return !this.isCurrentMonth;
    }

    /** Semanas de lunes a domingo; los huecos antes del 1 y después del último día van vacíos. */
    get weeks() {
        const today = new Date();
        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        const leadingBlanks = (new Date(this.year, this.month - 1, 1).getDay() + 6) % 7;
        const cells = [];
        for (let i = 0; i < leadingBlanks; i++) {
            cells.push({ key: `blank-start-${i}` });
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const count = this.countByDay[String(day)] || 0;
            const isToday = this.isCurrentMonth && day === today.getDate();
            const classes = ['day'];
            if (count) classes.push('day--busy');
            if (isToday) classes.push('day--today');
            if (day === this.selectedDay) classes.push('day--selected');
            cells.push({
                key: `day-${day}`,
                day,
                className: classes.join(' '),
                ariaLabel: `${day} de ${MONTH_NAMES[this.month - 1].toLowerCase()}: `
                    + (count ? `${count} ${count === 1 ? 'cita' : 'citas'}` : 'sin citas'),
                title: count ? `${count} ${count === 1 ? 'cita' : 'citas'}` : ''
            });
        }
        while (cells.length % 7) {
            cells.push({ key: `blank-end-${cells.length}` });
        }
        const weeks = [];
        for (let i = 0; i < cells.length; i += 7) {
            weeks.push({ key: `week-${i / 7}`, days: cells.slice(i, i + 7) });
        }
        return weeks;
    }

    get busyDaysCount() {
        return Object.keys(this.countByDay).length;
    }

    get monthSummary() {
        const n = this.busyDaysCount;
        if (n === 0) {
            return 'Sin citas este mes';
        }
        return n === 1 ? '1 día con citas' : `${n} días con citas`;
    }

    handlePreviousMonth() {
        this.moveMonth(-1);
    }

    handleNextMonth() {
        this.moveMonth(1);
    }

    handleThisMonth() {
        const today = new Date();
        this.year = today.getFullYear();
        this.month = today.getMonth() + 1;
        this.loadMonth();
    }

    moveMonth(delta) {
        const target = new Date(this.year, this.month - 1 + delta, 1);
        this.year = target.getFullYear();
        this.month = target.getMonth() + 1;
        this.loadMonth();
    }

    // ── Día seleccionado ──────────────────────────────────────────────────────

    get hasSelectedDay() {
        return this.selectedDay !== null;
    }

    get calendarOverlayClass() {
        // En pantallas chicas la lista del día reemplaza al calendario (ver CSS).
        return `ab-modal-overlay calendar-overlay${this.hasSelectedDay ? ' calendar-overlay--behind' : ''}`;
    }

    get dayTitle() {
        const date = new Date(this.year, this.month - 1, this.selectedDay);
        const label = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        return label.charAt(0).toUpperCase() + label.slice(1);
    }

    get dayRows() {
        return this.dayAppointments.map(appt => ({
            id: appt.Id,
            time: formatTime(appt.Appointment_Date__c),
            clientName: appt.Client__r?.Full_Name__c,
            isVip: appt.Client__r?.VIP_Client__c,
            allergy: appt.Client__r?.Allergies_Notes__c,
            services: splitMultiPicklist(appt.Services__c),
            status: appt.Status__c,
            statusClass: statusClass(appt.Status__c),
            amount: formatCurrency(appt.Status__c === 'Completada' ? appt.Amount_Paid__c : appt.Total_Amount__c),
            rowClass: `day-row${appt.Status__c === 'Cancelada' ? ' day-row--cancelled' : ''}`
        }));
    }

    get hasDayRows() {
        return this.dayAppointments.length > 0;
    }

    get showDayEmpty() {
        return !this.isLoadingDay && !this.dayError && !this.hasDayRows;
    }

    handleDayClick(event) {
        this.selectedDay = Number(event.currentTarget.dataset.day);
        this.dayAppointments = [];
        this.loadDay();
    }

    handleBackToCalendar() {
        this.selectedDay = null;
    }

    handleAppointmentClick(event) {
        const row = this.dayRows.find(r => r.id === event.currentTarget.dataset.id);
        this.refs.editModal.open(row.id, `${row.clientName} · ${this.dayTitle.toLowerCase()} · ${row.time}`);
    }

    handleAppointmentKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleAppointmentClick(event);
        }
    }

    // Después de editar o eliminar: se actualizan la lista del día, el mes y el panel de control.
    handleAppointmentChanged() {
        this.loadDay();
        this.loadMonth();
        this.dispatchEvent(new CustomEvent('appointmentchange'));
    }

    // ── Cerrar ────────────────────────────────────────────────────────────────

    handleClose() {
        this.isOpen = false;
        this.selectedDay = null;
    }

    handleCalendarKeyDown(event) {
        if (event.key === 'Escape' && !this.hasSelectedDay) {
            this.handleClose();
        }
    }

    handleDayKeyDown(event) {
        if (event.key === 'Escape') {
            event.stopPropagation();
            this.handleBackToCalendar();
        }
    }
}
