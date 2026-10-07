// Gráfico de ingresos vs. gastos de un mes, con el desglose por categoría de cada uno.
// Las barras se escalan a la mayor de las dos; cada barra se divide en sus categorías.
import { LightningElement, api } from 'lwc';
import { formatCurrency } from 'c/salonUtils';

const PALETTES = {
    Ingreso: ['#357149', '#5f9a6f', '#8dbf98', '#b5d8bd', '#d6eadb'],
    Gasto:   ['#a8452f', '#c66b52', '#dc957f', '#ebbcab', '#f5ddd3']
};

const TYPE_INFO = {
    Ingreso: { key: 'income',  label: 'Ingresos', ofTotal: 'de los ingresos' },
    Gasto:   { key: 'expense', label: 'Gastos',   ofTotal: 'de los gastos' }
};

export default class SalonBalanceChart extends LightningElement {
    @api income = 0;
    @api expenses = 0;
    @api categories = [];

    hoveredKey = null;

    get hasData() {
        return (this.income || 0) > 0 || (this.expenses || 0) > 0;
    }

    get isEmpty() {
        return !this.hasData;
    }

    get rows() {
        const max = Math.max(this.income || 0, this.expenses || 0);
        return ['Ingreso', 'Gasto'].map(type => {
            const info = TYPE_INFO[type];
            const total = type === 'Ingreso' ? this.income || 0 : this.expenses || 0;
            const palette = PALETTES[type];
            const segments = (this.categories || [])
                .filter(c => c.type === type && c.total > 0)
                .map((c, index) => {
                    const key = `${type}|${c.category}`;
                    const color = palette[Math.min(index, palette.length - 1)];
                    const percent = total ? Math.round((c.total / total) * 100) : 0;
                    return {
                        key,
                        category: c.category,
                        amount: formatCurrency(c.total),
                        percent: `${percent}%`,
                        detail: `${c.category} · ${formatCurrency(c.total)} · ${percent}% ${info.ofTotal}`,
                        segmentStyle: `flex-grow: ${c.total}; background: ${color};`,
                        swatchStyle: `background: ${color};`,
                        segmentClass: `segment${this.hoveredKey && this.hoveredKey !== key ? ' segment--dimmed' : ''}`,
                        legendClass: `legend-item${this.hoveredKey === key ? ' legend-item--active' : ''}`
                    };
                });
            return {
                type,
                className: `bar-row bar-row--${info.key}`,
                label: info.label,
                amount: formatCurrency(total),
                fillStyle: `width: ${max ? Math.max((total / max) * 100, total > 0 ? 2 : 0) : 0}%;`,
                segments,
                hasSegments: segments.length > 0
            };
        });
    }

    get hoveredDetail() {
        if (!this.hoveredKey) {
            return null;
        }
        for (const row of this.rows) {
            const segment = row.segments.find(s => s.key === this.hoveredKey);
            if (segment) {
                return segment.detail;
            }
        }
        return null;
    }

    get insight() {
        const income = this.income || 0;
        const expenses = this.expenses || 0;
        const net = income - expenses;
        if (income === 0) {
            return { text: `Sin ingresos registrados: los gastos suman ${formatCurrency(expenses)}.`, className: 'insight insight--negative' };
        }
        const margin = Math.round((net / income) * 100);
        if (net >= 0) {
            return {
                text: `Quedó una ganancia de ${formatCurrency(net)}: el ${margin}% de lo que ingresó.`,
                className: 'insight insight--positive'
            };
        }
        return {
            text: `Los gastos superaron a los ingresos por ${formatCurrency(-net)}.`,
            className: 'insight insight--negative'
        };
    }

    handleEnter(event) {
        this.hoveredKey = event.currentTarget.dataset.key;
    }

    handleLeave() {
        this.hoveredKey = null;
    }
}
