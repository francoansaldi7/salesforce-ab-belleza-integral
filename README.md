# AB Belleza Integral: Salon Management on Salesforce

A complete management app for a beauty salon, built on the Salesforce Platform with Lightning Web Components, Apex and Flows. It covers appointments, clients (including treatment and medical notes), services, product inventory, and the salon's income and expenses, from one dashboard.

The app is used day to day by a salon in Argentina, so **its interface is in Spanish** (Argentine *voseo*) and amounts are in Argentine pesos.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Privacy:** this repository contains only code and metadata. No client data, no business records and no org-specific identifiers. The optional sample-data script creates **fictional** clients and records for demos.

## Features

### Dashboard (`salonHome`)
- **Today's appointments** and **upcoming appointments**, each showing the client, services, amount paid and status. The client name carries a **VIP** badge and an **ALERGIA** badge (with the allergy note on hover) when relevant.
- **One-click status changes** (Confirmada, En Progreso, Completada, No Asistió, Cancelada) and an **inline edit form** for any appointment
- **KPI tiles:**
  - Monthly balance, which opens a **month-by-month history** of income, expenses and transactions
  - Open appointments
  - **Low-stock products**
  - **Inactive clients** (no visit in 60 days)
- The KPIs refresh themselves every 60 seconds.
- **Quick actions** launch guided wizards: *Nueva Cita*, *Registrar Gasto* and *Vender Producto*

### Guided wizards (Screen Flows)
- **Nueva Cita**, in three steps: client, services, then date, time and payment. If the time slot is already taken, the wizard **returns to step 3 with a clear message** naming the existing booking, so you never lose what you typed.
- **Registrar Gasto**: log an expense with category, amount, date and payment method
- **Vender Producto**: checks stock before selling, records the sale, and deducts the stock. If either save fails, **both are rolled back**, so a sale can never exist without its stock being deducted.
- Every wizard shows errors as a message on its own form instead of Salesforce's generic error screen.

### Automation (record-triggered Flows)
| Flow | What it does |
|---|---|
| `Cita_Verificar_Conflicto` | Blocks two active (non-cancelled) appointments at the same date and time, from any entry point |
| `Cita_Asignar_Monto_Pagado` | Defaults *Monto Pagado* to *Monto Total* when no payment amount is entered |
| `Cita_Crear_Transaccion` | Keeps **exactly one service income per completed appointment**. It creates the income when the appointment becomes *Completada* (including when it's created that way), never duplicates it, and removes it if the appointment stops being completed. It also updates the client's last visit. |
| `Cliente_Flag_VIP` | Flags a client as VIP at **$500.000 spent or 10 completed visits**, using roll-ups that count completed appointments only |

### Record page components
- **Product card** (`salonProductCard`, on the product record page): upload a product photo and see it on the product's page
- **Client card** (`salonClientCard`): avatar initials, contact details, birthday, VIP status, lifetime spend and visits, allergy notes, and the last five appointments. It's ready to drop onto the client record page in the Lightning App Builder.

## Architecture

```
force-app/main/default/
├── applications/AB_Belleza_Integral.app-meta.xml
├── classes/
│   ├── SalonController.cls          # Dashboard, client card and product image queries; status updates
│   ├── SalonControllerTest.cls      # 23 tests
│   └── SalonAutomationTest.cls      # 11 tests covering the record-triggered flows
├── flows/                           # 3 guided wizards + 4 record-triggered automations
├── lwc/
│   ├── salonHome/                   # Dashboard (+ Jest tests)
│   ├── salonClientCard/             # Client record card
│   └── salonProductCard/            # Product photo card
├── objects/                         # Salon_Appointment__c, Salon_Client__c, Salon_Service__c,
│                                    # Salon_Product__c, Salon_Transaction__c
├── flexipages/                      # Dashboard app page + product record page
├── permissionsets/AB_Belleza_Integral.permissionset-meta.xml
└── tabs/
scripts/apex/seed-sample-data.apex   # Optional fictional demo data
```

### Data model

| Object | Purpose | Key fields |
|---|---|---|
| `Salon_Client__c` (Cliente) | Client file | Phone, email, birthday, preferred services, allergy notes, medical conditions, treatment follow-up, last visit, **Total Gastado** and **Total de Visitas** (roll-ups of completed appointments), VIP |
| `Salon_Appointment__c` (Cita) | Booking. Master-detail to Cliente. | Date and time, services (multi-select), status, total amount, amount paid, payment method, notes |
| `Salon_Service__c` (Servicio) | Service catalog | Category, price, duration, active |
| `Salon_Product__c` (Producto) | Inventory | Category, cost and sale price, stock, low-stock threshold, supplier, profit margin (formula) |
| `Salon_Transaction__c` (Transacción) | Cash flow | Type (Ingreso/Gasto), category, amount, date, payment method, related appointment and product |

### Design decisions
- **Declarative automation, versioned:** business rules live in Flows so the salon owner's day-to-day behavior can be changed and **rolled back in one click** by reactivating a previous flow version. Apex is reserved for the dashboard's read-heavy queries.
- **Totals over every record:** the monthly balance history sums *all* of a month's transactions with an aggregate query. Only the visible list is capped (at 200 rows).
- **Timezone-safe dates:** date-only fields are formatted by splitting the `YYYY-MM-DD` string instead of parsing it with `new Date()`, which would shift dates back a day in UTC-3 (Argentina).
- **Security:** every Apex query uses `WITH SECURITY_ENFORCED`, so field-level security is respected. Status updates are validated against an allow-list.

## Deployment

Requires the [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli).

```bash
# 1. Authorize a target org (use a Developer Edition or sandbox for trying it out)
sf org login web --alias salonOrg

# 2. Deploy
sf project deploy start --target-org salonOrg

# 3. Grant access
sf org assign permset --name AB_Belleza_Integral --target-org salonOrg

# 4. (Optional) Load fictional demo data: 12 clients, ~100 appointments, sales and expenses
sf apex run --file scripts/apex/seed-sample-data.apex --target-org salonOrg
```

Then open **AB Belleza Integral** from the App Launcher. The business logo isn't included in this repo, so the app shows Salesforce's default icon.

## Testing

**Apex**: 34 tests. They cover every controller method and every record-triggered flow:
- one income per appointment: no duplicates, removal on cancel, creation when an appointment is created already completed
- double-booking prevention, and that a cancelled appointment frees its slot
- the VIP thresholds
- monthly totals with more than 200 transactions

```bash
sf apex run test --class-names SalonControllerTest --class-names SalonAutomationTest --code-coverage --result-format human --target-org salonOrg
```

**LWC (Jest)**: 10 tests for the dashboard, covering KPIs and peso formatting, badges, today and upcoming views, status changes, the wizard lifecycle, the balance history, and the low-stock and inactive-client details.

```bash
npm install
npm run test:unit
```
