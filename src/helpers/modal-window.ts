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
            selector: '.md-dialog',
            show: false,
            mode: 'modal'
        };

    private opts: any;
    private modal: any;

    constructor(modalId: string, options: any | null = null) {
        //Add modal html to document body
        $(`#${modalId}`).remove();
        const $html = $(ModalWindow.modalHtml.replace('$id', modalId));
        $('body').append($html);

        this.opts = Object.assign({}, ModalWindow._defaultOptions, options || {});
        this.modal = $(this.opts.selector);
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
        this.query('.md-dialog-header-close-btn').on('click', (e: any) => {
            this.setVisible(false);
        });
        if (this.opts.mode !== 'modal') {
            this.modal.on('click', (e: any) => {
                if (e.target === this.modal) {
                    this.setVisible(false);
                }
            });
        }
    }
    afterRender(): void {
        if (this.opts.show === true) {
            this.setVisible(true);
        }
    }
    setVisible(visible: boolean): void {
        this.modal.toggleClass('md-dialog-visible', visible);
        if (visible) {
            this.onOpen() // class method override or callback (below)
            if (typeof this.opts.onOpen === 'function') {
                this.opts.onOpen(this.modal);
            }
        } else {
            this.onClose() // class method override or callback (below)
            if (typeof this.opts.onClose === 'function') {
                this.opts.onClose(this.modal);
            }
        }
    }
    query(childSelector: string) {
        return this.modal.find(childSelector);
    }

    // Example hooks
    onOpen() { }
    onClose() { }
}