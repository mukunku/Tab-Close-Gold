export class ModalWindow {
    private static readonly modalHtml: string =
        `<div id="$id" class="md-dialog">
        <div class="md-dialog-window">
            <div class="md-dialog-header">
                <div class="md-dialog-header-close-btn"></div>
                <div class="md-dialog-header-text">$header</div>
            </div>
            <div class="md-dialog-content">$content</div>
        </div>
    </div>`

    private static _defaultOptions: any =
        {
            show: false
        };

    private opts: any;
    private modal: any;

    constructor(modalId: string, options: any | null = null) {
        //Add modal html to document body
        $(`#${modalId}`).remove();
        const $html = $(ModalWindow.modalHtml.replace('$id', modalId));
        $('body').append($html);

        this.opts = Object.assign({}, ModalWindow._defaultOptions, options || {});
        this.modal = $html;
        this.initialize();
        this.addEventHandlers();
        this.afterRender();
    }
    initialize(headerContent: any = null, bodyContent: any = null) {
        if (headerContent || this.opts.headerContent) {
            this.query('.md-dialog-header-text').html(headerContent || this.opts.headerContent);
        }
        if (bodyContent || this.opts.htmlContent) {
            this.query('.md-dialog-content').html(bodyContent || this.opts.htmlContent);
        } else if (this.opts.textContent) {
            this.query('.md-dialog-content').text(this.opts.textContent);
        }
        if (this.opts.theme) {
            this.modal.addClass(`md-theme-${this.opts.theme}`);
        }
    }
    addEventHandlers() {
        this.query('.md-dialog-header-close-btn').on('click', (_: any) => {
            this.setVisible(false);
        });

        $(window).on('keyup', (event: any) => {
            if (event.key === "Escape") {
                this.setVisible(false);
            }
        });
    }
    afterRender(): void {
        if (this.opts.show === true) {
            this.setVisible(true);
        }
    }
    setVisible(visible: boolean): void {
        if (visible) {
            this.modal.toggleClass('md-dialog-visible', true);
        } else {
            this.modal.remove();
            $(window).off('keyup');
        }
    }
    query(childSelector: string) {
        return this.modal.find(childSelector);
    }
}