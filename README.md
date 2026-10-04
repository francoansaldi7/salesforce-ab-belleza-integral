# AB Belleza Integral: Salon Management on Salesforce

A complete management app for a beauty salon, built on the Salesforce Platform with Lightning Web Components, Apex and Flows. It covers appointments, clients (including treatment and medical notes), services, product inventory, and the salon's income and expenses, from one dashboard.

The app is used day to day by a salon in Argentina, so **its interface is in Spanish** (Argentine *voseo*) and amounts are in Argentine pesos.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Privacy:** this repository contains only code and metadata. No client data, no business records and no org-specific identifiers. The optional sample-data script creates **fictional** clients and records for demos.

## Features

### Design
A custom visual identity taken from the salon's logo: **sage and cream**, warm charcoal text and **elegant serif headings**. It's shared by every component through one CSS module (`salonStyles`), with themed loading states and a responsive layout for phones and tablets.

### Dashboard (`salonHome`)
- **Today's appointments** and **upcoming appointments**. Each row shows a time chip, the client's initials, **VIP** and **ALERGIA** badges (the allergy note shows on hover), service tags, the amount paid and a status pill.
- **One-click status changes** (Confirmada, En Progreso, Completada, No Asistió, Cancelada), an **edit window** for any appointment, and **delete with confirmation**. Deleting also removes the appointment's service income from the balance, and the record stays recoverable from the Recycle Bin for 15 days.
- **KPI tiles:**
  - Monthly balance, which opens a **month-by-month history** of income, expenses and transactions
  - Open appointments
  - **Low-stock products**
  - **Inactive clients** (no visit in 60 days)
- The KPIs refresh themselves every 60 seconds.
- **Quick actions** launch guided wizards (*Nueva Cita*, *Registrar Gasto*, *Vender Producto*) or open the appointment history

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

### Appointment history (`salonHistory`, the *Historial* tab)
- **Every appointment**, whatever its status: completed, cancelled, no-show or still open
- **Filters:**
  - status chips
  - period: this month, last 3 months, this year, all, or custom dates
  - client search, debounced
- **Summary strip** for the current filter: total appointments, completed, cancelled, no-shows, and the **amount billed** (amount paid on completed appointments)
- **Sorting:** newest or oldest first, 15 per page
- Clicking a row **edits the appointment**; clicking the client's name opens **her client file**.

### Client file (`salonClientCard`, on the client record page)
- **One-tap contact:**
  - **WhatsApp**: Argentine numbers like `011 15 2345-6789` are normalized to `wa.me/5491123456789`
  - **call**, **email** and **Instagram** (a new optional field)
  - Each button appears only when that data exists.
- **"Ficha de salud":** allergies as a safety alert, medical conditions as tags, and treatment follow-up notes
- **At a glance:** total visits, total spent, last visit, birthday (with a "¡Cumple hoy!" reminder within the week) and preferred services
- **Recent appointments:** the last five, with a link to her **full history** (the Historial tab, pre-filtered)
- Refreshes itself whenever the record is edited.

### Product card (`salonProductCard`, on the product record page)
- Upload a product photo and see it on the product's page

## Architecture

```
force-app/main/default/
├── applications/AB_Belleza_Integral.app-meta.xml
├── classes/
│   ├── SalonController.cls          # Dashboard, history, client card and product image queries; status updates
│   ├── SalonControllerTest.cls      # 31 tests
│   └── SalonAutomationTest.cls      # 11 tests covering the record-triggered flows
├── flows/                           # 3 guided wizards + 4 record-triggered automations
├── lwc/
│   ├── salonHome/                   # Dashboard
│   ├── salonHistory/                # Historial tab
│   ├── salonClientCard/             # Client file (record page)
│   ├── salonAppointmentEditModal/   # Shared "edit appointment" window
│   ├── salonProductCard/            # Product photo card
│   ├── salonUtils/                  # Shared JS: pesos, dates, status styles, WhatsApp/Instagram links
│   └── salonStyles/                 # Shared CSS design system (sage + cream)
├── objects/                         # Salon_Appointment__c, Salon_Client__c, Salon_Service__c,
│                                    # Salon_Product__c, Salon_Transaction__c
├── layouts/                         # Page layouts for the five objects
├── flexipages/                      # Dashboard + Historial app pages, client and product record pages
├── permissionsets/AB_Belleza_Integral.permissionset-meta.xml
└── tabs/
scripts/apex/seed-sample-data.apex   # Optional fictional demo data
```

### Data model

| Object | Purpose | Key fields |
|---|---|---|
| `Salon_Client__c` (Cliente) | Client file | Phone, email, Instagram, birthday, preferred services, allergy notes, medical conditions, treatment follow-up, last visit, **Total Gastado** and **Total de Visitas** (roll-ups of completed appointments), VIP |
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

**Apex**: 42 tests, with **97% coverage** of `SalonController`. They cover every controller method and every record-triggered flow:
- one income per appointment: no duplicates, removal on cancel, creation when an appointment is created already completed
- double-booking prevention, and that a cancelled appointment frees its slot
- the VIP thresholds
- monthly totals with more than 200 transactions
- history filters, summary, sorting and paging
- deleting an appointment together with its service income only
- product image lookup: latest image attached, non-image files ignored

```bash
sf apex run test --class-names SalonControllerTest --class-names SalonAutomationTest --code-coverage --result-format human --target-org salonOrg
```

**LWC (Jest)**: 47 tests, covering every component:
- **Dashboard:** KPIs, the today and upcoming views, status changes, the wizards, balance history, and the stock and inactive-client details
- **Historial:** filters, debounced search, summary, sorting, paging, row and client navigation, and arriving pre-filtered from a client file
- **Client file:** contact links, the health section, stats and the history link
- **Edit window:** editing, plus delete with confirmation, cancel and retry on failure
- **Product card:** image, empty and error states, upload settings, and showing the new photo right after an upload
- **Helpers:** Argentine WhatsApp formats, Instagram parsing and formatting

```bash
npm install
npm run test:unit
```
