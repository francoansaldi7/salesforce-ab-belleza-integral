// Ventana para editar una cita. La usan el Panel de Control y el Historial de Citas.
import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class SalonAppointmentEditModal extends LightningElement {
    appointmentId = null;

    @api
    open(appointmentId) {
        this.appointmentId = appointmentId;
    }

    @api
    close() {
        this.appointmentId = null;
    }

    get isOpen() {
        return Boolean(this.appointmentId);
    }

    handleSuccess(event) {
        const { id, fields } = event.detail;
        this.close();
        this.dispatchEvent(new ShowToastEvent({ title: 'Guardado', message: 'La cita fue actualizada.', variant: 'success' }));
        this.dispatchEvent(new CustomEvent('saved', { detail: { id, fields } }));
    }

    handleError(event) {
        const detail = event.detail?.detail || event.detail?.message || 'Error de validación';
        this.dispatchEvent(new ShowToastEvent({ title: 'No se pudo guardar', message: detail, variant: 'error' }));
    }

    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.close();
        }
    }
}
