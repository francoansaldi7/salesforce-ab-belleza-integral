import { createElement } from 'lwc';
import SalonHome from 'c/salonHome';
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

jest.mock('@salesforce/apex/SalonController.getTodayAppointments', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.getPendingAppointments', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.getMonthlyBalance', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.getOpenAppointmentsCount', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.getLowStockCount', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.getDormantClientsCount', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.getLowStockProducts', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.getDormantClients', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.updateAppointmentStatus', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.getMonthlyBalanceDetail', () => ({ default: jest.fn() }), { virtual: true });

// Fictional sample data only.
const TODAY_APPTS = [
    {
        Id: 'a01', Appointment_Date__c: '2026-10-02T13:00:00.000Z', Status__c: 'Programada',
        Services__c: 'Corte de Cabello', Amount_Paid__c: 25000,
        Client__r: { Full_Name__c: 'Cliente Ejemplo', VIP_Client__c: true, Allergies_Notes__c: 'Alergia al amoníaco' }
    },
    {
        Id: 'a02', Appointment_Date__c: '2026-10-02T15:30:00.000Z', Status__c: 'Confirmada',
        Services__c: 'Manicure', Amount_Paid__c: 12000,
        Client__r: { Full_Name__c: 'Otra Clienta', VIP_Client__c: false }
    }
];

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

function mockDefaults() {
    getTodayAppointments.mockResolvedValue(TODAY_APPTS);
    getPendingAppointments.mockResolvedValue([]);
    getMonthlyBalance.mockResolvedValue(1234567.5);
    getOpenAppointmentsCount.mockResolvedValue(7);
    getLowStockCount.mockResolvedValue(3);
    getDormantClientsCount.mockResolvedValue(12);
}

async function render() {
    const element = createElement('c-salon-home', { is: SalonHome });
    document.body.appendChild(element);
    await flushPromises();
    return element;
}

const $ = (element, selector) => element.shadowRoot.querySelector(selector);
const $$ = (element, selector) => [...element.shadowRoot.querySelectorAll(selector)];

describe('c-salon-home', () => {
    beforeEach(() => {
        jest.useRealTimers();
        mockDefaults();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('muestra los KPIs con el balance en pesos argentinos', async () => {
        const element = await render();

        const values = $$(element, '.kpi-tile__value').map(v => v.textContent.trim());
        expect(values[0].replace(/\s/g, ' ')).toBe('$ 1.234.567,50');
        expect(values.slice(1)).toEqual(['7', '3', '12']);
    });

    it('lista las citas de hoy con insignias VIP y de alergia', async () => {
        const element = await render();

        const items = $$(element, '.appointment-item');
        expect(items).toHaveLength(2);
        expect(items[0].querySelector('.appt-client').textContent).toContain('Cliente Ejemplo');
        expect(items[0].querySelector('.badge-vip')).not.toBeNull();
        expect(items[0].querySelector('.badge-allergy').title).toBe('Alergia al amoníaco');
        expect(items[1].querySelector('.badge-vip')).toBeNull();
        expect($(element, '.panel-header__count').textContent).toBe('2');
    });

    it('al pasar a Próximas sin citas muestra el mensaje correcto (no "para hoy")', async () => {
        const element = await render();

        $(element, '[data-view="pending"]').click();
        await flushPromises();

        expect($(element, '.panel-header__title').textContent).toBe('Citas Pendientes');
        expect($(element, '.empty-state').textContent).toContain('No hay citas próximas.');
    });

    it('muestra el mensaje de "hoy" cuando no hay citas para hoy', async () => {
        getTodayAppointments.mockResolvedValue([]);
        const element = await render();

        expect($(element, '.empty-state').textContent).toContain('No hay citas programadas para hoy.');
    });

    it('cambia el estado de una cita y recarga los datos', async () => {
        updateAppointmentStatus.mockResolvedValue();
        const element = await render();

        const menu = $(element, 'lightning-button-menu');
        menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'Completada' } }));
        await flushPromises();

        expect(updateAppointmentStatus).toHaveBeenCalledWith({ appointmentId: 'a01', newStatus: 'Completada' });
        expect(getTodayAppointments).toHaveBeenCalledTimes(2);
    });

    it('abre el asistente de Nueva Cita y lo cierra al terminar', async () => {
        const element = await render();

        $(element, '.action-new-appointment').click();
        await flushPromises();
        const flow = $(element, 'lightning-flow');
        expect(flow.flowApiName).toBe('Flujo_Nueva_Cita');
        expect($(element, '.flow-header__title').textContent).toBe('Nueva Cita');

        flow.dispatchEvent(new CustomEvent('statuschange', { detail: { status: 'FINISHED' } }));
        await flushPromises();

        expect($(element, 'lightning-flow')).toBeNull();
        expect(getTodayAppointments).toHaveBeenCalledTimes(2);
    });

    it('no da la operación por terminada mientras el asistente sigue abierto', async () => {
        const element = await render();

        $(element, '.action-new-appointment').click();
        await flushPromises();
        $(element, 'lightning-flow').dispatchEvent(new CustomEvent('statuschange', { detail: { status: 'STARTED' } }));
        await flushPromises();

        expect($(element, 'lightning-flow')).not.toBeNull();
    });

    it('abre el historial de balance y muestra los totales del mes', async () => {
        getMonthlyBalanceDetail.mockResolvedValue({
            income: 300000, expenses: 50000, balance: 250000,
            transactions: [
                { Id: 't1', Name: 'TRX-0001', Transaction_Type__c: 'Ingreso', Amount__c: 300000, Transaction_Date__c: '2026-10-01', Category__c: 'Ingreso por Servicio' },
                { Id: 't2', Name: 'TRX-0002', Transaction_Type__c: 'Gasto', Amount__c: 50000, Transaction_Date__c: '2026-10-02', Category__c: 'Insumos' }
            ]
        });
        const element = await render();

        $(element, '.kpi-income').click();
        await flushPromises();

        const cards = $$(element, '.balance-card__value').map(v => v.textContent.replace(/\s/g, ' '));
        expect(cards).toEqual(['$ 300.000,00', '$ 50.000,00', '$ 250.000,00']);
        expect($$(element, '.tx-date').map(d => d.textContent)).toEqual(['01/10/2026', '02/10/2026']);
    });

    it('carga los productos con bajo stock al abrir su detalle', async () => {
        getLowStockProducts.mockResolvedValue([
            { Id: 'p1', Name: 'Tinte Ejemplo', Category__c: 'Cabello', Stock_Quantity__c: 1, Low_Stock_Alert__c: 4 }
        ]);
        const element = await render();

        $(element, '.kpi-stock').click();
        await flushPromises();

        expect($(element, '.modal-item-name').textContent).toBe('Tinte Ejemplo');
        expect($(element, '.stock-min').textContent).toBe('mín. 4');
    });

    it('muestra la fecha de última visita de los clientes inactivos sin corrimiento de zona horaria', async () => {
        getDormantClients.mockResolvedValue([
            { Id: 'c1', Full_Name__c: 'Cliente Inactiva', Phone__c: '000', Last_Visit_Date__c: '2026-07-01' },
            { Id: 'c2', Full_Name__c: 'Cliente Nueva', Phone__c: '000', Last_Visit_Date__c: null }
        ]);
        const element = await render();

        $(element, '.kpi-dormant').click();
        await flushPromises();

        expect($$(element, '.date-value').map(d => d.textContent)).toEqual(['01/07/2026', 'Sin visitas registradas']);
    });
});
