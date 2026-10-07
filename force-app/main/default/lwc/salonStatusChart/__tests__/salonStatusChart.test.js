import { createElement } from 'lwc';
import SalonStatusChart from 'c/salonStatusChart';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
const $ = (element, selector) => element.shadowRoot.querySelector(selector);
const $$ = (element, selector) => [...element.shadowRoot.querySelectorAll(selector)];

async function render(props = {}) {
    const element = createElement('c-salon-status-chart', { is: SalonStatusChart });
    Object.assign(element, props);
    document.body.appendChild(element);
    await flushPromises();
    return element;
}

describe('c-salon-status-chart', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('dibuja una porción por estado con citas, con el color de su etiqueta', async () => {
        const element = await render({ counts: { Completada: 6, Cancelada: 2 } });

        const slices = $$(element, '.slice');
        expect(slices.map(s => s.dataset.status)).toEqual(['Completada', 'Cancelada']);
        expect(slices[0].getAttribute('class')).toContain('slice--completada');
        expect(slices[1].getAttribute('class')).toContain('slice--cancelada');
        // 75% y 25% del anillo, menos el pequeño espacio entre porciones.
        expect(slices[0].getAttribute('stroke-dasharray')).toBe('74.40 25.60');
        expect(slices[1].getAttribute('stroke-dashoffset')).toBe('-50.00');
        expect($(element, '.donut-center__value').textContent).toBe('8');
        expect($(element, '.donut-center__label').textContent).toBe('citas');
    });

    it('la leyenda muestra los seis estados con cantidad y porcentaje', async () => {
        const element = await render({ counts: { Completada: 3, 'No Asistió': 1 } });

        const items = $$(element, '.legend-item');
        expect(items.map(i => i.querySelector('.legend-label').textContent)).toEqual(
            ['Programada', 'Confirmada', 'En Progreso', 'Completada', 'No Asistió', 'Cancelada']
        );
        expect(items[3].querySelector('.legend-count').textContent).toBe('3');
        expect(items[3].querySelector('.legend-percent').textContent).toBe('75%');
        expect(items[4].querySelector('.legend-percent').textContent).toBe('25%');
        expect(items[0].className).toContain('legend-item--empty');
    });

    it('al pasar el mouse muestra el detalle del estado en el centro', async () => {
        const element = await render({ counts: { Completada: 3, 'No Asistió': 1 } });

        $$(element, '.slice')[1].dispatchEvent(new CustomEvent('mouseenter'));
        await flushPromises();

        expect($(element, '.donut-center__value').textContent).toBe('1');
        expect($(element, '.donut-center__label').textContent).toBe('No Asistió');
        expect($(element, '.donut-center__percent').textContent).toBe('25%');
        expect($$(element, '.slice')[0].getAttribute('class')).toContain('slice--dimmed');

        $$(element, '.slice')[1].dispatchEvent(new CustomEvent('mouseleave'));
        await flushPromises();
        expect($(element, '.donut-center__value').textContent).toBe('4');
    });

    it('tocar un estado de la leyenda pide filtrar por ese estado', async () => {
        const element = await render({ counts: { Completada: 3 }, selectedStatuses: ['Completada'] });
        const handler = jest.fn();
        element.addEventListener('statustoggle', handler);

        const completed = $$(element, '.legend-item')[3];
        expect(completed.getAttribute('aria-pressed')).toBe('true');
        completed.click();

        expect(handler.mock.calls[0][0].detail).toEqual({ status: 'Completada' });
    });

    it('sin citas muestra el anillo vacío y un aviso', async () => {
        const element = await render({ counts: {} });

        expect($$(element, '.slice')).toHaveLength(0);
        expect($(element, '.donut-center__value').textContent).toBe('0');
        expect($(element, '.chart-empty').textContent).toBe('No hay citas con estos filtros.');
    });
});
