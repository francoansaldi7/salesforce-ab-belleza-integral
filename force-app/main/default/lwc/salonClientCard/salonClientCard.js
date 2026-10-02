// Shows a rich profile card for a Salon_Client__c record page.
// Loads client details and their last 5 appointments sequentially to avoid
// rendering appointment history before the client data is available.
import { LightningElement, api, track } from 'lwc';
import getClientCard from '@salesforce/apex/SalonController.getClientCard';
import getClientRecentAppointments from '@salesforce/apex/SalonController.getClientRecentAppointments';

// Maps each appointment status to a CSS class for the colour-coded history list.
const STATUS_CLASSES = {
    'Programada'  : 'hist-status hist-scheduled',
    'Confirmada'  : 'hist-status hist-confirmed',
    'En Progreso' : 'hist-status hist-inprogress',
    'Completada'  : 'hist-status hist-completed',
    'No Asistió'  : 'hist-status hist-noshow',
    'Cancelada'   : 'hist-status hist-cancelled'
};

export default class SalonClientCard extends LightningElement {

    // @api receives the current record Id from the Lightning record page context.
    @api recordId;

    @track client              = null; // full client data object from Apex
    @track recentAppointments  = [];   // last 5 appointments, enriched with display properties
    @track isLoading           = true;
    @track isLoadingAppointments = true;

    // ── Ciclo de vida ────────────────────────────────────────────────────────

    connectedCallback() {
        this.loadClient();
    }

    // ── Carga de datos ───────────────────────────────────────────────────────

    // Loads the client record first, then triggers the appointment load.
    // Sequential (not parallel) so appointments only load after we confirm the client exists.
    loadClient() {
        this.isLoading = true;
        getClientCard({ clientId: this.recordId })
            .then(data => {
                this.client    = data;
                this.isLoading = false;
                this.loadAppointments(); // chain the second call once client data is ready
            })
            .catch(() => {
                this.isLoading = false; // show the "could not load" fallback template
            });
    }

    // Fetches the last 5 appointments and enriches each with formatted date, amount, and status CSS.
    loadAppointments() {
        this.isLoadingAppointments = true;
        getClientRecentAppointments({ clientId: this.recordId })
            .then(data => {
                this.recentAppointments = data.map(appt => ({
                    ...appt,
                    formattedDate:   this.formatDate(appt.Appointment_Date__c),
                    formattedAmount: this.formatCurrency(appt.Total_Amount__c),
                    statusClass:     STATUS_CLASSES[appt.Status__c] || 'hist-status' // fallback if unknown status
                }));
                this.isLoadingAppointments = false;
            })
            .catch(() => {
                this.isLoadingAppointments = false;
            });
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    // Extracts up to two initials from the full name for the avatar circle (e.g. "María García" → "MG").
    get clientInitials() {
        if (!this.client?.Full_Name__c) return '?';
        return this.client.Full_Name__c
            .split(' ')
            .slice(0, 2)
            .map(w => w[0].toUpperCase())
            .join('');
    }

    // Returns the birthday in "DD de MMMM" format (omitting the year for privacy).
    get formattedBirthday() {
        if (!this.client?.Birthday__c) return '';
        return this._dateOnlyToLocal(this.client.Birthday__c).toLocaleDateString('es-AR', {
            day: 'numeric', month: 'long'
        });
    }

    get formattedTotalSpent() {
        return this.formatCurrency(this.client?.Total_Spent__c);
    }

    // Formats the last visit date or shows a friendly "never visited" message.
    get formattedLastVisit() {
        if (!this.client?.Last_Visit_Date__c) return 'Sin visitas';
        return this._dateOnlyToLocal(this.client.Last_Visit_Date__c).toLocaleDateString('es-AR', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    // Controls whether the "Preferred Services" section renders at all.
    get hasPreferredServices() {
        return !!this.client?.Preferred_Services__c;
    }

    // Preferred_Services__c is a semicolon-separated string; split it into an array for tag display.
    get preferredServicesList() {
        if (!this.client?.Preferred_Services__c) return [];
        return this.client.Preferred_Services__c.split(';').map(s => s.trim());
    }

    get hasRecentAppointments() {
        return this.recentAppointments.length > 0;
    }

    // ── Utilidades ────────────────────────────────────────────────────────────

    // Parses a Salesforce date-only field ("YYYY-MM-DD") into a LOCAL Date at midnight.
    // Using the (year, month, day) constructor avoids the UTC parse that `new Date(str)`
    // performs, which would render as the previous day in negative-offset timezones
    // (e.g. Argentina, UTC-3). Used for date-only fields like Birthday__c / Last_Visit_Date__c.
    _dateOnlyToLocal(dateOnlyString) {
        const [y, m, d] = dateOnlyString.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    // Formats a datetime string as "DD MMM YYYY" for the appointment history list.
    formatDate(dateTimeString) {
        if (!dateTimeString) return '';
        return new Date(dateTimeString).toLocaleDateString('es-AR', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    // Formats a number as Argentine pesos using the browser's Intl API.
    formatCurrency(amount) {
        if (amount == null) return '$0,00';
        return new Intl.NumberFormat('es-AR', {
            style: 'currency', currency: 'ARS'
        }).format(amount);
    }
}