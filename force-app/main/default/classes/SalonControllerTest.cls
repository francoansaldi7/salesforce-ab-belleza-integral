// Unit tests for SalonController. Each Apex method in the controller is covered
// by at least one test. Shared data is created in @TestSetup to minimise DML operations.
@IsTest
private class SalonControllerTest {

    /**
     * María: a dormant client with an open appointment today and one in the future.
     * Lucía: has a completed appointment, which makes the Cita_Crear_Transaccion flow
     * record an 800 income today and set her last visit (so she is NOT dormant).
     * Plus two manual transactions (income 1200, expense 300) and one low-stock product.
     */
    @TestSetup
    static void setupTestData() {
        // Single client used across all test methods
        Salon_Client__c client = new Salon_Client__c(
            Full_Name__c = 'María García',
            Phone__c     = '555-1234',
            Email__c     = 'maria@example.com'
        );
        Salon_Client__c recentClient = new Salon_Client__c(Full_Name__c = 'Lucía Pérez');
        insert new List<Salon_Client__c>{ client, recentClient };

        // Three appointments in different states to cover multiple test scenarios
        DateTime now = DateTime.now();
        List<Salon_Appointment__c> appts = new List<Salon_Appointment__c>{
            new Salon_Appointment__c(
                Client__c          = client.Id,
                Appointment_Date__c = now,           // today → returned by getTodayAppointments
                Status__c          = 'Programada',
                Total_Amount__c    = 500,
                Payment_Method__c  = 'Efectivo'
            ),
            new Salon_Appointment__c(
                Client__c          = recentClient.Id,
                Appointment_Date__c = now.addDays(-10), // past, already completed
                Status__c          = 'Completada',
                Total_Amount__c    = 800,
                Payment_Method__c  = 'Transferencia'
            ),
            new Salon_Appointment__c(
                Client__c          = client.Id,
                Appointment_Date__c = now.addDays(5),  // future, still open
                Status__c          = 'Confirmada',
                Total_Amount__c    = 300,
                Payment_Method__c  = 'Tarjeta'
            )
        };
        insert appts;

        // Income 1200 − Expense 300 = balance 900 (tested in testGetMonthlyBalance)
        List<Salon_Transaction__c> txns = new List<Salon_Transaction__c>{
            new Salon_Transaction__c(
                Transaction_Type__c = 'Ingreso',
                Category__c         = 'Ingreso por Servicio',
                Amount__c           = 1200,
                Transaction_Date__c = Date.today()
            ),
            new Salon_Transaction__c(
                Transaction_Type__c = 'Gasto',
                Category__c         = 'Insumos',
                Amount__c           = 300,
                Transaction_Date__c = Date.today()
            )
        };
        insert txns;

        // Stock 2 ≤ Alert 5 → this product should appear in getLowStockCount / getLowStockProducts
        Salon_Product__c prod = new Salon_Product__c(
            Name              = 'Tinte Rubio',
            Stock_Quantity__c = 2,
            Low_Stock_Alert__c = 5
        );
        insert prod;
    }

    // ─── getTodayAppointments ─────────────────────────────────────────────────

    /** Today's "Programada" appointment must be returned and include the related client name. */
    @IsTest
    static void testGetTodayAppointments_returnsAppointmentsForToday() {
        Test.startTest();
        List<Salon_Appointment__c> result = SalonController.getTodayAppointments();
        Test.stopTest();

        Assert.isNotNull(result);
        Assert.isTrue(result.size() >= 1, 'Debe haber al menos 1 cita para hoy');
        // Verify the relationship field was queried (Client__r.Full_Name__c)
        Assert.isNotNull(result[0].Client__r.Full_Name__c);
    }

    // ─── getMonthlyBalance ───────────────────────────────────────────────────

    /** Income 1200 + 800 (auto-created for the completed appointment) minus expense 300 = 1700. */
    @IsTest
    static void testGetMonthlyBalance_returnsIncomeMinusExpenses() {
        Test.startTest();
        Decimal balance = SalonController.getMonthlyBalance();
        Test.stopTest();

        Assert.areEqual(1700, balance, 'El balance mensual debe ser 1700 (1200 + 800 ingresos - 300 gastos)');
    }

    // ─── getOpenAppointmentsCount ─────────────────────────────────────────────

    /** Today's "Programada" + the future "Confirmada" = 2; completed and past ones are excluded. */
    @IsTest
    static void testGetOpenAppointmentsCount_returnsScheduledAndConfirmed() {
        Test.startTest();
        Integer count = SalonController.getOpenAppointmentsCount();
        Test.stopTest();

        Assert.areEqual(2, count, 'Deben haber 2 citas abiertas (Programada + Confirmada)');
    }

    // ─── getLowStockCount ─────────────────────────────────────────────────────

    /** The "Tinte Rubio" product (stock 2 ≤ alert 5) must be counted. */
    @IsTest
    static void testGetLowStockCount_returnsProductsBelowThreshold() {
        Test.startTest();
        Integer count = SalonController.getLowStockCount();
        Test.stopTest();

        Assert.areEqual(1, count, 'Debe haber 1 producto con bajo stock');
    }

    // ─── getDormantClientsCount ───────────────────────────────────────────────

    /**
     * The test client has Last_Visit_Date__c = null (the Flow that updates it doesn't
     * run in test context), so it must be counted as dormant.
     */
    @IsTest
    static void testGetDormantClientsCount_returnsClientsWithNoRecentVisit() {
        Test.startTest();
        Integer count = SalonController.getDormantClientsCount();
        Test.stopTest();

        // El cliente tiene Last_Visit_Date__c null (aún no lo ha actualizado el flow)
        Assert.isTrue(count >= 1, 'Debe haber al menos 1 cliente inactivo');
    }

    // ─── getClientCard ────────────────────────────────────────────────────────

    /** The returned client record must match the name and phone set in @TestSetup. */
    @IsTest
    static void testGetClientCard_returnsCorrectClient() {
        Salon_Client__c client = [SELECT Id FROM Salon_Client__c WHERE Full_Name__c = 'María García' LIMIT 1];

        Test.startTest();
        Salon_Client__c result = SalonController.getClientCard(client.Id);
        Test.stopTest();

        Assert.areEqual('María García', result.Full_Name__c);
        Assert.areEqual('555-1234', result.Phone__c);
    }

    // ─── getClientRecentAppointments ─────────────────────────────────────────

    /** Must return between 1 and 5 appointments (LIMIT 5 in the query). */
    @IsTest
    static void testGetClientRecentAppointments_returnsUpToFive() {
        Salon_Client__c client = [SELECT Id FROM Salon_Client__c WHERE Full_Name__c = 'María García' LIMIT 1];

        Test.startTest();
        List<Salon_Appointment__c> result = SalonController.getClientRecentAppointments(client.Id);
        Test.stopTest();

        Assert.isNotNull(result);
        Assert.isTrue(result.size() <= 5, 'No debe retornar más de 5 citas'); // LIMIT 5 enforced
        Assert.isTrue(result.size() >= 1);
    }

    // ─── updateAppointmentStatus ──────────────────────────────────────────────

    /** Status must be persisted to the database after the call. */
    @IsTest
    static void testUpdateAppointmentStatus_updatesStatus() {
        Salon_Appointment__c appt = [
            SELECT Id FROM Salon_Appointment__c
            WHERE Status__c = 'Programada' LIMIT 1
        ];

        Test.startTest();
        SalonController.updateAppointmentStatus(appt.Id, 'Confirmada');
        Test.stopTest();

        // Re-query to verify the DML actually committed
        Salon_Appointment__c updated = [SELECT Status__c FROM Salon_Appointment__c WHERE Id = :appt.Id];
        Assert.areEqual('Confirmada', updated.Status__c);
    }

    /** Passing an empty string must throw an AuraHandledException. */
    @IsTest
    static void testUpdateAppointmentStatus_emptyStatus_throwsException() {
        Salon_Appointment__c appt = [
            SELECT Id FROM Salon_Appointment__c
            WHERE Status__c = 'Programada' LIMIT 1
        ];

        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            SalonController.updateAppointmentStatus(appt.Id, '');
        } catch (Exception e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        Assert.isTrue(exceptionThrown);
    }

    // ─── getPendingAppointments ───────────────────────────────────────────────

    /** Must return only open-status appointments (Programada, Confirmada, En Progreso). */
    @IsTest
    static void testGetPendingAppointments_returnsOpenAppointments() {
        Test.startTest();
        List<Salon_Appointment__c> result = SalonController.getPendingAppointments();
        Test.stopTest();

        Assert.isNotNull(result);
        for (Salon_Appointment__c appt : result) {
            Assert.isTrue(
                appt.Status__c == 'Programada' || appt.Status__c == 'Confirmada' || appt.Status__c == 'En Progreso',
                'Solo deben retornarse citas con estado abierto'
            );
        }
    }

    // ─── getLowStockProducts ──────────────────────────────────────────────────

    /** "Tinte Rubio" (stock 2 ≤ alert 5) must appear in the result list. */
    @IsTest
    static void testGetLowStockProducts_returnsProductsBelowThreshold() {
        Test.startTest();
        List<Salon_Product__c> result = SalonController.getLowStockProducts();
        Test.stopTest();

        Assert.isNotNull(result);
        Assert.areEqual(1, result.size(), 'Debe haber 1 producto con bajo stock');
        Assert.areEqual('Tinte Rubio', result[0].Name);
    }

    // ─── getDormantClients ────────────────────────────────────────────────────

    /** Test client has null Last_Visit_Date__c so must be returned as dormant. */
    @IsTest
    static void testGetDormantClients_returnsClientsWithNoRecentVisit() {
        Test.startTest();
        List<Salon_Client__c> result = SalonController.getDormantClients();
        Test.stopTest();

        Assert.isNotNull(result);
        Assert.isTrue(result.size() >= 1, 'Debe haber al menos 1 cliente inactivo');
        Assert.isNotNull(result[0].Full_Name__c);
    }

    // ─── getProductImageVersionId ─────────────────────────────────────────────

    /** Product with no files attached must return null. */
    @IsTest
    static void testGetProductImageVersionId_noFiles_returnsNull() {
        Salon_Product__c prod = [SELECT Id FROM Salon_Product__c WHERE Name = 'Tinte Rubio' LIMIT 1];

        Test.startTest();
        String result = SalonController.getProductImageVersionId(prod.Id);
        Test.stopTest();

        Assert.isNull(result, 'Producto sin archivos adjuntos debe retornar null');
    }

    // ─── getClientCard — negative case ───────────────────────────────────────

    /** Passing null clientId must throw AuraHandledException. */
    @IsTest
    static void testGetClientCard_nullId_throwsException() {
        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            SalonController.getClientCard(null);
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        Assert.isTrue(exceptionThrown, 'clientId nulo debe lanzar AuraHandledException');
    }

    // ─── updateAppointmentStatus — invalid status ─────────────────────────────

    /** Passing an unrecognised status value must throw AuraHandledException. */
    @IsTest
    static void testUpdateAppointmentStatus_invalidStatus_throwsException() {
        Salon_Appointment__c appt = [
            SELECT Id FROM Salon_Appointment__c WHERE Status__c = 'Programada' LIMIT 1
        ];

        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            SalonController.updateAppointmentStatus(appt.Id, 'EstadoFalso');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        Assert.isTrue(exceptionThrown, 'Estado inválido debe lanzar AuraHandledException');
    }

    @IsTest
    static void testGetMonthlyBalanceDetail_returnsCorrectTotals() {
        // @TestSetup: income 1200 (manual) + 800 (auto, completed appointment), expense 300, all today.
        Integer year  = Date.today().year();
        Integer month = Date.today().month();

        Test.startTest();
        SalonController.MonthlyBalanceDetail result =
            SalonController.getMonthlyBalanceDetail(year, month);
        Test.stopTest();

        Assert.areEqual(2000, result.income,   'Income should be 2000');
        Assert.areEqual(300,  result.expenses,  'Expenses should be 300');
        Assert.areEqual(1700, result.balance,   'Balance should be 1700');
        Assert.areEqual(3,    result.transactions.size(), 'Should return all three transactions');
    }

    @IsTest
    static void testGetMonthlyBalanceDetail_emptyMonth_returnsZeros() {
        // Use a future month guaranteed to have no transactions
        Integer year  = Date.today().year() + 1;
        Integer month = 1;

        Test.startTest();
        SalonController.MonthlyBalanceDetail result =
            SalonController.getMonthlyBalanceDetail(year, month);
        Test.stopTest();

        Assert.areEqual(0, result.income,   'Income should be 0 for empty month');
        Assert.areEqual(0, result.expenses,  'Expenses should be 0 for empty month');
        Assert.areEqual(0, result.balance,   'Balance should be 0 for empty month');
        Assert.isTrue(result.transactions.isEmpty(), 'No transactions for empty month');
    }

    @IsTest
    static void testGetMonthlyBalanceDetail_invalidMonth_throwsException() {
        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            SalonController.getMonthlyBalanceDetail(2026, 13);
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        Assert.isTrue(exceptionThrown, 'Month 13 should throw AuraHandledException');
    }

    @IsTest
    static void testGetMonthlyBalanceDetail_nullYear_throwsException() {
        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            SalonController.getMonthlyBalanceDetail(null, 1);
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        Assert.isTrue(exceptionThrown, 'Null year should throw AuraHandledException');
    }

    // ─── Mejoras: totales completos, Próximas y mensajes en español ──────────

    /** Totals must include every transaction of the month, even beyond the 200 shown in the list. */
    @IsTest
    static void testGetMonthlyBalanceDetail_totalsIncludeMoreThan200Transactions() {
        Date firstOfNextMonth = Date.today().toStartOfMonth().addMonths(1);
        List<Salon_Transaction__c> txns = new List<Salon_Transaction__c>();
        for (Integer i = 0; i < 210; i++) {
            txns.add(new Salon_Transaction__c(
                Transaction_Type__c = 'Ingreso',
                Category__c         = 'Venta de Producto',
                Amount__c           = 100,
                Transaction_Date__c = firstOfNextMonth
            ));
        }
        insert txns;

        Test.startTest();
        SalonController.MonthlyBalanceDetail result =
            SalonController.getMonthlyBalanceDetail(firstOfNextMonth.year(), firstOfNextMonth.month());
        Test.stopTest();

        Assert.areEqual(21000, result.income, 'Los totales deben incluir los 210 movimientos');
        Assert.areEqual(200, result.transactions.size(), 'La lista visible se limita a 200');
    }

    /** Open appointments in the past (never closed) no longer appear under Próximas. */
    @IsTest
    static void testGetPendingAppointments_excludesPastOpenAppointments() {
        Salon_Client__c client = [SELECT Id FROM Salon_Client__c WHERE Full_Name__c = 'María García' LIMIT 1];
        Salon_Appointment__c stale = new Salon_Appointment__c(
            Client__c           = client.Id,
            Appointment_Date__c = DateTime.now().addDays(-3),
            Status__c           = 'Programada',
            Total_Amount__c     = 100,
            Payment_Method__c   = 'Efectivo'
        );
        insert stale;

        Test.startTest();
        List<Salon_Appointment__c> pending = SalonController.getPendingAppointments();
        Integer openCount = SalonController.getOpenAppointmentsCount();
        Test.stopTest();

        for (Salon_Appointment__c appt : pending) {
            Assert.areNotEqual(stale.Id, appt.Id, 'Una cita pasada sin cerrar no debe figurar en Próximas');
        }
        Assert.areEqual(pending.size(), openCount, 'El KPI Citas Abiertas debe coincidir con la lista Próximas');
    }

    /** "En Progreso" appointments count as open, both in the list and in the KPI. */
    @IsTest
    static void testGetOpenAppointmentsCount_includesInProgress() {
        Salon_Appointment__c appt = [SELECT Id FROM Salon_Appointment__c WHERE Status__c = 'Confirmada' LIMIT 1];
        appt.Status__c = 'En Progreso';
        update appt;

        Test.startTest();
        Integer count = SalonController.getOpenAppointmentsCount();
        Test.stopTest();

        Assert.areEqual(2, count);
    }

    /** Error messages shown to the user are in Spanish. */
    @IsTest
    static void testGetClientCard_nullId_messageInSpanish() {
        try {
            SalonController.getClientCard(null);
            Assert.fail('Debe lanzar una excepción');
        } catch (AuraHandledException e) {
            Assert.areEqual('Se requiere el ID del cliente.', e.getMessage());
        }
    }

    // ─── Historial de citas y tarjeta de cliente ─────────────────────────────

    private static Salon_Client__c historyClient() {
        Salon_Client__c client = new Salon_Client__c(Full_Name__c = 'Romina Historial');
        insert client;
        List<Salon_Appointment__c> appts = new List<Salon_Appointment__c>();
        for (Integer i = 1; i <= 20; i++) {
            appts.add(new Salon_Appointment__c(
                Client__c           = client.Id,
                Appointment_Date__c = DateTime.newInstance(Date.today().addDays(-i), Time.newInstance(9, 15, 0, 0)),
                Status__c           = i <= 12 ? 'Completada' : (i <= 16 ? 'Cancelada' : 'No Asistió'),
                Total_Amount__c     = 10000,
                Amount_Paid__c      = 9000,
                Payment_Method__c   = 'Efectivo'
            ));
        }
        insert appts;
        return client;
    }

    @IsTest
    static void testGetAppointmentHistory_filtersPagesAndSummarizes() {
        historyClient();

        Test.startTest();
        SalonController.AppointmentHistory page1 = SalonController.getAppointmentHistory(
            new List<String>(), null, null, 'Historial', true, 1);
        SalonController.AppointmentHistory page2 = SalonController.getAppointmentHistory(
            new List<String>(), null, null, 'historial', true, 2);
        Test.stopTest();

        Assert.areEqual(20, page1.totalCount);
        Assert.areEqual(15, page1.records.size());
        Assert.areEqual(5, page2.records.size());
        Assert.areEqual(12, page1.countByStatus.get('Completada'));
        Assert.areEqual(4, page1.countByStatus.get('Cancelada'));
        Assert.areEqual(4, page1.countByStatus.get('No Asistió'));
        Assert.areEqual(108000, page1.totalBilled, 'Solo suma el Monto Pagado de las citas completadas');
        Assert.isTrue(page1.records[0].Appointment_Date__c > page1.records[1].Appointment_Date__c, 'Más recientes primero');
        Assert.areEqual('Romina Historial', page1.records[0].Client__r.Full_Name__c);
    }

    @IsTest
    static void testGetAppointmentHistory_statusDateAndSortFilters() {
        historyClient();

        Test.startTest();
        SalonController.AppointmentHistory cancelled = SalonController.getAppointmentHistory(
            new List<String>{ 'Cancelada', 'No Asistió' }, null, null, null, true, 1);
        SalonController.AppointmentHistory lastWeek = SalonController.getAppointmentHistory(
            new List<String>{ 'Completada' }, Date.today().addDays(-7), Date.today().addDays(-1), 'Romina', false, 1);
        Test.stopTest();

        Assert.areEqual(8, cancelled.totalCount);
        Assert.areEqual(0, cancelled.totalBilled, 'Sin citas completadas en el filtro, no hay monto');
        Assert.areEqual(7, lastWeek.totalCount);
        Assert.isTrue(lastWeek.records[0].Appointment_Date__c < lastWeek.records[1].Appointment_Date__c, 'Más antiguas primero');
    }

    @IsTest
    static void testGetAppointmentHistory_rejectsUnknownStatus() {
        try {
            SalonController.getAppointmentHistory(new List<String>{ 'Inventado' }, null, null, null, true, 1);
            Assert.fail('Debe rechazar estados desconocidos');
        } catch (AuraHandledException e) {
            Assert.areEqual('Estado no válido: Inventado', e.getMessage());
        }
    }

    @IsTest
    static void testGetClientCard_includesHealthAndInstagram() {
        Salon_Client__c client = new Salon_Client__c(
            Full_Name__c          = 'Noelia Ficha',
            Instagram__c          = '@ejemplo.ficha.ab.test',
            Medical_Conditions__c = 'Diabetes;Tiroides',
            Treatment_Protocol__c = 'Sesión 2 de 6'
        );
        insert client;

        Test.startTest();
        Salon_Client__c result = SalonController.getClientCard(client.Id);
        Test.stopTest();

        Assert.areEqual('@ejemplo.ficha.ab.test', result.Instagram__c);
        Assert.areEqual('Diabetes;Tiroides', result.Medical_Conditions__c);
        Assert.areEqual('Sesión 2 de 6', result.Treatment_Protocol__c);
    }
}
