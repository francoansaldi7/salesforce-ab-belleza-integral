import { createElement } from 'lwc';
import SalonCalendar from 'c/salonCalendar';
import getAppointmentDaysInMonth from '@salesforce/apex/SalonController.getAppointmentDaysInMonth';
import getAppointmentsForDay from '@salesforce/apex/SalonController.getAppointmentsForDay';

jest.mock('@salesforce/apex/SalonController.getAppointmentDaysInMonth', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.getAppointmentsForDay', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SalonController.deleteAppointment', () => ({ default: jest.fn() }), { virtual: true });

// Fictional data. "Today" is Wednesday 14 October 2026; 1 October 2026 is a Thursday.
const DAY_APPOINTMENTS = [
    {
        Id: 'a1', Appointment_Date__c: '2026-10-14T13:00:00.000Z', Status__c: 'Confirmada', Services__c: 'Coloración;Faciales',
        Total_Amount__c: 74000, Amount_Paid__c: 74000, Client__c: 'c1',
        Client__r: { Full_Name__c: 'Camila Ejemplo', VIP_Client__c: true, Allergies_Notes__c: 'Sensible al amoníaco' }
    },
    {
        Id: 'a2', Appointment_Date__c: '2026-10-14T18:00:00.000Z', Status__c: 'Cancelada', Services__c: 'Manicure Gel',
        Total_Amount__c: 16000, Client__c: 'c2', Client__r: { Full_Name__c: 'Sofía Demo', VIP_Client__c: false }
    }
];

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
const $ = (element, selector) => element.shadowRoot.querySelector(selector);
const $$ = (element, selector) => [...element.shadowRoot.querySelectorAll(selector)];
const dayButton = (element, day) => $(element, `button.day[data-day="${day}"]`);

async function openCalendar() {
    const element = createElement('c-salon-calendar', { is: SalonCalendar });
    document.body.appendChild(element);
    element.open();
    await flushPromises();
    return element;
}

describe('c-salon-calendar', () => {
    beforeEach(() => {
        jest.useFakeTimers({
            now: new Date(2026, 9, 14, 10, 0),
            doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'nextTick', 'queueMicrotask']
        });
        getAppointmentDaysInMonth.mockResolvedValue({ 14: 2, 21: 1 });
        getAppointmentsForDay.mockResolvedValue(DAY_APPOINTMENTS);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('está cerrado hasta que se abre, y abre en el mes actual', async () => {
        const element = createElement('c-salon-calendar', { is: SalonCalendar });
        document.body.appendChild(element);
        expect($(element, '.calendar-modal')).toBeNull();

        element.open();
        await flushPromises();

        expect($(element, '.month-label').textContent).toBe('Octubre 2026');
        expect(getAppointmentDaysInMonth).toHaveBeenCalledWith({ year: 2026, month: 10 });
    });

    it('arma el mes de lunes a domingo, con huecos antes del día 1', async () => {
        const element = await openCalendar();

        const firstWeek = $$(element, '.month-grid tbody tr')[0].querySelectorAll('td');
        expect([...firstWeek].map(td => td.textContent.trim())).toEqual(['', '', '', '1', '2', '3', '4']);
        expect($$(element, 'button.day')).toHaveLength(31);
        expect($$(element, '.month-grid th').map(th => th.textContent)).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
    });

    it('marca en rojo los días con citas y resalta hoy', async () => {
        const element = await openCalendar();

        expect(dayButton(element, 14).className).toContain('day--busy');
        expect(dayButton(element, 21).className).toContain('day--busy');
        expect(dayButton(element, 15).className).not.toContain('day--busy');
        expect(dayButton(element, 14).className).toContain('day--today');
        expect(dayButton(element, 14).getAttribute('aria-label')).toBe('14 de octubre: 2 citas');
        expect(dayButton(element, 15).getAttribute('aria-label')).toBe('15 de octubre: sin citas');
        expect($(element, '.legend').textContent).toBe('2 días con citas');
    });

    it('cambia de mes con las flechas y vuelve a hoy', async () => {
        const element = await openCalendar();

        $(element, '.next-month').click();
        await flushPromises();
        $(element, '.next-month').click();
        await flushPromises();
        expect($(element, '.month-label').textContent).toBe('Diciembre 2026');

        $(element, '.next-month').click();
        await flushPromises();
        expect($(element, '.month-label').textContent).toBe('Enero 2027');
        expect(getAppointmentDaysInMonth).toHaveBeenLastCalledWith({ year: 2027, month: 1 });

        $(element, '.this-month').click();
        await flushPromises();
        expect($(element, '.month-label').textContent).toBe('Octubre 2026');
        expect($(element, '.this-month')).toBeNull();
    });

    it('al tocar un día muestra sus citas en orden, con las canceladas atenuadas', async () => {
        const element = await openCalendar();

        dayButton(element, 14).click();
        await flushPromises();

        expect(getAppointmentsForDay).toHaveBeenCalledWith({ day: '2026-10-14' });
        expect($(element, '.day-title').textContent).toBe('Miércoles, 14 de octubre');
        const rows = $$(element, '.day-row');
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelector('.day-row__client').textContent).toContain('Camila Ejemplo');
        expect(rows[0].querySelector('.badge-vip')).not.toBeNull();
        expect(rows[0].querySelector('.badge-allergy').title).toBe('Sensible al amoníaco');
        expect(rows[0].querySelectorAll('.service-tag')).toHaveLength(2);
        expect(rows[0].querySelector('.day-row__amount').textContent.replace(/\s/g, ' ')).toBe('$ 74.000,00');
        expect(rows[1].className).toContain('day-row--cancelled');
    });

    it('un día sin citas muestra el aviso', async () => {
        getAppointmentsForDay.mockResolvedValue([]);
        const element = await openCalendar();

        dayButton(element, 15).click();
        await flushPromises();

        expect($(element, '.day-empty').textContent).toBe('No hay citas para este día.');
    });

    it('al tocar una cita abre la ventana de edición de siempre', async () => {
        const element = await openCalendar();
        dayButton(element, 14).click();
        await flushPromises();

        $$(element, '.day-row')[0].click();
        await flushPromises();

        const editModal = $(element, 'c-salon-appointment-edit-modal');
        expect(editModal.shadowRoot.querySelector('lightning-record-edit-form').recordId).toBe('a1');
    });

    it('después de editar o eliminar recarga el día y el mes, y avisa al panel', async () => {
        const element = await openCalendar();
        const changed = jest.fn();
        element.addEventListener('appointmentchange', changed);
        dayButton(element, 14).click();
        await flushPromises();

        $(element, 'c-salon-appointment-edit-modal').dispatchEvent(new CustomEvent('deleted', { detail: { id: 'a2' } }));
        await flushPromises();

        expect(getAppointmentsForDay).toHaveBeenCalledTimes(2);
        expect(getAppointmentDaysInMonth).toHaveBeenCalledTimes(2);
        expect(changed).toHaveBeenCalledTimes(1);
    });

    it('"Volver al calendario" cierra la lista del día y la X cierra el calendario', async () => {
        const element = await openCalendar();
        dayButton(element, 14).click();
        await flushPromises();
        expect($(element, '.calendar-overlay').className).toContain('calendar-overlay--behind');

        $(element, '.back-btn').click();
        await flushPromises();
        expect($(element, '.day-modal')).toBeNull();
        expect($(element, '.calendar-overlay').className).not.toContain('calendar-overlay--behind');

        $(element, '.calendar-close').click();
        await flushPromises();
        expect($(element, '.calendar-modal')).toBeNull();
    });

    it('Escape cierra primero el día y después el calendario', async () => {
        const element = await openCalendar();
        dayButton(element, 14).click();
        await flushPromises();

        $(element, '.day-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flushPromises();
        expect($(element, '.day-modal')).toBeNull();
        expect($(element, '.calendar-modal')).not.toBeNull();

        $(element, '.calendar-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flushPromises();
        expect($(element, '.calendar-modal')).toBeNull();
    });

    it('si falla la carga del mes muestra el error', async () => {
        getAppointmentDaysInMonth.mockRejectedValue({ body: { message: 'Sin conexión' } });
        const element = await openCalendar();

        expect($(element, '.calendar-error').textContent).toBe('Sin conexión');
        expect($$(element, 'button.day.day--busy')).toHaveLength(0);
    });
});
