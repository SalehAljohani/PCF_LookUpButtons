# **PCF Lookup Buttons**

Transform Dynamics 365 lookup fields into interactive, visually appealing buttons for improved usability and streamlined business processes.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Setup and Usage](#setup-and-usage)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Customization](#customization)
- [Validation Script](#validation-script)
- [Contact](#contact)

## **Overview**

This PowerApps Component Framework (PCF) component replaces traditional lookup fields with **responsive buttons** that:
- Dynamically update their state based on user actions.
- Trigger workflows and form validation.
- Provide clear user feedback through alerts and confirmation modals.

Designed with flexibility, this version is tailored to specific business needs but can be customized for broader applications.

## **Features**

- **Interactive Buttons**: Lookup options are displayed as clickable buttons for quick selection.
- **Form Integration**: Buttons trigger workflows and validation processes directly from the form.
- **Modern UI Styling**: Clean and responsive layout built with a **custom Bootstrap version** to ensure consistent styling without affecting other application elements.
- **Dynamic Data Retrieval**: Uses WebAPI to fetch lookup options in real-time based on context.

## **Setup and Usage**

### **Prerequisites**
- Dynamics 365 environment with PowerApps Component Framework enabled.
- Admin access to deploy and test the solution.

### **Installation**
1. Download the **latest release** from the [Releases page](https://github.com/SalehAljohani/PCF_LookUpButtons/releases).
2. Extract the downloaded ZIP file.
3. For **on-premises environments**, the solution is ready to use as-is.  
   For **cloud environments**:
   - Extract the downloaded ZIP file.
   - Open the `Solution.xml` file located in the extracted folder.
   - Locate the `generatedBy="OnPremise"` attribute.
   - Replace `OnPremise` with `CrmLive` to enable compatibility with the cloud version.
   - Save the changes and re-zip the folder.
4. Import the solution into your Dynamics 365 environment.

### **Configuration**
- Bind the following fields in the component editor:
  - **`lookupField`**: The lookup field to display as buttons (required).
  - **`status`**: Lookup field for the status filter (optional).
  - **`caseId`**: Case ID for specific workflows (required).
  - **`triggerValidation`**: A bound field for triggering validation.
  - **`validationResult`**: An input field for validation results.

## **How It Works**
1. The component fetches lookup options dynamically based on the current form's context.
2. Options are displayed as buttons with tooltips and responsive styling.
3. Clicking a button can:
   - Trigger workflows (optional, if configured).
   - Update lookup field values, which can fire an **onChange event** for additional custom logic or validations.
   - Validate the form or require additional input.

## **Customization**

This component can be customized to:
- Support different entities and fields.
- Include additional validations or business logic.
- Adjust button styles and layouts to match specific themes.


## **Validation Script**

The following JavaScript is used for dynamic form validation when interacting with the buttons. This script is triggered when the `ntw_triggervalidation` field changes and checks whether the form meets the required validation criteria before allowing it to be saved.

### **Script Explanation**
- **Purpose**: 
  - Ensures that any changes made through the lookup buttons are validated before saving the form.
  - Provides immediate feedback on whether the form data meets the defined business rules.
- **Key Fields**:
  - `ntw_triggervalidation`: A custom field bound to trigger validation. When its value changes, the script executes the validation logic.
  - `ntw_validationresult`: A field where the result of the validation (true/false) is stored.
- **Validation Logic**:
  - When the `ntw_triggervalidation` field is updated, the script:
    1. Resets the `ntw_triggervalidation` field to `null`.
    2. Sets the `ntw_validationresult` field to `false` as a default value.
    3. Attempts to save the form using `formContext.data.save()` with the `preventDefault` option.
    4. Based on the success or failure of the save operation:
       - Sets `ntw_validationresult` to `true` if validation passes.
       - Leaves `ntw_validationresult` as `false` if validation fails, and Dynamics 365 displays the validation errors.

### **How to Use the Script**

1. **Bind the Script to the Field**:
   - Add this script to your form using Dynamics 365's **JavaScript web resource**.
   - In the form editor, bind the `onTriggerValidationChanged` function to the **OnChange** event of the `ntw_triggervalidation` field.

2. **Add Required Fields to the Form**:
   - Ensure the following fields are present on the form:
     - `ntw_triggervalidation` (boolean or equivalent toggle field to trigger validation).
     - `ntw_validationresult` (boolean field to store validation result).

3. **Test the Script**:
   - Trigger the validation by programmatically or manually updating the `ntw_triggervalidation` field (e.g., clicking a button that sets it to `true`).
   - Observe the form behavior and ensure the validation logic works as expected.

4. **Customize if Needed**:
   - Modify the validation logic based on specific business rules or workflows.
   - Example: Add custom error messages or logs to provide more detailed feedback.

### **Code**

```javascript
function onTriggerValidationChanged(executionContext) {
    var formContext = executionContext.getFormContext();
    var triggerValidationAttr = formContext.getAttribute("ntw_triggervalidation");
    var validationResultAttr = formContext.getAttribute("ntw_validationresult");

    if (triggerValidationAttr && triggerValidationAttr.getValue()) {
        // Clear the triggerValidation field to reset
        triggerValidationAttr.setValue(null);

        // Reset validationResult to "no" initially
        validationResultAttr.setValue(false);

        // Perform validation by attempting to save with preventDefault
        formContext.data.save({
            saveMode: 1, // Save
            preventDefault: true // Prevent actual save
        }).then(
            function() {
                // Validation passed
                validationResultAttr.setValue(true);
            },
            function(error) {
                // Validation failed
                validationResultAttr.setValue(false);
                // Form will display validation errors automatically
            }
        );
    }
}
```


## **Contact**

For questions or feedback, feel free to reach out at:
- **Email**: [devSaleh45@gmail.com](mailto:devSaleh45@gmail.com)
- **Author**: Saleh Aljohani
