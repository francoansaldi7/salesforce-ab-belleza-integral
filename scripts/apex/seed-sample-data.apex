// Datos de ejemplo 100% FICTICIOS para AB Belleza Integral (demos y capturas de pantalla).
// Ejecutar UNA sola vez en una org de prueba (nunca en la org productiva del salón):
//   sf apex run --file scripts/apex/seed-sample-data.apex --target-org <alias>
//
// Crea servicios, productos, clientes, ~3 meses de citas completadas (que generan sus ingresos
// automáticamente vía el flujo Cita_Crear_Transaccion), citas de hoy y próximas, gastos y ventas.
// Las fechas son relativas a hoy.

// ─── Seguridad ────────────────────────────────────────────────────────────────
// Se niega a correr en una org que ya tiene clientes (por ejemplo, la org productiva del salón).
class SeedSafetyException extends Exception {}
Integer existingClients = [SELECT COUNT() FROM Salon_Client__c];
if (existingClients > 0) {
    throw new SeedSafetyException('Esta org ya tiene ' + existingClients
        + ' clientes: los datos de ejemplo solo se cargan en una org vacía de prueba. No se modificó nada.');
}

// ─── Servicios ────────────────────────────────────────────────────────────────
List<Salon_Service__c> services = new List<Salon_Service__c>{
    new Salon_Service__c(Name = 'Corte de Cabello',   Category__c = 'Cabello',    Price__c = 18000, Duration_Minutes__c = 45, Is_Active__c = true),
    new Salon_Service__c(Name = 'Coloración',         Category__c = 'Cabello',    Price__c = 42000, Duration_Minutes__c = 90, Is_Active__c = true),
    new Salon_Service__c(Name = 'Mechas / Balayage',  Category__c = 'Cabello',    Price__c = 65000, Duration_Minutes__c = 150, Is_Active__c = true),
    new Salon_Service__c(Name = 'Tratamiento Capilar', Category__c = 'Cabello',   Price__c = 28000, Duration_Minutes__c = 60, Is_Active__c = true),
    new Salon_Service__c(Name = 'Manicure Gel',       Category__c = 'Uñas',       Price__c = 16000, Duration_Minutes__c = 60, Is_Active__c = true),
    new Salon_Service__c(Name = 'Pedicure',           Category__c = 'Uñas',       Price__c = 19000, Duration_Minutes__c = 60, Is_Active__c = true),
    new Salon_Service__c(Name = 'Faciales',           Category__c = 'Piel',       Price__c = 32000, Duration_Minutes__c = 60, Is_Active__c = true),
    new Salon_Service__c(Name = 'Depilación',         Category__c = 'Depilación', Price__c = 14000, Duration_Minutes__c = 30, Is_Active__c = true),
    new Salon_Service__c(Name = 'Maquillaje',         Category__c = 'Maquillaje', Price__c = 35000, Duration_Minutes__c = 60, Is_Active__c = true)
};
insert services;

// ─── Productos (algunos con bajo stock) ──────────────────────────────────────
List<Salon_Product__c> products = new List<Salon_Product__c>{
    new Salon_Product__c(Name = 'Shampoo Reparador 500 ml',   Category__c = 'Cabello',      Cost_Price__c = 9000,  Sale_Price__c = 16500, Stock_Quantity__c = 14, Low_Stock_Alert__c = 4, Supplier__c = 'Proveedor Ejemplo A'),
    new Salon_Product__c(Name = 'Máscara Nutritiva 250 ml',   Category__c = 'Cabello',      Cost_Price__c = 11000, Sale_Price__c = 21000, Stock_Quantity__c = 3,  Low_Stock_Alert__c = 4, Supplier__c = 'Proveedor Ejemplo A'),
    new Salon_Product__c(Name = 'Protector Térmico 150 ml',   Category__c = 'Venta Retail', Cost_Price__c = 7500,  Sale_Price__c = 14000, Stock_Quantity__c = 9,  Low_Stock_Alert__c = 3, Supplier__c = 'Proveedor Ejemplo B'),
    new Salon_Product__c(Name = 'Esmalte Semipermanente Rosa', Category__c = 'Uñas',        Cost_Price__c = 4200,  Sale_Price__c = 8500,  Stock_Quantity__c = 2,  Low_Stock_Alert__c = 5, Supplier__c = 'Proveedor Ejemplo C'),
    new Salon_Product__c(Name = 'Crema Hidratante Facial',    Category__c = 'Piel',         Cost_Price__c = 12500, Sale_Price__c = 23000, Stock_Quantity__c = 7,  Low_Stock_Alert__c = 2, Supplier__c = 'Proveedor Ejemplo B'),
    new Salon_Product__c(Name = 'Tintura Rubio Ceniza 8.1',   Category__c = 'Cabello',      Cost_Price__c = 5200,  Sale_Price__c = 0,     Stock_Quantity__c = 1,  Low_Stock_Alert__c = 6, Supplier__c = 'Proveedor Ejemplo A')
};
insert products;

// ─── Clientes ficticios ──────────────────────────────────────────────────────
List<String> names = new List<String>{
    'Valentina Ficticia', 'Camila Ejemplo', 'Sofía Demo', 'Martina Muestra', 'Lucía Prueba',
    'Julieta Ejemplar', 'Agustina Modelo', 'Florencia Ficticia', 'Carolina Demo', 'Paula Muestra',
    'Rocío Ejemplo', 'Milagros Prueba'
};
List<Salon_Client__c> clients = new List<Salon_Client__c>();
for (Integer i = 0; i < names.size(); i++) {
    clients.add(new Salon_Client__c(
        Name = names[i],
        Full_Name__c = names[i],
        Phone__c = '11 0000-00' + String.valueOf(10 + i),
        Email__c = 'cliente' + i + '@example.com',
        Birthday__c = Date.newInstance(1990 + Math.mod(i, 10), Math.mod(i, 12) + 1, 10 + i),
        Allergies_Notes__c = Math.mod(i, 5) == 0 ? 'Ejemplo: sensibilidad al amoníaco' : null
    ));
}
insert clients;

// ─── Citas ───────────────────────────────────────────────────────────────────
List<String> serviceCombos = new List<String>{
    'Corte de Cabello', 'Coloración', 'Corte de Cabello;Tratamiento Capilar', 'Manicure Gel',
    'Manicure Gel;Pedicure', 'Faciales', 'Mechas / Balayage', 'Depilación', 'Maquillaje'
};
List<Decimal> comboPrices = new List<Decimal>{ 18000, 42000, 46000, 16000, 35000, 32000, 65000, 14000, 35000 };
List<String> methods = new List<String>{ 'Efectivo', 'Transferencia', 'Tarjeta' };

List<Salon_Appointment__c> appointments = new List<Salon_Appointment__c>();
Integer seq = 0;
// Historial: ~90 días hacia atrás, 0–2 citas por día hábil, todas completadas (generan su ingreso).
for (Integer daysAgo = 90; daysAgo >= 1; daysAgo--) {
    Date day = Date.today().addDays(-daysAgo);
    Integer perDay = Math.mod(daysAgo * 7, 3);
    for (Integer slot = 0; slot < perDay; slot++) {
        Integer combo = Math.mod(seq * 5 + daysAgo, serviceCombos.size());
        // Las primeras 2 clientas dejan de venir (quedan "inactivas" > 60 días).
        Integer clientIndex = daysAgo > 65 ? Math.mod(seq, 2) : 2 + Math.mod(seq * 3, clients.size() - 2);
        appointments.add(new Salon_Appointment__c(
            Client__c = clients[clientIndex].Id,
            Appointment_Date__c = Datetime.newInstance(day, Time.newInstance(10 + slot * 3, 0, 0, 0)),
            Services__c = serviceCombos[combo],
            Status__c = Math.mod(seq, 17) == 0 ? 'No Asistió' : 'Completada',
            Total_Amount__c = comboPrices[combo],
            Payment_Method__c = methods[Math.mod(seq, 3)]
        ));
        seq++;
    }
}
// Hoy y próximos días: citas abiertas.
List<Integer> upcomingDays = new List<Integer>{ 0, 0, 0, 1, 2, 2, 4, 6, 9 };
List<String> upcomingStatus = new List<String>{ 'Confirmada', 'Programada', 'Programada', 'Confirmada', 'Programada', 'Programada', 'Confirmada', 'Programada', 'Programada' };
for (Integer i = 0; i < upcomingDays.size(); i++) {
    Integer combo = Math.mod(i * 4, serviceCombos.size());
    appointments.add(new Salon_Appointment__c(
        Client__c = clients[2 + Math.mod(i * 5, clients.size() - 2)].Id,
        Appointment_Date__c = Datetime.newInstance(Date.today().addDays(upcomingDays[i]), Time.newInstance(11 + Math.mod(i, 3) * 3, 30, 0, 0)),
        Services__c = serviceCombos[combo],
        Status__c = upcomingStatus[i],
        Total_Amount__c = comboPrices[combo],
        Payment_Method__c = methods[Math.mod(i, 3)]
    ));
}
insert appointments;

// La "Última Visita" la fija el flujo con la fecha de hoy; para el demo usamos la fecha real de la última cita completada.
Map<Id, Date> lastVisit = new Map<Id, Date>();
for (Salon_Appointment__c a : appointments) {
    if (a.Status__c == 'Completada') {
        Date d = a.Appointment_Date__c.date();
        if (!lastVisit.containsKey(a.Client__c) || d > lastVisit.get(a.Client__c)) lastVisit.put(a.Client__c, d);
    }
}
List<Salon_Client__c> visitUpdates = new List<Salon_Client__c>();
for (Id clientId : lastVisit.keySet()) visitUpdates.add(new Salon_Client__c(Id = clientId, Last_Visit_Date__c = lastVisit.get(clientId)));
update visitUpdates;

// Los ingresos de las citas completadas se crean con fecha de hoy; para el demo los movemos a la fecha de la cita.
Map<Id, Date> apptDates = new Map<Id, Date>();
for (Salon_Appointment__c a : appointments) apptDates.put(a.Id, a.Appointment_Date__c.date());
List<Salon_Transaction__c> incomes = [SELECT Id, Related_Appointment__c FROM Salon_Transaction__c WHERE Related_Appointment__c IN :apptDates.keySet()];
for (Salon_Transaction__c t : incomes) t.Transaction_Date__c = apptDates.get(t.Related_Appointment__c);
update incomes;

// ─── Gastos y ventas de productos ────────────────────────────────────────────
List<Salon_Transaction__c> others = new List<Salon_Transaction__c>();
for (Integer m = 0; m < 3; m++) {
    Date monthStart = Date.today().toStartOfMonth().addMonths(-m);
    others.add(new Salon_Transaction__c(Transaction_Type__c = 'Gasto', Category__c = 'Insumos', Amount__c = 185000 + m * 12000, Transaction_Date__c = monthStart.addDays(4), Description__c = 'Compra de insumos (ejemplo)', Payment_Method__c = 'Transferencia'));
    others.add(new Salon_Transaction__c(Transaction_Type__c = 'Gasto', Category__c = 'Marketing', Amount__c = 25000, Transaction_Date__c = monthStart.addDays(9), Description__c = 'Publicidad en redes (ejemplo)', Payment_Method__c = 'Tarjeta'));
    if (m == 1) others.add(new Salon_Transaction__c(Transaction_Type__c = 'Gasto', Category__c = 'Equipamiento', Amount__c = 120000, Transaction_Date__c = monthStart.addDays(15), Description__c = 'Secador profesional (ejemplo)', Payment_Method__c = 'Tarjeta'));
    for (Integer s = 0; s < 4; s++) {
        Salon_Product__c p = products[Math.mod(m + s, 5)];
        others.add(new Salon_Transaction__c(Transaction_Type__c = 'Ingreso', Category__c = 'Venta de Producto', Amount__c = p.Sale_Price__c - p.Cost_Price__c, Transaction_Date__c = monthStart.addDays(3 + s * 6), Description__c = 'Venta de 1 x ' + p.Name, Related_Product__c = p.Id, Payment_Method__c = methods[Math.mod(s, 3)]));
    }
}
// Solo movimientos que ya ocurrieron.
for (Integer i = others.size() - 1; i >= 0; i--) {
    if (others[i].Transaction_Date__c > Date.today()) others.remove(i);
}
insert others;

System.debug('Datos de ejemplo cargados: ' + clients.size() + ' clientes, ' + appointments.size() + ' citas, '
    + incomes.size() + ' ingresos por servicio, ' + others.size() + ' gastos/ventas.');
