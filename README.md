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




## **Contact**

For questions or feedback, feel free to reach out at:
- **Email**: [devSaleh45@gmail.com](mailto:devSaleh45@gmail.com)
- **Author**: Saleh Aljohani
