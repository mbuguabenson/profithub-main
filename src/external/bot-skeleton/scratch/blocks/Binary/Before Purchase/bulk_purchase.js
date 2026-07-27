import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.bulk_purchase = {
    init() {
        this.jsonInit(this.definition());
        this.setNextStatement(false);
    },
    definition() {
        return {
            message0: localize('Bulk Purchase {{ contract_type }} (x{{ count }} parallel)', {
                contract_type: '%1',
                count: '%2',
            }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'PURCHASE_LIST',
                    options: [
                        [localize('CALL'), 'CALL'],
                        [localize('PUT'), 'PUT'],
                        [localize('DIGITEVEN'), 'DIGITEVEN'],
                        [localize('DIGITODD'), 'DIGITODD'],
                        [localize('DIGITOVER'), 'DIGITOVER'],
                        [localize('DIGITUNDER'), 'DIGITUNDER'],
                        [localize('DIGITMATCH'), 'DIGITMATCH'],
                        [localize('DIGITDIFF'), 'DIGITDIFF'],
                    ],
                },
                {
                    type: 'field_number',
                    name: 'BULK_COUNT',
                    value: 2,
                    min: 2,
                    max: 5,
                    precision: 1,
                },
            ],
            previousStatement: null,
            colour: '#f5c542',
            colourSecondary: '#e67e22',
            colourTertiary: '#d97706',
            tooltip: localize('Purchases multiple contracts simultaneously on Deriv WS for bulk leverage.'),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Bulk Purchase'),
            description: localize('Execute bulk multi-contract purchases simultaneously on Deriv.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.bulk_purchase = function (block) {
    const purchaseType = block.getFieldValue('PURCHASE_LIST');
    const bulkCount = block.getFieldValue('BULK_COUNT') || 2;
    return `Bot.bulkPurchase('${purchaseType}', ${bulkCount});\n`;
};
