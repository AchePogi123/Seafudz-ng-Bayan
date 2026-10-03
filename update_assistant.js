const fs = require('fs');
const assistantPath = 'Frontend/src/features/AssistantRole.tsx';
let code = fs.readFileSync(assistantPath, 'utf8');

// Update normalizer in AssistantRole if it exists (but we might just update the action buttons first)
// Let's replace the action buttons logic.

const actionButtonsStart = code.indexOf('{/* Action Buttons based on Status */}');
const endOfActionButtons = code.indexOf('</div>', code.indexOf('return (', actionButtonsStart) + 500);

if (actionButtonsStart !== -1) {
    // We will extract from `{/* Action Buttons based on Status */}` to the end of the `})()` block.
    const iifeEnd = code.indexOf('})()}', actionButtonsStart) + 5;
    
    const newActionButtons = `{/* Action Buttons based on Status */}
                  <div className="pt-2">
                    {(() => {
                      const st = (selectedOrder.status || '').toUpperCase();

                      if (st === 'CANCELLED') {
                        return (
                          <div className="w-full bg-rose-50 text-rose-800 font-bold py-3 rounded-xl text-center text-xs border border-rose-200">
                            ❌ Order Cancelled by Customer
                          </div>
                        )
                      }

                      const isConfirmedOrLater = ['CONFIRMED', 'PENDING_PREPARATION', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'ASSIGNED', 'COMPLETED'].includes(st)

                      if (isConfirmedOrLater) {
                        return (
                          <div className="w-full bg-emerald-50 text-emerald-800 font-extrabold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 border border-emerald-300 shadow-xs">
                            ✓ Confirmed & Sent to Kitchen ({st})
                          </div>
                        )
                      }

                      if (st === 'PENDING_INVENTORY_VERIFICATION') {
                        return (
                          <button
                            onClick={() => {
                                fetch(\`\${API_BASE_URL}/user-flow/orders/\${selectedOrder.id}/status\`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'INVENTORY_VERIFIED' })
                                }).then(() => { setNotification('Inventory verified'); notifyOrderSync(); window.location.reload(); });
                            }}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-98"
                          >
                            <span>🛒 Verify Ingredients Available</span>
                          </button>
                        )
                      }
                      
                      if (st === 'INVENTORY_VERIFIED' || st === 'PENDING_PAYMENT_SELECTION') {
                          return (
                              <div className="w-full bg-blue-50 text-blue-800 font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 border border-blue-200 shadow-xs">
                                ⏳ Waiting for customer to select payment
                              </div>
                          )
                      }

                      if (st === 'PENDING_COD_VERIFICATION') {
                        return (
                          <button
                            onClick={() => handleConfirmCOD(selectedOrder.id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-98"
                          >
                            <span>✅ Confirm COD Order & Send to Kitchen</span>
                          </button>
                        )
                      }

                      if (st === 'RECEIPT_SUBMITTED') {
                        return (
                          <div className="space-y-2 bg-emerald-50 p-3.5 rounded-2xl border border-emerald-300">
                            <p className="font-extrabold text-xs text-emerald-950 text-center">Payment Receipt Received</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleVerifyReceipt(selectedOrder.id)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-[10px] sm:text-xs cursor-pointer shadow-md transition-all active:scale-95"
                              >
                                ✅ Verify & Confirm Order
                              </button>
                              <button
                                onClick={() => {
                                  if (selectedOrder.paymentReceipt) {
                                    setPreviewReceiptUrl(selectedOrder.paymentReceipt)
                                  } else {
                                    alert('No receipt image available.')
                                  }
                                }}
                                className="px-3 bg-white hover:bg-emerald-100 text-emerald-800 font-bold py-3 rounded-xl text-xs cursor-pointer border border-emerald-300 transition-all active:scale-95 whitespace-nowrap"
                              >
                                🖼️ View Receipt
                              </button>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div className="w-full bg-neutral-100 text-neutral-500 font-bold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 border border-neutral-200 shadow-xs">
                          Pending Customer Action ({st})
                        </div>
                      )
                    })()}`;

    code = code.substring(0, actionButtonsStart) + newActionButtons + code.substring(iifeEnd);
}

fs.writeFileSync(assistantPath, code);
console.log('Successfully updated AssistantRole.tsx');
