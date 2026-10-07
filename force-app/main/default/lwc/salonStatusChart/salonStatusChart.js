// Gráfico de anillo con la cantidad de citas por estado, con los mismos colores que las
// etiquetas de estado. Refleja los filtros del Historial; la leyenda también sirve de filtro.
import { LightningElement, api } from 'lwc';
import { STATUSES, statusClass } from 'c/salonUtils';

// Circunferencia 100 (r = 100 / 2π): cada porcentaje es directamente el largo del trazo.
const RADIUS = 15.9155;
const SLICE_GAP = 0.6;

export default class SalonStatusChart extends LightningElement {
    @api counts = {};
    @api selectedStatuses = [];

    hoveredStatus = null;
    radius = RADIUS;

    get total() {
        return STATUSES.reduce((sum, status) => sum + (this.counts?.[status] || 0), 0);
    }

    get hasData() {
        return this.total > 0;
    }

    get isEmpty() {
        return !this.hasData;
    }

    get slices() {
        const total = this.total;
        const visible = STATUSES.filter(status => (this.counts?.[status] || 0) > 0);
        const gap = visible.length > 1 ? SLICE_GAP : 0;
        let offset = 0;
        return visible.map(status => {
            const pct = (this.counts[status] / total) * 100;
            const length = Math.max(pct - gap, 0.4);
            // El trazo empieza a las 3 en punto: el desplazamiento de 25 lo lleva a las 12.
            const slice = {
                status,
                className: `slice slice--${this.suffix(status)}${this.hoveredStatus === status ? ' slice--active' : ''}${this.hoveredStatus && this.hoveredStatus !== status ? ' slice--dimmed' : ''}`,
                dashArray: `${length.toFixed(2)} ${(100 - length).toFixed(2)}`,
                dashOffset: (25 - offset).toFixed(2)
            };
            offset += pct;
            return slice;
        });
    }

    get legend() {
        const total = this.total;
        const selected = this.selectedStatuses || [];
        return STATUSES.map(status => {
            const count = this.counts?.[status] || 0;
            const isSelected = selected.includes(status);
            return {
                status,
                count,
                percent: total ? `${Math.round((count / total) * 100)}%` : '0%',
                swatchClass: `swatch slice--${this.suffix(status)}`,
                className: `legend-item${count === 0 ? ' legend-item--empty' : ''}${isSelected ? ' legend-item--selected' : ''}${this.hoveredStatus === status ? ' legend-item--active' : ''}`,
                ariaPressed: String(isSelected),
                title: isSelected ? `Quitar el filtro "${status}"` : `Filtrar por "${status}"`
            };
        });
    }

    get centerValue() {
        return this.hoveredStatus ? this.counts?.[this.hoveredStatus] || 0 : this.total;
    }

    get centerLabel() {
        if (this.hoveredStatus) {
            return this.hoveredStatus;
        }
        return this.total === 1 ? 'cita' : 'citas';
    }

    get centerPercent() {
        if (!this.hoveredStatus || !this.total) {
            return '';
        }
        return `${Math.round(((this.counts?.[this.hoveredStatus] || 0) / this.total) * 100)}%`;
    }

    suffix(status) {
        return statusClass(status).replace('status-pill status-', '');
    }

    handleEnter(event) {
        const status = event.currentTarget.dataset.status;
        if ((this.counts?.[status] || 0) > 0) {
            this.hoveredStatus = status;
        }
    }

    handleLeave() {
        this.hoveredStatus = null;
    }

    handleLegendClick(event) {
        this.dispatchEvent(new CustomEvent('statustoggle', { detail: { status: event.currentTarget.dataset.status } }));
    }
}
