// Displays and manages the product image on a Salon_Product__c record page.
// The image is stored as a Salesforce File (ContentVersion) attached to the record.
import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
// Apex method that looks up the most recent image file linked to this product.
import getProductImageVersionId from '@salesforce/apex/SalonController.getProductImageVersionId';

export default class SalonProductCard extends LightningElement {

    @api recordId;          // record page injects the current Salon_Product__c Id
    @track imageUrl  = null; // null means no image exists yet — shows the placeholder
    @track isLoading = true;

    // Restrict the file picker to common image formats only.
    get acceptedFormats() {
        return '.jpg,.jpeg,.png,.gif,.webp,.bmp';
    }

    connectedCallback() {
        this.loadImage();
    }

    // Fetches the ContentVersionId of the latest attached image and builds the download URL.
    loadImage() {
        this.isLoading = true;
        getProductImageVersionId({ productId: this.recordId })
            .then(versionId => {
                // Salesforce serves file content through this servlet URL pattern.
                this.imageUrl = versionId
                    ? `/sfc/servlet.shepherd/version/download/${versionId}`
                    : null; // null triggers the "Sin imagen" placeholder template
                this.isLoading = false;
            })
            .catch(() => {
                this.isLoading = false;
            });
    }

    // Called immediately after lightning-file-upload completes.
    // We get the contentVersionId directly from the event, so no extra Apex call is needed.
    handleUploadFinished(event) {
        const file = event.detail.files[0];
        // Use the version ID returned by the upload event directly —
        // no need for an extra Apex round-trip.
        this.imageUrl = `/sfc/servlet.shepherd/version/download/${file.contentVersionId}`;
        this.dispatchEvent(new ShowToastEvent({
            title: 'Imagen actualizada',
            message: `"${file.name}" se subió correctamente.`,
            variant: 'success'
        }));
    }
}