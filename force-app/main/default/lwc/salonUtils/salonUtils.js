export const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const STATUSES = ['Programada', 'Confirmada', 'En Progreso', 'Completada', 'No Asistió', 'Cancelada'];

const STATUS_CLASS_SUFFIX = {
    'Programada': 'programada',
    'Confirmada': 'confirmada',
    'En Progreso': 'enprogreso',
    'Completada': 'completada',
    'No Asistió': 'noasistio',
    'Cancelada': 'cancelada'
};

export function statusClass(status) {
    const suffix = STATUS_CLASS_SUFFIX[status];
    return suffix ? `status-pill status-${suffix}` : 'status-pill';
}

export function formatCurrency(amount) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount == null ? 0 : amount);
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' without a Date object (avoids the UTC-3 off-by-one-day shift). */
export function formatDateOnly(dateOnly) {
    if (!dateOnly) {
        return '';
    }
    const [y, m, d] = dateOnly.split('-');
    return `${d}/${m}/${y}`;
}

export function formatTime(dateTime) {
    return dateTime ? new Date(dateTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
}

/** Short date for lists, e.g. "mié 14/10". */
export function formatShortDate(dateTime) {
    return dateTime
        ? new Date(dateTime).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' })
        : '';
}

export function initials(fullName) {
    if (!fullName) {
        return '?';
    }
    return fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word[0].toUpperCase())
        .join('');
}

export function splitMultiPicklist(value) {
    return value ? value.split(';').map(item => item.trim()).filter(Boolean) : [];
}

export function errorMessage(error, fallback) {
    return error?.body?.message || (Array.isArray(error?.body) ? error.body[0]?.message : null) || error?.message || fallback;
}

// ── Contact links ─────────────────────────────────────────────────────────

export function phoneUrl(phone) {
    const dialable = phone ? phone.replace(/[^\d+]/g, '') : '';
    return dialable ? `tel:${dialable}` : null;
}

/**
 * Builds a wa.me link. Argentine numbers are normalized to the international mobile
 * format WhatsApp expects (54 9 + area code + number, without the trunk "0" or the "15").
 * Numbers that can't be resolved to a full Argentine number (e.g. no area code) get no link.
 */
export function whatsappUrl(phone) {
    if (!phone) {
        return null;
    }
    const trimmed = phone.trim();
    let digits = trimmed.replace(/\D/g, '');
    if (!digits) {
        return null;
    }
    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }
    const isInternational = trimmed.startsWith('+') || trimmed.startsWith('00');
    if (isInternational && !digits.startsWith('54')) {
        return `https://wa.me/${digits}`;
    }
    if (digits.startsWith('54')) {
        digits = digits.slice(2);
        if (digits.startsWith('9')) {
            digits = digits.slice(1);
        }
    }
    if (digits.startsWith('0')) {
        digits = digits.slice(1);
    }
    if (digits.length === 12) {
        // Local mobile format "<area> 15 <number>": drop the 15 that follows the 2-4 digit area code.
        for (const areaLength of [2, 3, 4]) {
            if (digits.substr(areaLength, 2) === '15') {
                digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
                break;
            }
        }
    }
    return digits.length === 10 ? `https://wa.me/549${digits}` : null;
}

/** Accepts "@usuario", "usuario" or a profile URL; returns { url, handle } or null. */
export function instagramProfile(value) {
    if (!value) {
        return null;
    }
    const handle = value
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/^(www\.)?instagram\.com\//i, '')
        .replace(/^@/, '')
        .split(/[/?#]/)[0];
    return /^[A-Za-z0-9._]{1,30}$/.test(handle)
        ? { url: `https://instagram.com/${handle}`, handle: `@${handle}` }
        : null;
}
