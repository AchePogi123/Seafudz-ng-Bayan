# 🌊 Seafudz ng Bayan — Comprehensive User Manual & Operations Guide

Welcome to the **Seafudz ng Bayan** Restaurant Management & Ordering Platform user manual. This guide provides step-by-step instructions for customers, cashiers, kitchen staff, waiters, riders, and administrators.

---

## 🔑 Quick Reference: Default Seed Credentials

For quick system testing, use the pre-loaded PIN codes or register a new Supabase email account on the login page ([`/login`](http://localhost:5173/login)).

| Role | Username | Email | PIN Code | Default Dashboard Route |
| :--- | :--- | :--- | :--- | :--- |
| **Cashier** | `cashier1` | `cashier@seafudz.ph` | `1234` | `/sales-report` |
| **Kitchen Staff** | `kitchen1` | `kitchen@seafudz.ph` | `5678` | `/kitchen` |
| **Rider** | `rider1` | `rider@seafudz.ph` | `9999` | `/rider` |
| **Assistant / Waiter** | `assistant1` | `assistant@seafudz.ph` | `4321` | `/assistant` |
| **Admin / Manager** | `admin1` | `admin@seafudz.ph` | `0000` | `/dashboard` |
| **Customer** | *(Self Sign Up)* | *(Your Email)* | *(Your Password)* | `/customer` |

> 🔒 **Employee Access Token**: Staff registrations require token: `SFB-STAFF-99`

---

## 🛍️ 1. Online Customer Ordering Portal (`/customer`)

### Feature Overview
Allows online customers to browse seafood bilao feasts, cajun boils, drinks, and sides dynamically fetched from the live database menu catalog.

### Step-by-Step Instructions:
1. **Browse Menu**: Use category tabs (*Seafood*, *Shrimp*, *Crab*, *Drinks*, *Sides*) or search by dish name.
2. **Customize & Add to Cart**: Click on any dish card to choose quantity and special notes (e.g. *"Extra spicy sauce"*), then click **Add to Cart**.
3. **Review Cart**: Open the shopping cart drawer on the right to view subtotal, VAT (12%), and grand total.
4. **Select Order Type**: Choose between **Take Out** or **Delivery**.
   - If **Delivery** is selected, enter your full delivery address and contact phone number.
5. **Select Payment Method**: Choose **GCash**, **Maya**, **Card**, or **Cash on Delivery**.
6. **Place Order**: Click **Place Order**. You will receive an instant order reference ID (e.g., `ORD-1002`).

---

## 🖥️ 2. POS Counter Terminal (`/pos`)

### Feature Overview
Designed for on-site cashiers to take dine-in and counter orders rapidly.

### Step-by-Step Instructions:
1. **Login**: Sign in using `cashier1` / PIN `1234`.
2. **Select Table / Order Context**: Choose the assigned Dining Table (e.g. *Table 1*, *Table 5*) or select *Take Out*.
3. **Build Order**: Tap menu items to add them to the ticket list.
4. **Apply Discounts / Notes**: Add item notes or custom instructions per line item.
5. **Process Payment**: Select payment type (**Cash**, **GCash**, **Card**, **Maya**), enter amount tendered, and click **Process Order**.
6. **Print Receipt / Send to Kitchen**: The order automatically enters the **Kitchen Display Queue** in real-time.

---

## 👨‍🍳 3. Kitchen Display System (`/kitchen`)

### Feature Overview
Provides kitchen chefs with a real-time order queue sorted by order creation timestamp.

### Step-by-Step Instructions:
1. **Login**: Sign in using `kitchen1` / PIN `5678`.
2. **View Order Tickets**: Active orders appear in order cards showing order ID, table number, item quantities, and special preparation notes.
3. **Update Cooking Status**:
   - Click **Start Preparing** (`Preparing` / `Cooking`).
   - When food is cooked and plated, click **Mark as Ready** (`Ready`).
4. **Manage Item Stock**: Toggle item availability if an ingredient runs out during a shift.

---

## 🛎️ 4. Assistant & Waiter Service Mode (`/assistant`)

### Feature Overview
Enables floor waiters to attend to customer table calls and handle table-side bill settlements.

### Step-by-Step Instructions:
1. **Login**: Sign in using `assistant1` / PIN `4321`.
2. **Table Call Alerts**: Receive notifications for table requests (*Call Waiter*, *Water Refill*, *Request Bill*, *Clean Table*).
3. **Resolve Calls**: Click **Attend** when walking to the table, and **Resolve** when completed.
4. **Table-Side Payment**: View open table bills, process GCash/Cash payment at the table, and close out the order.

---

## 🛵 5. Delivery Rider Portal (`/rider`)

### Feature Overview
Allows delivery drivers to manage customer food deliveries.

### Step-by-Step Instructions:
1. **Login**: Sign in using `rider1` / PIN `9999`.
2. **View Ready Deliveries**: Check orders marked as `Ready` for delivery.
3. **Claim Delivery**: Click **Accept Delivery** (`Assigned` / `Out for Delivery`).
4. **Complete Delivery**: Upon arriving at the customer address and collecting payment, click **Mark Delivered** (`Completed`).

---

## 📊 6. Sales Analytics & Reports (`/sales-report`)

### Feature Overview
Provides management with real-time financial metrics, daily gross revenue, tax collections, and top-selling seafood items.

### Step-by-Step Instructions:
1. **Login**: Sign in using `admin1` / PIN `0000` or `cashier1` / `1234`.
2. **View Metrics**: Track Total Sales (₱), Order Volume, VAT Tax Collected (12%), and Average Ticket Size.
3. **Filter Date Range**: View daily, weekly, or monthly revenue reports.
