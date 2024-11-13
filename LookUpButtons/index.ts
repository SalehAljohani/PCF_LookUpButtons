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
        this._container.className = "bootstrap-scope d-flex flex-wrap gap-2";
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

            const query = `?$select=${targetedEntity}id,ntw_name&$filter=_ntw_statusid_value eq ${statusValue[0].id}`;
            const response = await this._context.webAPI.retrieveMultipleRecords(targetedEntity, query, 40);

            this.removeMessage(loadingMessage);

            if (!response?.entities?.length) {
                this.showMessage("No options available", "info");
                return;
            }

            const entities = response.entities.map(entity => ({
                id: entity[`${targetedEntity}id`] || entity.id,
                name: entity.ntw_name || "Unnamed Record",
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

    private showMessage(message: string, type: 'info' | 'danger' | 'warning'): HTMLDivElement {
        const messageDiv = document.createElement("div");
        messageDiv.className = `alert alert-${type} w-100`;
        messageDiv.innerText = message;
        this._container.appendChild(messageDiv);
        return messageDiv;
    }

    private removeMessage(element: HTMLElement): void {
        if (element && element.parentNode === this._container) {
            this._container.removeChild(element);
        }
    }

    private displayButtons(entities: { id: string; name: string; entityType: string }[]): void {
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

    private onButtonClick(entity: { id: string; name: string; entityType: string }): void {
        const modal = document.createElement("div");
        modal.className = "modal fade show";
        modal.style.display = "block";
        modal.style.position = "fixed";
        modal.style.top = "0";
        modal.style.left = "0";
        modal.style.width = "100%";
        modal.style.height = "100%";
        modal.style.backgroundColor = "rgba(0,0,0,0.5)";
        modal.style.zIndex = "1050";

        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Confirm Action</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to select <span class="text-uppercase fw-bold">"${entity.name}"</span>?</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-success">Confirm</button>
                    </div>
                </div>
            </div>
        `;

        const closeButton = modal.querySelector('[data-bs-dismiss="modal"]');
        const confirmButton = modal.querySelector('.btn-success');
        const cancelButton = modal.querySelector('.btn-secondary');

        closeButton?.addEventListener('click', () => modal.remove());
        cancelButton?.addEventListener('click', () => modal.remove());
        confirmButton?.addEventListener('click', () => {
            try {
                const lookupValue: ComponentFramework.LookupValue = {
                    entityType: entity.entityType,
                    id: entity.id,
                    name: entity.name
                };
                this._context.parameters.lookupField.raw = [lookupValue];
                this._notifyOutputChanged();
                modal.remove();
            } catch (error) {
                console.error("Error setting lookup value:", error);
                this.showMessage("Failed to set selection", "danger");
                modal.remove();
            }
        });

        document.body.appendChild(modal);
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
