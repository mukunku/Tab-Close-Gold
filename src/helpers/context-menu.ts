export type OnChangeHandler = ((newValue: any) => Promise<void>) | undefined | null;

export interface IOption {
    type: string;
    label: string;
    onChanged: OnChangeHandler;
    renderHtml(): JQuery;
}

export class CheckboxOption implements IOption {
    type: string = "checkbox";
    isChecked: boolean;
    label: string;
    id: string;
    onChanged: OnChangeHandler;

    constructor(label: string, isChecked: boolean = false, onChanged?: OnChangeHandler) {
        this.label = label;
        this.isChecked = isChecked;
        this.id = label.replace(/[^a-zA-Z0-9]/g, '');
        this.onChanged = onChanged;
    }
    
    renderHtml(): JQuery {
        const $html = $(`<input type="checkbox" ${this.isChecked ? 'checked' : ''} id="${this.id}"><label class="checkbox-label" for="${this.id}">${this.label}</label>`);

        if (this.onChanged) {
            $html.on('input', (event) => {
                const checked: any = $(event.target).is(':checked');
                this.onChanged!(checked);
            });
        }

        return $html;
    }

}

export class DropdownOption implements IOption {
    type: string = "dropdown";
    label: string;
    values: string[];
    selectedValue: string;
    id: string;
    onChanged: OnChangeHandler;

    constructor(label: string, values: string[], selectedValue: string, onChanged?: OnChangeHandler) {
        this.label = label;
        this.values = values;
        this.selectedValue = selectedValue;
        this.id = label.replace(/[^a-zA-Z0-9]/g, '');
        this.onChanged = onChanged;
    }

    renderHtml(): JQuery {
        let optionsHtml = this.values.map(value => `<option value="${value}" ${value === this.selectedValue ? 'selected' : ''}>${value}</option>`).join('');
        const $html = $(`<label class="dropdown" for="${this.id}">${this.label}</label><select id="${this.id}">${optionsHtml}</select>`);
        
        if (this.onChanged) {
            $html.on('input', async (event) => {
                const newValue: any = $(event.target).val();
                await this.onChanged!(newValue);
            });
        }

        return $html;
    }
}

export class LinkButton implements IOption {
    type: string = "link-button";
    label: string;
    id: string;
    onChanged: OnChangeHandler;

    constructor(label: string, onChanged: OnChangeHandler) {
        this.label = label;
        this.id = label.replace(/[^a-zA-Z0-9]/g, '');
        this.onChanged = onChanged;
    }

    renderHtml(): JQuery {
        const $html = $(`<p id="${this.id}" class="pointer underline">${this.label}</p>`);
        
        if (this.onChanged) {
            $html.on('click', async (_) => {
                await this.onChanged!(undefined);
            });
        }

        return $html;
    }
}

export class ContextMenu {
    private options: IOption[];

    constructor(options: Partial<IOption>[]) {
        this.options = options.map(option => {
            // Ensure all objects have a 'type' property
            if (!option.type) {
                throw new Error("Option must have a 'type' property");
            }
            return option as IOption;
        });
    }

    render(srcElement: JQuery) {
        // Close any other open context menu's
        $('.context-menu').remove();

        // Create a div element for the modal
        const modal = $('<div>').addClass('context-menu');

        //position it by the src element
        modal.css({
            top: srcElement.offset()?.top || 0,
            left: srcElement.offset()?.left || 0
        });

        // Add each option to the list
        this.options.forEach(option => {
            modal.append($('<div class="option">').add(option.renderHtml()));
        });

        // Append the modal to the body
        $('body').append(modal);

        // Show the modal
        modal.show();

        $(window).on('keyup', (event: any) => {
            if (event.key === "Escape") {
                modal.remove();
            }
        });

        $('body').on('click', (event: any) => {
            if (event.target !== modal[0] && !$.contains(modal[0], event.target)) {
                modal.remove();
            }
        });
    }
}
