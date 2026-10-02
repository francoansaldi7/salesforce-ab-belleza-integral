// Tests for the record-triggered flows of AB Belleza Integral:
// Cita_Crear_Transaccion (one service income per completed appointment),
// Cita_Verificar_Conflicto (no two active appointments at the same time) and
// Cliente_Flag_VIP ($500.000 spent or 10 completed visits).
@IsTest
private class SalonAutomationTest {

    private static Integer minuteOffset = 0;

    private static Salon_Client__c newClient(String name) {
        Salon_Client__c client = new Salon_Client__c(Full_Name__c = name);
        insert client;
        return client;
    }

    // Each appointment gets a distinct time so the double-booking check doesn't interfere.
    private static Salon_Appointment__c newAppointment(Id clientId, String status, Decimal total, Decimal paid) {
        minuteOffset += 30;
        return new Salon_Appointment__c(
            Client__c           = clientId,
            Appointment_Date__c = DateTime.newInstance(Date.today().addDays(1), Time.newInstance(9, 0, 0, 0)).addMinutes(minuteOffset),
            Status__c           = status,
            Total_Amount__c     = total,
            Amount_Paid__c      = paid,
            Payment_Method__c   = 'Efectivo'
        );
    }

    private static List<Salon_Transaction__c> serviceIncomes(Id appointmentId) {
        return [
            SELECT Amount__c, Transaction_Type__c, Transaction_Date__c
            FROM Salon_Transaction__c
            WHERE Related_Appointment__c = :appointmentId AND Category__c = 'Ingreso por Servicio'
        ];
    }

    // ─── Cita_Crear_Transaccion ───────────────────────────────────────────────

    @IsTest
    static void completingAnAppointment_recordsOneIncomeWithTheAmountPaid() {
        Salon_Client__c client = newClient('Ana Torres');
        Salon_Appointment__c appt = newAppointment(client.Id, 'Programada', 50000, 45000);
        insert appt;
        Assert.areEqual(0, serviceIncomes(appt.Id).size(), 'Una cita programada no genera ingreso');

        Test.startTest();
        appt.Status__c = 'Completada';
        update appt;
        Test.stopTest();

        List<Salon_Transaction__c> incomes = serviceIncomes(appt.Id);
        Assert.areEqual(1, incomes.size());
        Assert.areEqual(45000, incomes[0].Amount__c, 'El ingreso usa el Monto Pagado');
        Assert.areEqual('Ingreso', incomes[0].Transaction_Type__c);
        Assert.areEqual(Date.today(), incomes[0].Transaction_Date__c);
        Assert.areEqual(Date.today(), [SELECT Last_Visit_Date__c FROM Salon_Client__c WHERE Id = :client.Id].Last_Visit_Date__c);
    }

    @IsTest
    static void creatingAnAppointmentAlreadyCompleted_recordsIncome() {
        Salon_Client__c client = newClient('Bruno Díaz');

        Test.startTest();
        Salon_Appointment__c appt = newAppointment(client.Id, 'Completada', 30000, null);
        insert appt;
        Test.stopTest();

        List<Salon_Transaction__c> incomes = serviceIncomes(appt.Id);
        Assert.areEqual(1, incomes.size(), 'Una cita creada ya completada también registra su ingreso');
        Assert.areEqual(30000, incomes[0].Amount__c, 'Sin pago cargado, el Monto Pagado toma el Monto Total');
    }

    @IsTest
    static void editingACompletedAppointment_doesNotDuplicateIncome() {
        Salon_Client__c client = newClient('Carla Ruiz');
        Salon_Appointment__c appt = newAppointment(client.Id, 'Completada', 20000, 20000);
        insert appt;

        Test.startTest();
        appt.Notes__c = 'Se agregó una nota después de completar';
        update appt;
        Test.stopTest();

        Assert.areEqual(1, serviceIncomes(appt.Id).size());
    }

    @IsTest
    static void unCompletingAnAppointment_removesItsIncome_andRecompletingRecordsItOnce() {
        Salon_Client__c client = newClient('Diego Sosa');
        Salon_Appointment__c appt = newAppointment(client.Id, 'Completada', 40000, 40000);
        insert appt;

        Test.startTest();
        appt.Status__c = 'Cancelada';
        update appt;
        Assert.areEqual(0, serviceIncomes(appt.Id).size(), 'Al cancelar una cita completada se elimina su ingreso');

        appt.Status__c = 'Completada';
        update appt;
        Test.stopTest();

        Assert.areEqual(1, serviceIncomes(appt.Id).size(), 'Volver a completarla no duplica el ingreso');
    }

    @IsTest
    static void completingAnAppointmentThatAlreadyHasIncome_doesNotAddAnother() {
        Salon_Client__c client = newClient('Elena Vega');
        Salon_Appointment__c appt = newAppointment(client.Id, 'En Progreso', 60000, 60000);
        insert appt;
        insert new Salon_Transaction__c(
            Transaction_Type__c    = 'Ingreso',
            Category__c            = 'Ingreso por Servicio',
            Amount__c              = 60000,
            Transaction_Date__c    = Date.today(),
            Related_Appointment__c = appt.Id
        );

        Test.startTest();
        appt.Status__c = 'Completada';
        update appt;
        Test.stopTest();

        Assert.areEqual(1, serviceIncomes(appt.Id).size());
    }

    @IsTest
    static void productSaleTransactions_areNotTouchedWhenAnAppointmentIsCancelled() {
        Salon_Client__c client = newClient('Flor Medina');
        Salon_Appointment__c appt = newAppointment(client.Id, 'Completada', 10000, 10000);
        insert appt;
        insert new Salon_Transaction__c(
            Transaction_Type__c    = 'Ingreso',
            Category__c            = 'Venta de Producto',
            Amount__c              = 5000,
            Transaction_Date__c    = Date.today(),
            Related_Appointment__c = appt.Id
        );

        Test.startTest();
        appt.Status__c = 'Cancelada';
        update appt;
        Test.stopTest();

        Assert.areEqual(1, [SELECT COUNT() FROM Salon_Transaction__c WHERE Related_Appointment__c = :appt.Id AND Category__c = 'Venta de Producto']);
    }

    // ─── Cita_Verificar_Conflicto ─────────────────────────────────────────────

    @IsTest
    static void bookingTheSameTimeTwice_isBlockedWithAClearMessage() {
        Salon_Client__c client = newClient('Gabi Luna');
        Salon_Appointment__c first = newAppointment(client.Id, 'Programada', 10000, null);
        insert first;

        Salon_Appointment__c second = newAppointment(client.Id, 'Programada', 10000, null);
        second.Appointment_Date__c = first.Appointment_Date__c;

        Test.startTest();
        try {
            insert second;
            Assert.fail('No se deben permitir dos citas en el mismo horario');
        } catch (DmlException e) {
            Assert.isTrue(e.getMessage().contains('Ya existe una cita programada para este horario. Por favor, elegí otro horario.'), e.getMessage());
        }
        Test.stopTest();
    }

    @IsTest
    static void aCancelledAppointment_doesNotBlockItsTimeSlot() {
        Salon_Client__c client = newClient('Hugo Paz');
        Salon_Appointment__c cancelled = newAppointment(client.Id, 'Cancelada', 10000, null);
        insert cancelled;

        Salon_Appointment__c rebooked = newAppointment(client.Id, 'Programada', 10000, null);
        rebooked.Appointment_Date__c = cancelled.Appointment_Date__c;

        Test.startTest();
        insert rebooked;
        Test.stopTest();

        Assert.isNotNull(rebooked.Id);
    }

    // ─── Cliente_Flag_VIP ─────────────────────────────────────────────────────

    @IsTest
    static void spendingAtLeast500000_makesTheClientVip() {
        Salon_Client__c client = newClient('Inés Rey');

        Test.startTest();
        insert newAppointment(client.Id, 'Completada', 500000, 500000);
        Test.stopTest();

        Assert.isTrue([SELECT VIP_Client__c FROM Salon_Client__c WHERE Id = :client.Id].VIP_Client__c);
    }

    @IsTest
    static void spendingLessThan500000_inFewVisits_isNotVip() {
        Salon_Client__c client = newClient('Juan Gil');

        Test.startTest();
        insert new List<Salon_Appointment__c>{
            newAppointment(client.Id, 'Completada', 45000, 45000),
            newAppointment(client.Id, 'Completada', 38000, 38000)
        };
        Test.stopTest();

        Assert.isFalse([SELECT VIP_Client__c FROM Salon_Client__c WHERE Id = :client.Id].VIP_Client__c);
    }

    @IsTest
    static void tenCompletedVisits_makesTheClientVip() {
        Salon_Client__c client = newClient('Karina Sol');
        List<Salon_Appointment__c> visits = new List<Salon_Appointment__c>();
        for (Integer i = 0; i < 10; i++) {
            visits.add(newAppointment(client.Id, 'Completada', 1000, 1000));
        }

        Test.startTest();
        insert visits;
        Test.stopTest();

        Assert.isTrue([SELECT VIP_Client__c FROM Salon_Client__c WHERE Id = :client.Id].VIP_Client__c);
    }
}
