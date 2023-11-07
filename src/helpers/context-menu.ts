export interface IOption {
    type: string;
    renderHtml(): string;
}

export class CheckboxOption implements IOption {
    type: string = "checkbox";
    isChecked: boolean;
    label: string;

    constructor(label: string, isChecked: boolean = false) {
        this.label = label;
        this.isChecked = isChecked;
    }

    toggleCheck() {
        this.isChecked = !this.isChecked;
    }

    renderHtml() {
        return `<input type="checkbox" ${this.isChecked ? 'checked' : ''} id="${this.label}"><label for="${this.label}">${this.label}</label>`;
    }
}

export class DropdownOption implements IOption {
    type: string = "dropdown";
    values: string[];
    selectedValue: string;

    constructor(values: string[], selectedValue: string) {
        this.values = values;
        this.selectedValue = selectedValue;
    }

    renderHtml() {
        let optionsHtml = this.values.map(value => `<option value="${value}" ${value === this.selectedValue ? 'selected' : ''}>${value}</option>`).join('');
        return `<select>${optionsHtml}</select>`;
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
        // Create a div element for the modal
        const modal = $('<div>').addClass('context-menu');

        //position it by the src element
        modal.css({
            top: srcElement.offset()?.top || 0,
            left: srcElement.offset()?.left || 0
        });

        // Create an unordered list element for the options
        const list = $('<ul>');

        // Add each option to the list
        this.options.forEach(option => {
            list.append($('<li>').html(option.renderHtml()));
        });

        // Add the list to the modal
        modal.append(list);

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
            debugger;
            if (event.target !== modal[0] && !$.contains(modal[0], event.target)) {
                modal.remove();
            }
        });
    }
}
