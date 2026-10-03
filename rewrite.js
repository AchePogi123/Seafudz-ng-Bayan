const fs = require('fs');

const onlineCustomerPath = 'Frontend/src/features/OnlineCustomer.tsx';
let code = fs.readFileSync(onlineCustomerPath, 'utf8');

// 1. Remove the Payment Type Selection from the Billing Tab
const paymentSectionStart = code.indexOf('{/* Payment Type Selection */}');
const paymentSectionEnd = code.indexOf('<div className="border-t border-neutral-100 pt-5 flex justify-end">', paymentSectionStart);

if (paymentSectionStart !== -1 && paymentSectionEnd !== -1) {
    code = code.substring(0, paymentSectionStart) + code.substring(paymentSectionEnd);
}

// 2. Add the custom UI in the Tracking Tab for Inventory Check and Payment
const trackingStart = code.indexOf('{/* VIEW 3: ORDER STATUS TRACKING */}');
if (trackingStart !== -1) {
    const cancelBannerEnd = code.indexOf(')}', code.indexOf('activeOrder.status === \'CANCELLED\''));
    
    const waitUI = `
                        {/* INVENTORY VERIFICATION & PAYMENT UI */}
                        {activeOrder.status === 'PENDING_INVENTORY_VERIFICATION' && (
                            <div className="bg-blue-50 border border-blue-300 rounded-2xl p-5 text-blue-900 space-y-3 shadow-xs animate-fade-in mt-4">
                                <h4 className="font-extrabold text-lg text-blue-900">Checking Inventory</h4>
                                <p className="text-sm text-blue-700 leading-relaxed">
                                    The assistant is checking our inventory to ensure all ingredients are available to serve your meal fresh. Please wait...
                                </p>
                            </div>
                        )}

                        {(activeOrder.status === 'INVENTORY_VERIFIED' || activeOrder.status === 'PENDING_PAYMENT_SELECTION') && (
                            <div className="bg-white border-2 border-orange-200 rounded-2xl p-6 shadow-md mt-4">
                                <h4 className="font-extrabold text-xl text-orange-600 mb-4">Ingredients Verified! Select Payment Method</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            fetch(\`\${API_BASE_URL}/user-flow/orders/\${activeOrder.id}/status\`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ status: 'PENDING_COD_VERIFICATION', paymentMethod: 'COD' })
                                            }).then(() => window.location.reload());
                                        }}
                                        className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 transition-all text-left"
                                    >
                                        <span className="font-black text-emerald-900 block text-lg">Cash on Delivery (COD)</span>
                                        <span className="text-sm text-emerald-700 mt-1 block">Pay with cash when your food arrives.</span>
                                    </button>
                                    
                                    <button
                                        type="button"
                                        onClick={() => setIsVerificationModalOpen(true)}
                                        className="p-4 rounded-2xl border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 transition-all text-left"
                                    >
                                        <span className="font-black text-blue-900 block text-lg">GCash</span>
                                        <span className="text-sm text-blue-700 mt-1 block">Upload your payment screenshot.</span>
                                    </button>
                                </div>
                            </div>
                        )}
`;
    // We insert it right after the Cancelled banner
    const insertionPoint = cancelBannerEnd + 2; 
    code = code.substring(0, insertionPoint) + waitUI + code.substring(insertionPoint);
}

fs.writeFileSync(onlineCustomerPath, code);
console.log('Successfully updated OnlineCustomer.tsx');
