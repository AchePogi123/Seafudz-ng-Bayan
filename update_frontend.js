const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');

const project = new Project();
const customerFile = project.addSourceFileAtPath('c:/Users/Admin/Seafudz-ng-Bayan/Frontend/src/features/OnlineCustomer.tsx');

// 1. Remove checkIfBulkOrder import
const importDecls = customerFile.getImportDeclarations();
for (const imp of importDecls) {
    if (imp.getModuleSpecifierValue().includes('bulkOrder')) {
        imp.remove();
    }
}

// 2. Modify handlePlaceOrder
const placeOrderFunc = customerFile.getVariableDeclaration('handlePlaceOrder');
if (placeOrderFunc) {
    const arrowFunc = placeOrderFunc.getInitializerIfKind(SyntaxKind.ArrowFunction);
    if (arrowFunc) {
        // Just replace the whole body of the function because it's complex
        const bodyText = arrowFunc.getBodyText();
        let newBody = bodyText.replace(/const isBulk = checkIfBulkOrder.*?GCASH_AUTHORIZED'/s, "const initialStatus = 'PENDING_INVENTORY_VERIFICATION';\n        const paymentMethod = 'PENDING';");
        newBody = newBody.replace(/const orderPayload = \{[\s\S]*?items:/, `const orderPayload = {
            type: 'Delivery',
            customerName,
            phone,
            deliveryAddress: address,
            paymentMethod,
            paymentReceipt: paymentReceipt || undefined,
            notes: orderNotes,
            subtotal,
            vat,
            deliveryFee,
            total,
            status: initialStatus,
            items:`);
        
        arrowFunc.setBodyText(newBody);
    }
}

customerFile.saveSync();
console.log('OnlineCustomer.tsx modified with ts-morph');
