const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    moduleNameMapper: {
        // Jest's resolver doesn't understand CSS-only LWC modules imported via @import.
        '^c/salonStyles$': '<rootDir>/force-app/main/default/lwc/salonStyles/salonStyles.css',
        '^lightning/navigation$': '<rootDir>/force-app/test/jest-mocks/lightning/navigation'
    },
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver']
};
