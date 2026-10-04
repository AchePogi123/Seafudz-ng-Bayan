import fetch from 'node-fetch';

async function test() {
  const payload = {
      id: "POS-TEST1234",
      ref: "POS-TEST1234",
      isPosOrder: true,
      status: 'CONFIRMED',
      orderType: 'DINE_IN',
      type: 'Dine In',
      paymentMethod: 'Cash',
      notes: '',
      subtotal: 100,
      vat: 12,
      deliveryFee: 0,
      total: 112,
      cartItems: [
        {
          productId: "item-1",
          name: "Test Item",
          unit_price: 100,
          quantity: 1,
          notes: null,
        }
      ],
  };

  const res = await fetch('http://localhost:5000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
}
test();
