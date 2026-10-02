import { whatsappUrl, phoneUrl, instagramProfile, statusClass, formatDateOnly, initials, splitMultiPicklist, formatCurrency } from 'c/salonUtils';

describe('salonUtils', () => {
    it('normaliza teléfonos argentinos para WhatsApp', () => {
        expect(whatsappUrl('11 2345-6789')).toBe('https://wa.me/5491123456789');
        expect(whatsappUrl('011 15 2345-6789')).toBe('https://wa.me/5491123456789');
        expect(whatsappUrl('+54 9 11 2345 6789')).toBe('https://wa.me/5491123456789');
        expect(whatsappUrl('+54 11 2345 6789')).toBe('https://wa.me/5491123456789');
        expect(whatsappUrl('0351 15 412-3456')).toBe('https://wa.me/5493514123456');
        expect(whatsappUrl('+598 99 123 456')).toBe('https://wa.me/59899123456');
    });

    it('no arma un link de WhatsApp si el número está incompleto', () => {
        expect(whatsappUrl('4567-8901')).toBeNull();
        expect(whatsappUrl('')).toBeNull();
        expect(whatsappUrl(null)).toBeNull();
    });

    it('arma links de llamada marcables', () => {
        expect(phoneUrl('011 15 2345-6789')).toBe('tel:011152345678' + '9');
        expect(phoneUrl('+54 9 11 2345 6789')).toBe('tel:+5491123456789');
        expect(phoneUrl(null)).toBeNull();
    });

    it('interpreta usuarios y links de Instagram', () => {
        expect(instagramProfile('@ejemplo.ab.test')).toEqual({ url: 'https://instagram.com/ejemplo.ab.test', handle: '@ejemplo.ab.test' });
        expect(instagramProfile('https://www.instagram.com/ejemplo_ab_test/?hl=es').handle).toBe('@ejemplo_ab_test');
        expect(instagramProfile('instagram.com/ejemplo.ab.prueba')).toEqual({ url: 'https://instagram.com/ejemplo.ab.prueba', handle: '@ejemplo.ab.prueba' });
        expect(instagramProfile('no es un usuario!')).toBeNull();
    });

    it('formatea fechas, iniciales, servicios, montos y estados', () => {
        expect(formatDateOnly('2026-07-01')).toBe('01/07/2026');
        expect(initials('valentina ejemplo prueba')).toBe('VE');
        expect(splitMultiPicklist('Corte de Cabello;Coloración')).toEqual(['Corte de Cabello', 'Coloración']);
        expect(formatCurrency(1234.5).replace(/\s/g, ' ')).toBe('$ 1.234,50');
        expect(statusClass('No Asistió')).toBe('status-pill status-noasistio');
        expect(statusClass('Otro')).toBe('status-pill');
    });
});
