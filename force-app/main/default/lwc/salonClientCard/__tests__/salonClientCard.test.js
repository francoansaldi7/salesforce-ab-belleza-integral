import { createElement } from 'lwc';
import SalonClientCard from 'c/salonClientCard';
import getClientCard from '@salesforce/apex/SalonController.getClientCard';
import getClientRecentAppointments from '@salesforce/apex/SalonController.getClientRecentAppointments';
import { getRecord } from 'lightning/uiRecordApi';
import { getNavigateCalledWith } from 'lightning/navigation';

jest.mock('@salesforce/apex/SalonController.getClientCard', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.getClientRecentAppointments', () => ({ default: jest.fn() }), { virtual: true });

// Fictional client.
const CLIENT = {
    Id: 'c01',
    Full_Name__c: 'Valentina Ficticia',
    Phone__c: '011 15 2345-6789',
    Email__c: 'valentina@example.com',
    Instagram__c: '@ejemplo.ficticio.ab.test',
    Birthday__c: '1992-03-14',
    Allergies_Notes__c: 'Sensible al amoníaco',
    Medical_Conditions__c: 'Diabetes;Tiroides',
    Treatment_Protocol__c: 'Sesión 2 de 6\nUsar producto suave',
    Preferred_Services__c: 'Coloración;Faciales',
    Total_Visits__c: 12,
    Total_Spent__c: 540000,
    VIP_Client__c: true,
    Last_Visit_Date__c: '2026-09-20'
};

const APPOINTMENTS = [
    { Id: 'a1', Appointment_Date__c: '2026-09-20T13:00:00.000Z', Status__c: 'Completada', Services__c: 'Coloración;Faciales', Total_Amount__c: 74000 },
    { Id: 'a2', Appointment_Date__c: '2026-08-02T13:00:00.000Z', Status__c: 'Cancelada', Services__c: 'Faciales', Total_Amount__c: 32000 }
];

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
const $ = (element, selector) => element.shadowRoot.querySelector(selector);
const $$ = (element, selector) => [...element.shadowRoot.querySelectorAll(selector)];

async function renderCard(client = CLIENT) {
    getClientCard.mockResolvedValue(client);
    getClientRecentAppointments.mockResolvedValue(APPOINTMENTS);
    const element = createElement('c-salon-client-card', { is: SalonClientCard });
    element.recordId = client.Id;
    document.body.appendChild(element);
    getRecord.emit({ fields: { LastModifiedDate: { value: '2026-10-02T10:00:00.000Z' } } });
    await flushPromises();
    return element;
}

describe('c-salon-client-card', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('muestra nombre, iniciales, VIP y cumpleaños', async () => {
        const element = await renderCard();

        expect($(element, '.client-name').textContent).toContain('Valentina Ficticia');
        expect($(element, '.avatar').textContent).toBe('VF');
        expect($(element, '.badge-vip')).not.toBeNull();
        expect($(element, '.birthday').textContent).toContain('14 de marzo');
    });

    it('arma los botones de contacto: WhatsApp, llamada, email e Instagram', async () => {
        const element = await renderCard();

        expect($(element, '.contact-btn--whatsapp').getAttribute('href')).toBe('https://wa.me/5491123456789');
        expect($(element, '.contact-btn--call').getAttribute('href')).toBe('tel:01115234' + '56789');
        expect($(element, '.contact-btn--email').getAttribute('href')).toBe('mailto:valentina@example.com');
        expect($(element, '.contact-btn--instagram').getAttribute('href')).toBe('https://instagram.com/ejemplo.ficticio.ab.test');
        expect($(element, '.contact-btn--instagram').textContent).toContain('@ejemplo.ficticio.ab.test');
    });

    it('sin datos de contacto muestra una ayuda en lugar de botones', async () => {
        const element = await renderCard({ ...CLIENT, Phone__c: null, Email__c: null, Instagram__c: null });

        expect($(element, '.contact-btn')).toBeNull();
        expect($(element, '.contact .hint').textContent).toContain('Sin datos de contacto');
    });

    it('agrupa la ficha de salud: alergias, enfermedades y seguimiento', async () => {
        const element = await renderCard();

        expect($(element, '.allergy-alert').textContent).toContain('Sensible al amoníaco');
        expect($$(element, '.condition-tag').map(t => t.textContent)).toEqual(['Diabetes', 'Tiroides']);
        expect($(element, '.treatment').textContent).toContain('Sesión 2 de 6');
    });

    it('indica "Ninguna declarada" cuando la clienta no tiene enfermedades', async () => {
        const element = await renderCard({ ...CLIENT, Allergies_Notes__c: null, Treatment_Protocol__c: null, Medical_Conditions__c: 'Ninguna de las anteriores' });

        expect($(element, '.allergy-alert')).toBeNull();
        expect($(element, '.condition-tag')).toBeNull();
        expect($(element, '.health-none').textContent).toBe('Ninguna declarada');
    });

    it('muestra estadísticas, servicios preferidos y las últimas citas', async () => {
        const element = await renderCard();

        const stats = $$(element, '.stat-value').map(v => v.textContent.replace(/\s/g, ' '));
        expect(stats[0]).toBe('12');
        expect(stats[1]).toBe('$ 540.000,00');
        expect($$(element, '.stats ~ .section .service-tag').length).toBeGreaterThan(0);
        expect($$(element, '.history-item')).toHaveLength(2);
        expect($(element, '.history-item .status-completada')).not.toBeNull();
    });

    it('"Ver historial completo" abre el Historial filtrado por la clienta', async () => {
        const element = await renderCard();

        $(element, '.view-history').click();

        expect(getNavigateCalledWith()).toEqual({
            type: 'standard__navItemPage',
            attributes: { apiName: 'Historial_de_Citas' },
            state: { c__cliente: 'Valentina Ficticia' }
        });
    });

    it('muestra un mensaje si no se puede cargar la clienta', async () => {
        getClientCard.mockRejectedValue({ body: { message: 'error' } });
        getClientRecentAppointments.mockResolvedValue([]);
        const element = createElement('c-salon-client-card', { is: SalonClientCard });
        element.recordId = 'c99';
        document.body.appendChild(element);
        getRecord.emit({ fields: { LastModifiedDate: { value: 'x' } } });
        await flushPromises();

        expect($(element, '.ab-empty').textContent).toContain('No se pudo cargar');
    });
});
