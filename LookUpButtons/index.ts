import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class ButtonLookup implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;
    private _isLoading: boolean = false;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this._context = context;
        this._notifyOutputChanged = notifyOutputChanged;
        this._container = document.createElement("div");
        this._container.className = "d-flex flex-wrap gap-2";
        container.appendChild(this._container);
        this.loadLookupData();
    }

    private async loadLookupData(): Promise<void> {
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
            console.log("Status value:", statusValue[0].id);

            const loadingMessage = this.showMessage("Loading...", "info");

            const query = `?$select=${targetedEntity}id,ntw_name,_ntw_nextstatusid_value&$filter=_ntw_statusid_value eq ${statusValue[0].id}`;
            const response = await this._context.webAPI.retrieveMultipleRecords(targetedEntity, query, 40);

            this.removeMessage(loadingMessage);

            if (!response?.entities?.length) {
                this.showMessage("No options available", "info");
                return;
            }

            const entities = response.entities.map(entity => ({
                id: entity[`${targetedEntity}id`] || entity.id,
                name: entity.ntw_name || "Unnamed Record",
                nextStatusId: entity._ntw_nextstatusid_value,
                entityType: targetedEntity
            }));

            this.displayButtons(entities);
        } catch (error) {
            console.error("Technical error:", error);
            this.showMessage("Unable to load options. Please try again later.", "warning");
        } finally {
            this._isLoading = false;
        }
    }

    private showMessage(message: string, type: 'success' | 'info' | 'danger' | 'warning'): HTMLDivElement {
        const messageDiv = document.createElement("div");
        messageDiv.className = `alert alert-${type} w-50 mx-auto text-center`;
        messageDiv.innerText = message;
        this._container.appendChild(messageDiv);
        return messageDiv;
    }

    private removeMessage(element: HTMLElement): void {
        if (element && element.parentNode === this._container) {
            this._container.removeChild(element);
        }
    }

    private displayButtons(entities: { id: string; name: string; nextStatusId: string; entityType: string }[]): void {
        this._container.innerHTML = "";

        if (!entities || entities.length === 0) {
            this.showMessage("No records available", "info");
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
    }

    private onButtonClick(entity: { id: string; name: string; nextStatusId: string; entityType: string; }): void {
        //https://kafdcrm365.netways1.com/api/data/v9.0/ntw_statuses(bf3f3461-cb8e-ef11-aa20-00155d00be1e)?$select=_ntw_workflowid_value test api in-browser
        const query = `?$select=ntw_name,_ntw_workflowid_value`; //retrieve workflow id to activate it later.
        this._context.webAPI.retrieveRecord("ntw_status", entity.nextStatusId, query)
            .then((response) => {

                const nextStatusName = response.ntw_name || "Next Status";
                const workflowId = response._ntw_workflowid_value;
                const caseId = this._context.parameters.caseId.formatted || "";

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

                const closeButton = modal.querySelector(".btn-close");
                const cancelButton = modal.querySelector(".btn-secondary");
                const confirmButton = modal.querySelector(".btn-success");

                closeButton?.addEventListener('click', () => modal.remove());
                cancelButton?.addEventListener('click', () => modal.remove());
                confirmButton?.addEventListener('click', () => {
                    try {
                        // set the lookup field value:
                        const lookupValue: ComponentFramework.LookupValue = {
                            entityType: entity.entityType,
                            id: entity.id,
                            name: entity.name
                        };
                        this._context.parameters.lookupField.raw = [lookupValue];

                        // disable the buttons and show spinner while processing
                        cancelButton?.remove();
                        confirmButton.setAttribute("disabled", "true");
                        confirmButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';

                        // execute the workflow
                        if (workflowId && caseId) {
                            var executeWorkflowRequest = {
                                entity: {
                                    entityType: "workflow",
                                    id: workflowId,
                                },
                                EntityId: caseId,
                            };
                            // hardcoded URL will break the system on Production
                            const baseUrl = window.location.origin;
                            var requestUrl =
                                baseUrl +
                                "/api/data/v9.0/workflows(" +
                                executeWorkflowRequest.entity.id +
                                ")/Microsoft.Dynamics.CRM.ExecuteWorkflow";
                            console.log("Request URL:", requestUrl);
                            var payload = {
                                EntityId: executeWorkflowRequest.EntityId,
                            };
                            var req = new XMLHttpRequest();

                            req.open("POST", requestUrl, true);
                            req.setRequestHeader("Accept", "application/json");
                            req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
                            req.setRequestHeader("OData-MaxVersion", "4.0");
                            req.setRequestHeader("OData-Version", "4.0");

                            req.onreadystatechange = function () {
                                if (req.readyState === 4) {
                                    if (req.status === 200 || req.status === 204) {
                                        console.log("Workflow executed successfully.");
                                    } else {
                                        console.error("Error executing workflow: " + req.responseText);
                                    }
                                }
                            };
                            req.send(JSON.stringify(payload));
                        } else {
                            modal.remove();
                            this.showMessage("Something went wrong, contact system administartor!", "danger");
                        }
                        modal.remove();
                        this.showMessage("Action completed successfully.", "success");

                    } catch (error) {
                        console.error("Error setting lookup value:", error);
                        this.showMessage("Failed to set selection", "danger");
                        modal.remove();
                    }
                });

                document.body.appendChild(modal);
            })
            .catch(error => {
                console.error("Error retrieving next status:", error);
                this.showMessage("Failed to load next status details", "danger");
            });
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        this.loadLookupData();
    }

    public getOutputs(): IOutputs {
        return {
            lookupField: this._context.parameters.lookupField.raw
        };
    }

    public destroy(): void {
        this._container.innerHTML = "";
    }
}
