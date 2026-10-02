// Jest mock for lightning/navigation that records the last navigation request.
import { createTestWireAdapter } from '@salesforce/wire-service-jest-util';

export const CurrentPageReference = createTestWireAdapter(jest.fn());

let navigateCalledWith;
export const getNavigateCalledWith = () => navigateCalledWith;

const Navigate = Symbol('Navigate');
const GenerateUrl = Symbol('GenerateUrl');
export const NavigationMixin = Base => {
    return class extends Base {
        [Navigate](pageReference, replace) {
            navigateCalledWith = pageReference;
            this.navigateReplace = replace;
        }
        [GenerateUrl]() {
            return Promise.resolve('https://www.example.com');
        }
    };
};
NavigationMixin.Navigate = Navigate;
NavigationMixin.GenerateUrl = GenerateUrl;
