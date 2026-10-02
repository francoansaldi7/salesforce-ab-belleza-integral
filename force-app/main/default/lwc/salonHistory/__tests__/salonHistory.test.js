import { createElement } from 'lwc';
import SalonHistory from 'c/salonHistory';
import getAppointmentHistory from '@salesforce/apex/SalonController.getAppointmentHistory';
import { CurrentPageReference, getNavigateCalledWith } from 'lightning/navigation';

jest.mock('@salesforce/apex/SalonController.getAppointmentHistory', () => ({ default: jest.fn() }), { virtual: true });

// Fictional data.
const RECORDS = [
    {
        Id: 'a1', Appointment_Date__c: '2026-09-28T13:30:00.000Z', Status__c: 'Completada', Services__c: 'Coloración;Faciales',
        Total_Amount__c: 74000, Payment_Method__c: 'Transferencia', Client__c: 'c1',
        Client__r: { Full_Name__c: 'Camila Ejemplo', VIP_Client__c: true }
    },
    {
        Id: 'a2', Appointment_Date__c: '2026-09-21T16:00:00.000Z', Status__c: 'Cancelada', Services__c: 'Manicure Gel',
        Total_Amount__c: 16000, Payment_Method__c: 'Efectivo', Client__c: 'c2',
        Client__r: { Full_Name__c: 'Sofía Demo', VIP_Client__c: false }
    }
];

function result(records = RECORDS, totalCount = 2) {
    return {
        records,
        totalCount,
        countByStatus: { Completada: 1, Cancelada: 1 },
        totalBilled: 74000
    };
}

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
const flushDebounce = () => new Promise(resolve => setTimeout(resolve, 350));
const $ = (element, selector) => element.shadowRoot.querySelector(selector);
const $$ = (element, selector) => [...element.shadowRoot.querySelectorAll(selector)];

async function render() {
    const element = createElement('c-salon-history', { is: SalonHistory });
    document.body.appendChild(element);
    await flushPromises();
    return element;
}

describe('c-salon-history', () => {
    beforeEach(() => {
        getAppointmentHistory.mockResolvedValue(result());
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('carga los últimos 3 meses, más recientes primero, página 1', async () => {
        await render();

        const args = getAppointmentHistory.mock.calls[0][0];
        expect(args.statuses).toEqual([]);
        expect(args.newestFirst).toBe(true);
        expect(args.pageNumber).toBe(1);
        expect(args.fromDate).toMatch(/^\d{4}-\d{2}-01$/);
        expect(args.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('muestra el resumen del filtro', async () => {
        const element = await render();

        expect($(element, '.summary-total').textContent).toBe('2');
        expect($(element, '.summary-completed').textContent).toBe('1');
        expect($(element, '.summary-cancelled').textContent).toBe('1');
        expect($(element, '.summary-noshow').textContent).toBe('0');
        expect($(element, '.summary-billed').textContent.replace(/\s/g, ' ')).toBe('$ 74.000,00');
    });

    it('lista cada cita con clienta, VIP, servicios, estado y monto', async () => {
        const element = await render();

        const rows = $$(element, '.appointment-row');
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelector('.client-link').textContent).toBe('Camila Ejemplo');
        expect(rows[0].querySelector('.badge-vip')).not.toBeNull();
        expect([...rows[0].querySelectorAll('.service-tag')].map(t => t.textContent)).toEqual(['Coloración', 'Faciales']);
        expect(rows[0].querySelector('.status-completada').textContent).toBe('Completada');
        expect(rows[1].querySelector('.status-cancelada')).not.toBeNull();
        expect(rows[1].querySelector('.row-method').textContent).toBe('Efectivo');
    });

    it('filtra por estado con los chips y vuelve a "todos"', async () => {
        const element = await render();

        $(element, '[data-status="No Asistió"]').click();
        await flushPromises();
        expect(getAppointmentHistory.mock.calls[1][0].statuses).toEqual(['No Asistió']);
        expect($(element, '[data-status="No Asistió"]').getAttribute('aria-pressed')).toBe('true');

        $(element, '.clear-statuses').click();
        await flushPromises();
        expect(getAppointmentHistory.mock.calls[2][0].statuses).toEqual([]);
    });

    it('cambia el período y usa fechas personalizadas', async () => {
        const element = await render();

        $(element, '[data-period="all"]').click();
        await flushPromises();
        expect(getAppointmentHistory.mock.calls[1][0]).toEqual(expect.objectContaining({ fromDate: null, toDate: null }));

        $(element, '[data-period="custom"]').click();
        await flushPromises();
        const from = $(element, '.date-from');
        from.value = '2026-01-01';
        from.dispatchEvent(new CustomEvent('change'));
        await flushPromises();
        expect(getAppointmentHistory).toHaveBeenLastCalledWith(expect.objectContaining({ fromDate: '2026-01-01', toDate: null }));
    });

    it('busca por clienta con demora (debounce)', async () => {
        const element = await render();

        const search = $(element, '.search-input');
        search.value = 'cami';
        search.dispatchEvent(new CustomEvent('input'));
        search.value = 'camila';
        search.dispatchEvent(new CustomEvent('input'));
        await flushDebounce();

        expect(getAppointmentHistory).toHaveBeenCalledTimes(2);
        expect(getAppointmentHistory).toHaveBeenLastCalledWith(expect.objectContaining({ clientSearch: 'camila', pageNumber: 1 }));
    });

    it('invierte el orden y pagina de a 15', async () => {
        getAppointmentHistory.mockResolvedValue(result(RECORDS, 32));
        const element = await render();

        expect($(element, '.page-label').textContent).toBe('Página 1 de 3');
        $$(element, '.page-btn')[1].click();
        await flushPromises();
        expect(getAppointmentHistory).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2 }));

        $(element, '.sort-btn').click();
        await flushPromises();
        expect(getAppointmentHistory).toHaveBeenLastCalledWith(expect.objectContaining({ newestFirst: false, pageNumber: 1 }));
        expect($(element, '.sort-btn').textContent).toContain('Más antiguas primero');
    });

    it('al tocar a la clienta abre su ficha sin abrir la edición', async () => {
        const element = await render();

        $(element, '.client-link').click();

        expect(getNavigateCalledWith()).toEqual({
            type: 'standard__recordPage',
            attributes: { recordId: 'c1', objectApiName: 'Salon_Client__c', actionName: 'view' }
        });
        expect($(element, 'c-salon-appointment-edit-modal').shadowRoot.querySelector('.ab-modal')).toBeNull();
    });

    it('al tocar una fila abre la edición de la cita', async () => {
        const element = await render();

        $(element, '.appointment-row').click();
        await flushPromises();

        const modal = $(element, 'c-salon-appointment-edit-modal');
        expect(modal.shadowRoot.querySelector('lightning-record-edit-form').recordId).toBe('a1');
    });

    it('llega filtrado por clienta desde su ficha', async () => {
        const element = await render();

        CurrentPageReference.emit({ state: { c__cliente: 'Sofía Demo' } });
        await flushPromises();

        expect($(element, '.search-input').value).toBe('Sofía Demo');
        expect(getAppointmentHistory).toHaveBeenLastCalledWith(expect.objectContaining({ clientSearch: 'Sofía Demo', fromDate: null }));
    });

    it('muestra un estado vacío amable', async () => {
        getAppointmentHistory.mockResolvedValue({ records: [], totalCount: 0, countByStatus: {}, totalBilled: 0 });
        const element = await render();

        expect($(element, '.ab-empty__title').textContent).toBe('Sin citas para mostrar');
    });
});
