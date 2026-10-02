import { createElement } from 'lwc';
import SalonAppointmentEditModal from 'c/salonAppointmentEditModal';

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
});
