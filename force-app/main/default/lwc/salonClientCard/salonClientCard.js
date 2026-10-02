// Ficha de la clienta en su página de registro: contacto con un toque, ficha de salud,
// estadísticas, servicios preferidos y últimas citas.
import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { getRecord } from 'lightning/uiRecordApi';
import LAST_MODIFIED_FIELD from '@salesforce/schema/Salon_Client__c.LastModifiedDate';
import getClientCard from '@salesforce/apex/SalonController.getClientCard';
import getClientRecentAppointments from '@salesforce/apex/SalonController.getClientRecentAppointments';
import {
    formatCurrency,
    formatShortDate,
    initials,
    instagramProfile,
    phoneUrl,
    splitMultiPicklist,
    statusClass,
    whatsappUrl
} from 'c/salonUtils';

const NO_CONDITIONS = 'Ninguna de las anteriores';
const BIRTHDAY_SOON_DAYS = 7;

export default class SalonClientCard extends NavigationMixin(LightningElement) {
    @api recordId;

    client = null;
    recentAppointments = [];
    isLoading = true;
    hasError = false;
    isLoadingAppointments = true;

    // Re-loads the card whenever the record is saved (e.g. edited in the details panel).
    @wire(getRecord, { recordId: '$recordId', fields: [LAST_MODIFIED_FIELD] })
    wiredRecord({ data }) {
        if (data) {
            this.loadClient();
        }
    }

    loadClient() {
        getClientCard({ clientId: this.recordId })
            .then(data => {
                this.client = data;
                this.hasError = false;
                this.loadAppointments();
            })
            .catch(() => {
                this.hasError = true;
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    loadAppointments() {
        this.isLoadingAppointments = true;
        getClientRecentAppointments({ clientId: this.recordId })
            .then(data => {
                this.recentAppointments = data.map(appt => ({
                    ...appt,
                    formattedDate: formatShortDate(appt.Appointment_Date__c),
                    formattedAmount: formatCurrency(appt.Total_Amount__c),
                    services: splitMultiPicklist(appt.Services__c),
                    statusClass: statusClass(appt.Status__c)
                }));
            })
            .catch(() => {
                this.recentAppointments = [];
            })
            .finally(() => {
                this.isLoadingAppointments = false;
            });
    }

    // ── Cabecera ──────────────────────────────────────────────────────────────

    get showCard() {
        return !this.isLoading && !this.hasError && this.client;
    }

    get clientInitials() {
        return initials(this.client?.Full_Name__c);
    }

    get birthday() {
        const value = this.client?.Birthday__c;
        if (!value) {
            return null;
        }
        const [, month, day] = value.split('-').map(Number);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let next = new Date(today.getFullYear(), month - 1, day);
        if (next < today) {
            next = new Date(today.getFullYear() + 1, month - 1, day);
        }
        const daysAway = Math.round((next - today) / 86400000);
        let soon = '';
        if (daysAway === 0) {
            soon = '¡Cumple hoy!';
        } else if (daysAway === 1) {
            soon = 'Cumple mañana';
        } else if (daysAway <= BIRTHDAY_SOON_DAYS) {
            soon = `Cumple en ${daysAway} días`;
        }
        return {
            label: new Date(2000, month - 1, day).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }),
            soon
        };
    }

    // ── Contacto ──────────────────────────────────────────────────────────────

    get whatsappLink() {
        return whatsappUrl(this.client?.Phone__c);
    }

    get callLink() {
        return phoneUrl(this.client?.Phone__c);
    }

    get emailLink() {
        return this.client?.Email__c ? `mailto:${this.client.Email__c}` : null;
    }

    get instagram() {
        return instagramProfile(this.client?.Instagram__c);
    }

    get hasContact() {
        return Boolean(this.whatsappLink || this.callLink || this.emailLink || this.instagram);
    }

    // ── Ficha de salud ────────────────────────────────────────────────────────

    get medicalConditions() {
        return splitMultiPicklist(this.client?.Medical_Conditions__c).filter(item => item !== NO_CONDITIONS);
    }

    get declaredNoConditions() {
        return splitMultiPicklist(this.client?.Medical_Conditions__c).includes(NO_CONDITIONS);
    }

    get hasHealthInfo() {
        return Boolean(
            this.client?.Allergies_Notes__c
            || this.client?.Treatment_Protocol__c
            || this.medicalConditions.length
            || this.declaredNoConditions
        );
    }

    // ── Estadísticas e historial ─────────────────────────────────────────────

    get totalVisits() {
        return this.client?.Total_Visits__c || 0;
    }

    get formattedTotalSpent() {
        return formatCurrency(this.client?.Total_Spent__c);
    }

    get formattedLastVisit() {
        const value = this.client?.Last_Visit_Date__c;
        if (!value) {
            return 'Sin visitas';
        }
        const [y, m, d] = value.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    get preferredServices() {
        return splitMultiPicklist(this.client?.Preferred_Services__c);
    }

    get hasPreferredServices() {
        return this.preferredServices.length > 0;
    }

    get hasRecentAppointments() {
        return this.recentAppointments.length > 0;
    }

    handleViewHistory() {
        this[NavigationMixin.Navigate]({
            type: 'standard__navItemPage',
            attributes: { apiName: 'Historial_de_Citas' },
            state: { c__cliente: this.client.Full_Name__c }
        });
    }
}
