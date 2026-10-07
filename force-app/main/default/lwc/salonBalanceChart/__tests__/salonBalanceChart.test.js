import { createElement } from 'lwc';
import SalonBalanceChart from 'c/salonBalanceChart';

const CATEGORIES = [
    { type: 'Ingreso', category: 'Ingreso por Servicio', total: 300000 },
    { type: 'Ingreso', category: 'Venta de Producto', total: 100000 },
    { type: 'Gasto', category: 'Insumos', total: 80000 },
    { type: 'Gasto', category: 'Marketing', total: 20000 }
];

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
const $ = (element, selector) => element.shadowRoot.querySelector(selector);
const $$ = (element, selector) => [...element.shadowRoot.querySelectorAll(selector)];
const text = el => el.textContent.replace(/\s/g, ' ');

async function render(props) {
    const element = createElement('c-salon-balance-chart', { is: SalonBalanceChart });
    Object.assign(element, props);
    document.body.appendChild(element);
    await flushPromises();
    return element;
}

describe('c-salon-balance-chart', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('compara ingresos y gastos con barras escaladas a la mayor', async () => {
        const element = await render({ income: 400000, expenses: 100000, categories: CATEGORIES });

        const rows = $$(element, '.bar-row');
        expect(rows.map(r => r.querySelector('.bar-label').textContent)).toEqual(['Ingresos', 'Gastos']);
        expect(text(rows[0].querySelector('.bar-amount'))).toBe('$ 400.000,00');
        expect(rows[0].querySelector('.bar-fill').style.width).toBe('100%');
        expect(rows[1].querySelector('.bar-fill').style.width).toBe('25%');
    });

    it('divide cada barra por categoría con su porcentaje', async () => {
        const element = await render({ income: 400000, expenses: 100000, categories: CATEGORIES });

        const incomeLegend = $$(element, '.bar-row--income .legend-item');
        expect(incomeLegend.map(i => i.querySelector('.legend-label').textContent)).toEqual(['Ingreso por Servicio', 'Venta de Producto']);
        expect(incomeLegend.map(i => i.querySelector('.legend-percent').textContent)).toEqual(['75%', '25%']);
        expect($$(element, '.bar-row--expense .segment')).toHaveLength(2);
        expect($$(element, '.bar-row--expense .segment')[0].style.flexGrow).toBe('80000');
    });

    it('al pasar el mouse por una categoría muestra su detalle', async () => {
        const element = await render({ income: 400000, expenses: 100000, categories: CATEGORIES });

        $$(element, '.bar-row--expense .segment')[0].dispatchEvent(new CustomEvent('mouseenter'));
        await flushPromises();

        expect(text($(element, '.detail'))).toBe('Insumos · $ 80.000,00 · 80% de los gastos');
        expect($$(element, '.bar-row--income .segment')[0].className).toContain('segment--dimmed');
    });

    it('resume la ganancia del mes', async () => {
        const element = await render({ income: 400000, expenses: 100000, categories: CATEGORIES });
        expect(text($(element, '.insight--positive'))).toBe('Quedó una ganancia de $ 300.000,00: el 75% de lo que ingresó.');
    });

    it('avisa cuando los gastos superan a los ingresos', async () => {
        const element = await render({ income: 50000, expenses: 80000, categories: [] });

        expect(text($(element, '.insight--negative'))).toBe('Los gastos superaron a los ingresos por $ 30.000,00.');
        expect($$(element, '.bar-empty')).toHaveLength(2);
    });

    it('sin movimientos muestra un mensaje en lugar del gráfico', async () => {
        const element = await render({ income: 0, expenses: 0, categories: [] });

        expect($(element, '.bars')).toBeNull();
        expect($(element, '.ab-empty').textContent).toBe('No hay movimientos registrados en este mes.');
    });
});
