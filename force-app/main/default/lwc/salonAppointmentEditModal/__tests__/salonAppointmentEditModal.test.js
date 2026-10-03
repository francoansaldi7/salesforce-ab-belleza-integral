import { createElement } from 'lwc';
import SalonAppointmentEditModal from 'c/salonAppointmentEditModal';
import deleteAppointment from '@salesforce/apex/SalonController.deleteAppointment';

jest.mock('@salesforce/apex/SalonController.deleteAppointment', () => ({ default: jest.fn() }), { virtual: true });

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

async function render() {
    const element = createElement('c-salon-appointment-edit-modal', { is: SalonAppointmentEditModal });
    document.body.appendChild(element);
    await flushPromises();
    return element;
}

describe('c-salon-appointment-edit-modal', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('está cerrado hasta que se abre con una cita', async () => {
        const element = await render();
        expect(element.shadowRoot.querySelector('.ab-modal')).toBeNull();

        element.open('a01');
        await flushPromises();

        expect(element.shadowRoot.querySelector('lightning-record-edit-form').recordId).toBe('a01');
        expect(element.shadowRoot.querySelector('.ab-modal__title').textContent).toBe('Editar cita');
    });

    it('al guardar avisa al componente padre y se cierra', async () => {
        const element = await render();
        const saved = jest.fn();
        element.addEventListener('saved', saved);
        element.open('a01');
        await flushPromises();

        element.shadowRoot.querySelector('lightning-record-edit-form')
            .dispatchEvent(new CustomEvent('success', { detail: { id: 'a01', fields: { Status__c: { value: 'Completada' } } } }));
        await flushPromises();

        expect(saved.mock.calls[0][0].detail).toEqual({ id: 'a01', fields: { Status__c: { value: 'Completada' } } });
        expect(element.shadowRoot.querySelector('.ab-modal')).toBeNull();
    });

    it('se cierra con Escape o con la X', async () => {
        const element = await render();
        element.open('a01');
        await flushPromises();

        element.shadowRoot.querySelector('.ab-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flushPromises();
        expect(element.shadowRoot.querySelector('.ab-modal')).toBeNull();

        element.open('a02');
        await flushPromises();
        element.shadowRoot.querySelector('.ab-modal__close').click();
        await flushPromises();
        expect(element.shadowRoot.querySelector('.ab-modal')).toBeNull();
    });

    it('desde la edición pide confirmación antes de eliminar y "No, volver" regresa al formulario', async () => {
        const element = await render();
        element.open('a01', 'Ana Ejemplo · mié 14/10 · 15:00');
        await flushPromises();

        element.shadowRoot.querySelector('.delete-btn').click();
        await flushPromises();
        expect(element.shadowRoot.querySelector('.confirm-text').textContent).toContain('¿Eliminar la cita de Ana Ejemplo · mié 14/10 · 15:00?');
        expect(deleteAppointment).not.toHaveBeenCalled();

        element.shadowRoot.querySelector('.cancel-delete').click();
        await flushPromises();
        expect(element.shadowRoot.querySelector('lightning-record-edit-form')).not.toBeNull();
    });

    it('al confirmar elimina la cita, avisa al padre y se cierra', async () => {
        deleteAppointment.mockResolvedValue();
        const element = await render();
        const deleted = jest.fn();
        element.addEventListener('deleted', deleted);
        element.confirmDelete('a07', 'Sofía Demo · jue 15/10 · 10:00');
        await flushPromises();

        element.shadowRoot.querySelector('.confirm-delete').click();
        await flushPromises();

        expect(deleteAppointment).toHaveBeenCalledWith({ appointmentId: 'a07' });
        expect(deleted.mock.calls[0][0].detail).toEqual({ id: 'a07' });
        expect(element.shadowRoot.querySelector('.ab-modal')).toBeNull();
    });

    it('abierta desde el menú, "No, volver" simplemente cierra', async () => {
        const element = await render();
        element.confirmDelete('a07', 'Sofía Demo');
        await flushPromises();

        element.shadowRoot.querySelector('.cancel-delete').click();
        await flushPromises();

        expect(element.shadowRoot.querySelector('.ab-modal')).toBeNull();
        expect(deleteAppointment).not.toHaveBeenCalled();
    });

    it('si falla la eliminación queda abierta para reintentar', async () => {
        deleteAppointment.mockRejectedValue({ body: { message: 'La cita ya no existe.' } });
        const element = await render();
        element.confirmDelete('a07', 'Sofía Demo');
        await flushPromises();

        element.shadowRoot.querySelector('.confirm-delete').click();
        await flushPromises();

        expect(element.shadowRoot.querySelector('.confirm-delete')).not.toBeNull();
        expect(element.shadowRoot.querySelector('.confirm-delete').disabled).toBe(false);
    });
});
