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
        const $html = $(`<label class="checkbox-label" for="${this.id}" style="${this.css}">
            <input type="checkbox" ${this.isChecked ? 'checked' : ''} id="${this.id}" style="vertical-align: middle; margin-top: 0px;">
            ${this.label}
        </label>`);

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
    image: string;
    onChanged: OnChangeHandler;

    constructor(label: string, onChanged: OnChangeHandler, css?: string, image?: string) {
        this.label = label;
        this.id = label.replace(/[^a-zA-Z0-9]/g, '');
        this.onChanged = onChanged;
        this.css = css || "";
        this.image = image || "";
    }

    renderHtml(): JQuery {
        let $html = $(`<span id="${this.id}" class="linkbutton pointer underline" style="${this.css}">${this.label}</span>`);
        if (this.image) {
            $html = $html.prepend($(`<img src="./images/${this.image}" style="padding-right:4px;vertical-align:middle;margin-top:-2px;">`));
        }

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
    private $lastModal: JQuery | null;

    constructor(options: IOption[], onRemove: Function | undefined = undefined) {
        this.options = options;
        this.onRemove = onRemove;
        this.$lastModal = null;
    }

    static removeAll() {
        $('.context-menu').remove();
    }

    remove() {
        this.$lastModal?.remove();
    }

    render(srcElement: JQuery, width: number, height: number, renderDirection: string = "down") {
        // Close any other open context menu's
        ContextMenu.removeAll();

        // Create a div element for the modal
        this.$lastModal = $('<div>').addClass('context-menu');

        this.$lastModal.on('remove', () => {
            this.onRemove && this.onRemove();
        });

        //position it by the src element
        this.$lastModal.css({
            top: (srcElement.offset()?.top || 0) + 6 - (renderDirection === "up" ? height : 0),
            left: (srcElement.offset()?.left || 0) + 24,
            width: width,
            height: height
        });

        // Add each option to the list
        this.options.forEach(option => {
            this.$lastModal?.append($('<div class="option">').html(option.renderHtml()));
        });

        // Append the modal to the body
        $('body').append(this.$lastModal);

        // Show the modal
        this.$lastModal.show();

        // Move it to within the viewport
        if (!ContextMenu.isElementInViewport(this.$lastModal)) {
            this.$lastModal.css('left', (srcElement.offset()?.left || 0) + 24 - (width));
        }

        $(window).on('keyup', (event: any) => {
            if (event.key === "Escape") {
                this.$lastModal?.remove();
            }
        });

        $('body').on('click', (event: any) => {
            if (this.$lastModal && this.$lastModal.length) {
                if (event.target !== this.$lastModal[0] && !$.contains(this.$lastModal[0], event.target)) {
                    this.$lastModal.remove();
                }
            }
        });
    }

    private static isElementInViewport(element: JQuery): boolean {
        if (!(element?.length > 0)) {
            return true;
        }

        var rect = element[0].getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
}
