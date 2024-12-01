import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class ButtonLookup implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;
    private _isLoading: boolean = false;
    private _triggerValidation: string = "";
    private _validationResult: boolean = false;
    private clickState: { [key: string]: boolean } = {};
    private selectedEntity: { id: string; name: string; nextStatusId: string; isReasonFieldRequired: boolean; entityType: string } | null = null;
    private pendingMessage: HTMLDivElement | null = null;

    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
        this._context = context;
        this._notifyOutputChanged = notifyOutputChanged;
        this._container = document.createElement("div");
        this._container.className = "d-flex flex-wrap gap-2";
        container.appendChild(this._container);
        this.loadLookupData();
    }

    private async loadLookupData(): Promise<void> {
        const loadingMessage = this.showMessage("Loading...", "info");
        try {
            if (this._isLoading) return;
            this._isLoading = true;

            const targetedEntity = this._context.parameters.lookupField.getTargetEntityType();
            if (!targetedEntity) {
                throw new Error("Target entity type not found");
            }

            // Use status property from PCF context
            const statusValue = this._context.parameters.status.raw;
            if (!statusValue || !statusValue[0]) {
                throw new Error("Status value not found");
            }

            const query = `?$select=${targetedEntity}id,ntw_name,_ntw_nextstatusid_value,ntw_isreasonfieldrequired&$filter=_ntw_statusid_value eq ${statusValue[0].id}`;
            const response = await this._context.webAPI.retrieveMultipleRecords(targetedEntity, query, 40);

            this.removeMessage(loadingMessage);

            if (!response?.entities?.length) {
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

            this.displayButtons(entities);
        } catch (error) {
            console.error("Technical error:", error);
            this.removeMessage(loadingMessage);
            this.showMessage("Unable to load options. Please try again later.", "warning", false);
        } finally {
            this._isLoading = false;
        }
    }

    private showMessage(message: string, type: 'success' | 'info' | 'danger' | 'warning', autoRemove: boolean = true, duration: number = 5000): HTMLDivElement {
        const existingMessage = this._container.querySelector(`.alert.alert-${type}`);
        if (existingMessage) {
            this.removeMessage(existingMessage as HTMLElement);
        }

        const messageDiv = document.createElement("div");
        messageDiv.className = `alert alert-${type} w-100 mx-auto text-center`;
        messageDiv.innerText = message;
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
            if (this.pendingMessage === element) {
                this.pendingMessage = null;
            }
        }
    }

    private displayButtons(entities: { id: string; name: string; nextStatusId: string; isReasonFieldRequired: boolean; entityType: string }[]): void {
        const existingMessage = this.pendingMessage;

        this._container.innerHTML = "";

        if (!entities || entities.length === 0) {
            this.showMessage("No records available", "info", false);
            return;
        }

        entities.forEach((entity) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-outline-success m-1";
            button.innerText = entity.name;
            button.onclick = () => this.onButtonClick(entity);
            this._container.appendChild(button);
        });

        if (existingMessage) {
            this._container.appendChild(existingMessage);
        }
    }

    private createConfirmationModal(entity: { id: string; name: string; nextStatusId: string; entityType: string }, nextStatusName: string): HTMLDivElement {
        const modal = document.createElement("div");
        modal.className = "modal fade show";
        modal.style.display = "block";
        modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";

        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><strong>Confirm Action</strong></h5>
                        <button type="button" class="btn-close" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to select <span class="fw-bold text-uppercase">${entity.name}</span>?</p>
                        <p>This will move the status to: <span class="fw-bold text-primary">${nextStatusName}</span></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary">Cancel</button>
                        <button type="button" class="btn btn-success">Confirm</button>
                    </div>
                </div>
            </div>
        `;

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
                    if (req.status === 200 || req.status === 204) {
                        console.log("Workflow executed successfully.");
                        resolve();
                    } else {
                        console.error("Error executing workflow: " + req.responseText);
                        reject(new Error("Workflow execution failed"));
                    }
                }
            };

            req.send(JSON.stringify(payload));
        });
    }

    private async onButtonClick(entity: { id: string; name: string; nextStatusId: string; isReasonFieldRequired: boolean; entityType: string; }): Promise<void> {
        try {
            const query = `?$select=ntw_name,_ntw_workflowid_value`;
            const response = await this._context.webAPI.retrieveRecord("ntw_status", entity.nextStatusId, query);

            const nextStatusName = response.ntw_name || "Next Status";
            const workflowId = response._ntw_workflowid_value;
            const primaryId = this._context.parameters.primaryId.formatted || "";
            const actionKey = entity.id;

            // Case 1: If there are no fields associated with the action
            if (!entity.isReasonFieldRequired) {
                // Directly process the action
                const lookupValue = this.createLookupValue(entity);
                this._context.parameters.lookupField.raw = [lookupValue];
                this._triggerValidation = new Date().toISOString(); // Set a unique trigger for validation
                this._notifyOutputChanged();
                this.selectedEntity = entity;
                return; // Skip further logic
            }

            // Case 2: If the action has fields associated with it
            if (!this.clickState[actionKey]) {
                this.pendingMessage = this.showMessage("Please fill in the required fields and click the action button again to proceed.", "info", false);
                const lookupValue = this.createLookupValue(entity);
                this._context.parameters.lookupField.raw = [lookupValue];
                this._notifyOutputChanged();
                this.clickState[actionKey] = true;
                this.selectedEntity = entity;
            } else {
                if (this.pendingMessage) this.removeMessage(this.pendingMessage);
                this._triggerValidation = new Date().toISOString();
                this._notifyOutputChanged();
            }
        } catch (error) {
            console.error("Error retrieving next status:", error);
            this.showMessage("Failed to load next status details", "danger", false);
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

            const closeModal = () => modal.remove();

            closeButton?.addEventListener('click', closeModal);
            cancelButton?.addEventListener('click', closeModal);

            confirmButton?.addEventListener('click', async () => {
                try {
                    cancelButton?.remove();
                    confirmButton.setAttribute("disabled", "true");
                    confirmButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';

                    if (workflowId && primaryId) {
                        await this.executeWorkflow(workflowId, primaryId);
                    } else {
                        throw new Error("Workflow ID or Case ID is missing");
                    }

                    closeModal();
                    this.showMessage("Action completed successfully.", "success");
                    this.clickState[entity.id] = false;
                    this.selectedEntity = null;
                    setTimeout(() => {
                        location.reload();
                    }, 6000);

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
        if (context.updatedProperties.includes("lookupField")) {
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
            triggerValidation: this._triggerValidation
        };
    }

    public destroy(): void {
        this._container.innerHTML = "";
    }
}