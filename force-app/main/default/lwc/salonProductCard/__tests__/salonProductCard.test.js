import { createElement } from 'lwc';
import SalonProductCard from 'c/salonProductCard';
import getProductImageVersionId from '@salesforce/apex/SalonController.getProductImageVersionId';

jest.mock('@salesforce/apex/SalonController.getProductImageVersionId', () => ({ default: jest.fn() }), { virtual: true });

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
const $ = (element, selector) => element.shadowRoot.querySelector(selector);

async function render() {
    const element = createElement('c-salon-product-card', { is: SalonProductCard });
    element.recordId = 'p01';
    document.body.appendChild(element);
    await flushPromises();
    return element;
}

describe('c-salon-product-card', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('muestra la última imagen del producto', async () => {
        getProductImageVersionId.mockResolvedValue('068000000000001');
        const element = await render();

        expect(getProductImageVersionId).toHaveBeenCalledWith({ productId: 'p01' });
        const img = $(element, '.product-img');
        expect(img.getAttribute('src')).toBe('/sfc/servlet.shepherd/version/download/068000000000001');
        expect(img.getAttribute('alt')).toBe('Imagen del producto');
        expect($(element, '.placeholder')).toBeNull();
    });

    it('muestra "Sin imagen" cuando el producto no tiene foto', async () => {
        getProductImageVersionId.mockResolvedValue(null);
        const element = await render();

        expect($(element, '.product-img')).toBeNull();
        expect($(element, '.placeholder-text').textContent).toBe('Sin imagen');
    });

    it('si falla la carga muestra el marcador en lugar de quedarse cargando', async () => {
        getProductImageVersionId.mockRejectedValue({ body: { message: 'error' } });
        const element = await render();

        expect($(element, 'lightning-spinner')).toBeNull();
        expect($(element, '.placeholder-text').textContent).toBe('Sin imagen');
    });

    it('configura la subida: solo imágenes, una a la vez, vinculada al producto', async () => {
        getProductImageVersionId.mockResolvedValue(null);
        const element = await render();

        const upload = $(element, 'lightning-file-upload');
        expect(upload.accept).toBe('.jpg,.jpeg,.png,.gif,.webp,.bmp');
        expect(upload.recordId).toBe('p01');
        expect(upload.multiple).toBeFalsy(); // one file at a time
        expect(upload.label).toBe('Subir imagen');
    });

    it('al terminar la subida muestra la nueva imagen sin recargar y avisa con un mensaje', async () => {
        getProductImageVersionId.mockResolvedValue(null);
        const element = await render();
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);

        $(element, 'lightning-file-upload').dispatchEvent(new CustomEvent('uploadfinished', {
            detail: { files: [{ name: 'shampoo.png', contentVersionId: '068000000000009' }] }
        }));
        await flushPromises();

        expect($(element, '.product-img').getAttribute('src')).toBe('/sfc/servlet.shepherd/version/download/068000000000009');
        expect(getProductImageVersionId).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail).toEqual(expect.objectContaining({
            title: 'Imagen actualizada',
            message: '"shampoo.png" se subió correctamente.',
            variant: 'success'
        }));
    });
});
