import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class ButtonLookup implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _mainContainer: HTMLDivElement;
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;
    private _isLoading: boolean = false;
    private _triggerValidation: string = "";
    private _validationResult: boolean = false;
    private clickState: { [key: string]: boolean } = {};
    private selectedEntity: { id: string; name: string; nextStatusId: string; isReasonFieldRequired: boolean; entityType: string } | null = null;
    private pendingMessage: HTMLDivElement | null = null;

    // Enhanced initialization tracking
    private _initializationComplete: boolean = false;
    private _initializationAttempts: number = 0;
    private readonly MAX_INIT_ATTEMPTS: number = 3;
    private _currentLoadingMessage: HTMLDivElement | null = null;

    /**
     * Initialize the control instance
     * @param context The entire property bag available to control via Context Object
     * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously
     * @param state A piece of data that persists in one session for a single user
     * @param container The HTML Element container to render the control
     */
    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
        this._context = context;
        this._notifyOutputChanged = notifyOutputChanged;
        
        container.innerHTML = "";

        // Create main container with card styling
        this._mainContainer = document.createElement("div");
        this._mainContainer.className = "card";

        // Create header
        const headerDiv = document.createElement("div");
        headerDiv.className = "card-header";

        const headerText = document.createElement("h3");
        headerText.className = "my-auto fw-bolder text-center";
        headerText.textContent = "ACTIONS";
        headerDiv.appendChild(headerText);

        // Create button container
        this._container = document.createElement("div");
        this._container.className = "card-body bg-body-tertiary d-flex flex-wrap gap-3 justify-content-center rounded-bottom";

        // Build DOM hierarchy
        this._mainContainer.appendChild(headerDiv);
        this._mainContainer.appendChild(this._container);
        container.appendChild(this._mainContainer);
        container.style.padding = "0";
        container.style.width = "100%";

        // Initialize component
        this.setInitializationComplete(false);
        this.loadLookupData();
    }

    private setInitializationComplete(complete: boolean): void {
        this._initializationComplete = complete;
        if (complete) {
            this._initializationAttempts = 0;
        }
    }

    private shouldAttemptInitialization(): boolean {
        return !this._initializationComplete && this._initializationAttempts < this.MAX_INIT_ATTEMPTS;
    }

    private showMessage(message: string, type: 'success' | 'info' | 'danger' | 'warning', autoRemove: boolean = true, duration: number = 5000): HTMLDivElement {
        // Remove existing message of the same type
        const existingMessage = this._container.querySelector(`.alert.alert-${type}`);
        if (existingMessage) {
            this.removeMessage(existingMessage as HTMLElement);
        }

        const messageDiv = document.createElement("div");
        messageDiv.className = `alert alert-${type} w-100 text-center mt-3`;

        const messageText = document.createElement("span");
        messageText.textContent = message;
        messageDiv.appendChild(messageText);

        this._container.appendChild(messageDiv);

        if (autoRemove) {
            setTimeout(() => {
                this.removeMessage(messageDiv);
            }, duration);
        }

        return messageDiv;
    }

    private removeMessage(element: HTMLElement): void {
        if (element && element.parentNode === this._container) {
            this._container.removeChild(element);
        }
    }

    private async loadLookupData(): Promise<void> {
        try {
            if (this._isLoading) return;
            this._isLoading = true;

            // Show or update loading message
            if (!this._currentLoadingMessage) {
                this._currentLoadingMessage = this.showMessage("Loading...", "info", false);
            }

            // Increment attempt counter
            this._initializationAttempts++;

            // Check context and parameters
            if (!this._context || !this._context.parameters) {
                if (this.shouldAttemptInitialization()) {
                    this._isLoading = false;
                    return;
                }
                throw new Error("Context not properly initialized");
            }

            const targetedEntity = this._context.parameters.lookupField.getTargetEntityType();
            if (!targetedEntity) {
                if (this.shouldAttemptInitialization()) {
                    this._isLoading = false;
                    return;
                }
                console.warn("Target entity type not found");
                this.showMessage("No options available", "info", false);
                return;
            }

            const statusValue = this._context.parameters.status.raw;
            if (!statusValue || !statusValue[0]) {
                if (this.shouldAttemptInitialization()) {
                    this._isLoading = false;
                    return;
                }
                console.warn("Status value not found in parameters");
                this.showMessage("No actions available for the current status", "info", false);
                return;
            }

            try {
                const query = `?$select=${targetedEntity}id,ntw_name,_ntw_nextstatusid_value,ntw_isreasonfieldrequired&$filter=_ntw_statusid_value eq ${statusValue[0].id}`;
                const response = await this._context.webAPI.retrieveMultipleRecords(targetedEntity, query, 40);

                // Clear loading message
                if (this._currentLoadingMessage) {
                    this.removeMessage(this._currentLoadingMessage);
                    this._currentLoadingMessage = null;
                }

                if (!response) {
                    this.showMessage("No response received from the server", "warning", false);
                    return;
                }

                if (!response.entities || response.entities.length === 0) {
                    this.showMessage("No options available", "info", false);
                    return;
                }

                const entities = response.entities.map(entity => ({
                    id: entity[`${targetedEntity}id`] || entity.id,
                    name: entity.ntw_name || "Unnamed Record",
                    nextStatusId: entity._ntw_nextstatusid_value,
                    isReasonFieldRequired: entity.ntw_isreasonfieldrequired,
                    entityType: targetedEntity
                }));

                this.setInitializationComplete(true);
                this.displayButtons(entities);

            } catch (queryError) {
                console.error("Error in query execution:", queryError);
                throw new Error("Failed to retrieve status options");
            }

        } catch (error) {
            this.setInitializationComplete(true);
            if (this._currentLoadingMessage) {
                this.removeMessage(this._currentLoadingMessage);
                this._currentLoadingMessage = null;
            }
            console.error("Error in loadLookupData:", error);
            this.showMessage("Unable to load options. Please try again later.", "warning", false);
        } finally {
            this._isLoading = false;
        }
    }

    private displayButtons(entities: { id: string; name: string; nextStatusId: string; isReasonFieldRequired: boolean; entityType: string }[]): void {
        // Clear existing content
        this._container.innerHTML = "";

        if (!entities || entities.length === 0) {
            this.showMessage("No records available", "info", false);
            return;
        }

        entities.forEach((entity) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-success m-1";
            button.style.flex = "1";
            button.style.margin = "0.5rem";
            button.innerText = entity.name;
            button.onclick = () => this.onButtonClick(entity);
            this._container.appendChild(button);
        });

        if (this.pendingMessage) {
            this._container.appendChild(this.pendingMessage);
        }
    }

    private createConfirmationModal(entity: { id: string; name: string; nextStatusId: string; entityType: string }, nextStatusName: string): HTMLDivElement {
        const modal = document.createElement("div");
        modal.className = "modal fade show";
        modal.style.display = "block";
        modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";

        const modalDialog = document.createElement("div");
        modalDialog.className = "modal-dialog";

        const modalContent = document.createElement("div");
        modalContent.className = "modal-content";

        // Header
        const modalHeader = document.createElement("div");
        modalHeader.className = "modal-header";

        const modalTitle = document.createElement("h5");
        modalTitle.className = "modal-title";
        const titleStrong = document.createElement("strong");
        titleStrong.textContent = "Confirm Action";
        modalTitle.appendChild(titleStrong);

        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "btn-close";
        closeButton.setAttribute("aria-label", "Close");

        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        // Body
        const modalBody = document.createElement("div");
        modalBody.className = "modal-body";

        const actionText = document.createElement("p");
        const actionName = document.createElement("span");
        actionName.className = "fw-bold text-uppercase";
        actionName.textContent = entity.name;
        actionText.textContent = "Are you sure you want to select ";
        actionText.appendChild(actionName);
        actionText.appendChild(document.createTextNode("?"));

        const statusText = document.createElement("p");
        const statusName = document.createElement("span");
        statusName.className = "fw-bold text-primary";
        statusName.textContent = nextStatusName;
        statusText.textContent = "This will move the status to: ";
        statusText.appendChild(statusName);

        modalBody.appendChild(actionText);
        modalBody.appendChild(statusText);

        // Footer
        const modalFooter = document.createElement("div");
        modalFooter.className = "modal-footer";

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "btn btn-secondary";
        cancelButton.textContent = "Cancel";

        const confirmButton = document.createElement("button");
        confirmButton.type = "button";
        confirmButton.className = "btn btn-success";
        confirmButton.textContent = "Confirm";

        modalFooter.appendChild(cancelButton);
        modalFooter.appendChild(confirmButton);

        // Assemble modal
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        modalDialog.appendChild(modalContent);
        modal.appendChild(modalDialog);

        return modal;
    }

    private createLookupValue(entity: { id: string; name: string; entityType: string }): ComponentFramework.LookupValue {
        return {
            entityType: entity.entityType,
            id: entity.id,
            name: entity.name,
        };
    }

    private executeWorkflow(workflowId: string, primaryId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const baseUrl = window.location.origin;
            const requestUrl = `${baseUrl}/api/data/v9.0/workflows(${workflowId})/Microsoft.Dynamics.CRM.ExecuteWorkflow`;

            const payload = { EntityId: primaryId };

            const req = new XMLHttpRequest();
            req.open("POST", requestUrl, true);
            req.setRequestHeader("Accept", "application/json");
            req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
            req.setRequestHeader("OData-MaxVersion", "4.0");
            req.setRequestHeader("OData-Version", "4.0");

            req.onreadystatechange = () => {
                if (req.readyState === 4) {
                    req.status === 200 || req.status === 204 ? resolve() : reject(new Error("Workflow execution failed"));
                }
            };

            req.send(JSON.stringify(payload));
        });
    }

    private async onButtonClick(entity: { id: string; name: string; nextStatusId: string; isReasonFieldRequired: boolean; entityType: string }): Promise<void> {
        try {
            const actionKey = entity.id;

            if (!entity.isReasonFieldRequired) {
                const lookupValue = this.createLookupValue(entity);
                this._context.parameters.lookupField.raw = [lookupValue];
                this._triggerValidation = new Date().toISOString();
                this._notifyOutputChanged();
                this.selectedEntity = entity;
                return;
            }

            if (!this.clickState[actionKey]) {
                this.pendingMessage = this.showMessage("Please fill in the required fields and click the action button again to proceed.", "info", false);
                const lookupValue = this.createLookupValue(entity);
                this._context.parameters.lookupField.raw = [lookupValue];
                this._context.parameters.validationResult.raw = false;
                this._notifyOutputChanged();
                this.clickState[actionKey] = true;
                this.selectedEntity = entity;
            } else {
                if (this.pendingMessage) {
                    this.removeMessage(this.pendingMessage);
                }
                this._triggerValidation = new Date().toISOString();
                this._notifyOutputChanged();
            }
        } catch (error) {
            console.error("Error in button click handler:", error);
            this.showMessage("Failed to process action", "danger", false);
        }
    }

    private async proceedAfterValidation(): Promise<void> {
        try {
            if (!this.selectedEntity) {
                this.showMessage("No action selected.", "warning", false);
                return;
            }

            const entity = this.selectedEntity;
            const query = `?$select=ntw_name,_ntw_workflowid_value`;
            const response = await this._context.webAPI.retrieveRecord("ntw_status", entity.nextStatusId, query);

            const nextStatusName = response.ntw_name || "Next Status";
            const workflowId = response._ntw_workflowid_value;
            const primaryId = this._context.parameters.primaryId.formatted || "";

            const modal = this.createConfirmationModal(entity, nextStatusName);
            const closeButton = modal.querySelector(".btn-close");
            const cancelButton = modal.querySelector(".btn-secondary");
            const confirmButton = modal.querySelector(".btn-success");

            const closeModal = () => {
                modal.remove();
                this.clickState[entity.id] = false;
                this.selectedEntity = null;
                this._validationResult = false;
                this._triggerValidation = "";
                this._notifyOutputChanged();
            };

            closeButton?.addEventListener('click', closeModal);
            cancelButton?.addEventListener('click', closeModal);

            confirmButton?.addEventListener('click', async () => {
                try {
                    cancelButton?.remove();
                    confirmButton.setAttribute("disabled", "true");

                    const spinner = document.createElement("span");
                    spinner.className = "spinner-border spinner-border-sm";
                    spinner.setAttribute("role", "status");
                    spinner.setAttribute("aria-hidden", "true");

                    confirmButton.innerHTML = "";
                    confirmButton.appendChild(spinner);
                    confirmButton.appendChild(document.createTextNode(" Processing..."));

                    if (workflowId && primaryId) {
                        await this.executeWorkflow(workflowId, primaryId);
                    } else {
                        throw new Error("Workflow ID or Case ID is missing");
                    }

                    closeModal();
                    this.showMessage("Action completed successfully.", "success");
                    this.clickState[entity.id] = false;
                    this.selectedEntity = null;
                    location.reload();

                } catch (error) {
                    console.error("Error processing action:", error);
                    this.showMessage("Failed to complete action", "danger", false);
                    closeModal();
                }
            });

            document.body.appendChild(modal);

        } catch (error) {
            console.error("Error after validation:", error);
            this.showMessage("An error occurred after validation.", "danger", false);
        }
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;

        // Handle initialization retries
        if (!this._initializationComplete && !this._isLoading) {
            this.loadLookupData();
            return;
        }

        // Handle normal updates
        if (context.updatedProperties.includes("lookupField")) {
            this.setInitializationComplete(false);
            this.loadLookupData();
        }

        if (context.updatedProperties.includes("validationResult")) {
            this._validationResult = context.parameters.validationResult.raw || false;
            if (this._validationResult) {
                this.proceedAfterValidation();
            }
        }
    }

    public getOutputs(): IOutputs {
        return {
            lookupField: this._context.parameters.lookupField.raw,
            triggerValidation: this._triggerValidation,
            validationResult: this._validationResult
        };
    }

    public destroy(): void {
        if (this._currentLoadingMessage) {
            this.removeMessage(this._currentLoadingMessage);
            this._currentLoadingMessage = null;
        }
        
        if (this._container) {
            while (this._container.firstChild) {
                this._container.removeChild(this._container.firstChild);
            }
        }
        
        if (this._mainContainer) {
            while (this._mainContainer.firstChild) {
                this._mainContainer.removeChild(this._mainContainer.firstChild);
            }
        }
    }
}