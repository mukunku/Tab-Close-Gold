export type OnChangeHandler = ((newValue: any) => Promise<void>) | undefined | null;

export interface IOption {
    type: string;
    label: string;
    css: string;
    onChanged: OnChangeHandler;
    renderHtml(): JQuery;
}

export class CheckboxOption implements IOption {
    type: string = "checkbox";
    isChecked: boolean;
    label: string;
    id: string;
    css: string;
    onChanged: OnChangeHandler;

    constructor(label: string, isChecked: boolean = false, onChanged?: OnChangeHandler, css?: string) {
        this.label = label;
        this.isChecked = isChecked;
        this.id = label.replace(/[^a-zA-Z0-9]/g, '');
        this.onChanged = onChanged;
        this.css = css || "";
    }
    
    renderHtml(): JQuery {
        const $html = $(`<input type="checkbox" ${this.isChecked ? 'checked' : ''} id="${this.id}"><label class="checkbox-label" for="${this.id}" style="${this.css}">${this.label}</label>`);

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
    css: string;
    onChanged: OnChangeHandler;

    constructor(label: string, values: string[], selectedValue: string, onChanged?: OnChangeHandler, css?: string) {
        this.label = label;
        this.values = values;
        this.selectedValue = selectedValue;
        this.id = label.replace(/[^a-zA-Z0-9]/g, '');
        this.onChanged = onChanged;
        this.css = css || "";
    }

    renderHtml(): JQuery {
        let optionsHtml = this.values.map(value => `<option value="${value}" ${value === this.selectedValue ? 'selected' : ''}>${value}</option>`).join('');
        const $html = $(`<label class="dropdown" for="${this.id}" style="${this.css}">${this.label}</label><select id="${this.id}">${optionsHtml}</select>`);
        
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
    css: string;
    onChanged: OnChangeHandler;
    
    constructor(label: string, onChanged: OnChangeHandler, css?: string) {
        this.label = label;
        this.id = label.replace(/[^a-zA-Z0-9]/g, '');
        this.onChanged = onChanged;
        this.css = css || "";
    }

    renderHtml(): JQuery {
        const $html = $(`<span id="${this.id}" class="linkbutton pointer underline" style="${this.css}">${this.label}</span>`);
        
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
    private onRemove?: Function;

    constructor(options: IOption[], onRemove: Function | undefined = undefined) {
        this.options = options;
        this.onRemove = onRemove;
    }

    removeAll() {
        $('.context-menu').remove();
    }

    render(srcElement: JQuery) {
        // Close any other open context menu's
        this.removeAll();

        // Create a div element for the modal
        const modal = $('<div>').addClass('context-menu');

        modal.on('remove', () => {
            this.onRemove && this.onRemove();
        });

        //position it by the src element
        modal.css({
            top: (srcElement.offset()?.top || 0) + 6,
            left: (srcElement.offset()?.left || 0) + 24
        });

        // Add each option to the list
        this.options.forEach(option => {
            modal.append($('<div class="option">').html(option.renderHtml()));
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
