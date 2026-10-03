// Ventana para editar o eliminar una cita. La usan el Panel de Control y el Historial de Citas.
import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import deleteAppointment from '@salesforce/apex/SalonController.deleteAppointment';
import { errorMessage } from 'c/salonUtils';

export default class SalonAppointmentEditModal extends LightningElement {
    appointmentId = null;
    appointmentLabel = '';
    mode = 'edit'; // 'edit' | 'confirmDelete'
    isDeleting = false;
    cameFromEdit = false;

    /** label: short description shown when confirming a delete, e.g. "Ana Pérez · mié 14/10 15:00". */
    @api
    open(appointmentId, label) {
        this.appointmentId = appointmentId;
        this.appointmentLabel = label || '';
        this.mode = 'edit';
        this.cameFromEdit = false;
    }

    @api
    confirmDelete(appointmentId, label) {
        this.open(appointmentId, label);
        this.mode = 'confirmDelete';
    }

    @api
    close() {
        this.appointmentId = null;
        this.isDeleting = false;
    }

    get isOpen() {
        return Boolean(this.appointmentId);
    }

    get isEditMode() {
        return this.mode === 'edit';
    }

    get confirmText() {
        return this.appointmentLabel ? `la cita de ${this.appointmentLabel}` : 'esta cita';
    }

    get deleteButtonLabel() {
        return this.isDeleting ? 'Eliminando…' : 'Sí, eliminar';
    }

    handleSuccess(event) {
        const { id, fields } = event.detail;
        this.close();
        this.toast('Guardado', 'La cita fue actualizada.', 'success');
        this.dispatchEvent(new CustomEvent('saved', { detail: { id, fields } }));
    }

    handleError(event) {
        const detail = event.detail?.detail || event.detail?.message || 'Error de validación';
        this.toast('No se pudo guardar', detail, 'error');
    }

    handleAskDelete() {
        this.cameFromEdit = true;
        this.mode = 'confirmDelete';
    }

    // From the edit window, "No" goes back to the form; from the menu, it just closes.
    handleCancelDelete() {
        if (this.cameFromEdit) {
            this.mode = 'edit';
        } else {
            this.close();
        }
    }

    handleConfirmDelete() {
        if (this.isDeleting) {
            return;
        }
        this.isDeleting = true;
        const id = this.appointmentId;
        deleteAppointment({ appointmentId: id })
            .then(() => {
                this.close();
                this.toast('Cita eliminada', 'Se puede recuperar desde la Papelera de reciclaje durante 15 días.', 'success');
                this.dispatchEvent(new CustomEvent('deleted', { detail: { id } }));
            })
            .catch(error => {
                this.isDeleting = false;
                this.toast('No se pudo eliminar', errorMessage(error, 'Intentá de nuevo.'), 'error');
            });
    }

    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.close();
        }
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
