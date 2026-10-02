/**
 * @description Controlador Apex para los componentes LWC de AB Belleza Integral.
 *              Provee datos para la página de inicio del salón: citas del día,
 *              métricas clave (KPIs) y tarjeta de cliente.
 * @author      AB Belleza Integral
 * @last modified on  : 03-27-2026
**/
public with sharing class SalonController {

    private static final Set<String> VALID_STATUSES = new Set<String>{
        'Programada', 'Confirmada', 'En Progreso', 'Completada', 'No Asistió', 'Cancelada'
    };

    // ─── Citas del Día ────────────────────────────────────────────────────────

    @AuraEnabled
    public static List<Salon_Appointment__c> getTodayAppointments() {
        Date today = Date.today();
        DateTime startOfDay = DateTime.newInstance(today, Time.newInstance(0, 0, 0, 0));
        DateTime endOfDay   = DateTime.newInstance(today, Time.newInstance(23, 59, 59, 999));

        return [
            SELECT Id, Name,
                   Appointment_Date__c,
                   Status__c,
                   Services__c,
                   Total_Amount__c,
                   Amount_Paid__c,
                   Payment_Method__c,
                   Client__c,
                   Client__r.Full_Name__c,
                   Client__r.Phone__c,
                   Client__r.Allergies_Notes__c,
                   Client__r.VIP_Client__c
            FROM Salon_Appointment__c
            WHERE Appointment_Date__c >= :startOfDay
              AND Appointment_Date__c <= :endOfDay
            WITH SECURITY_ENFORCED
            ORDER BY Appointment_Date__c ASC
            LIMIT 200
        ];
    }

    // Estados que cuentan como "cita abierta" en la lista Próximas y en el KPI Citas Abiertas.
    private static final List<String> OPEN_STATUSES = new List<String>{ 'Programada', 'Confirmada', 'En Progreso' };

    private static Datetime startOfToday() {
        return Datetime.newInstance(Date.today(), Time.newInstance(0, 0, 0, 0));
    }

    @AuraEnabled
    public static List<Salon_Appointment__c> getPendingAppointments() {
        Datetime fromToday = startOfToday();
        return [
            SELECT Id, Name,
                   Appointment_Date__c,
                   Status__c,
                   Services__c,
                   Total_Amount__c,
                   Amount_Paid__c,
                   Payment_Method__c,
                   Client__c,
                   Client__r.Full_Name__c,
                   Client__r.Phone__c,
                   Client__r.Allergies_Notes__c,
                   Client__r.VIP_Client__c
            FROM Salon_Appointment__c
            WHERE Status__c IN :OPEN_STATUSES
              AND Appointment_Date__c >= :fromToday
            WITH SECURITY_ENFORCED
            ORDER BY Appointment_Date__c ASC
            LIMIT 200
        ];
    }

    // ─── KPIs para el Panel de Inicio ─────────────────────────────────────────

    // Wrapper devuelto por getMonthlyBalanceDetail para transportar ingresos,
    // gastos, balance neto y la lista de transacciones del mes seleccionado.
    public class MonthlyBalanceDetail {
        @AuraEnabled public Decimal                    income       { get; set; }
        @AuraEnabled public Decimal                    expenses     { get; set; }
        @AuraEnabled public Decimal                    balance      { get; set; }
        @AuraEnabled public List<Salon_Transaction__c> transactions { get; set; }
    }

    @AuraEnabled
    public static MonthlyBalanceDetail getMonthlyBalanceDetail(Integer year, Integer month) {
        if (year == null || month == null || month < 1 || month > 12
                || year < 2000 || year > 2100) {
            throw auraError('Año y mes requeridos y válidos.');
        }
        Date startDate = Date.newInstance(year, month, 1);
        Date endDate   = startDate.addMonths(1).addDays(-1);

        MonthlyBalanceDetail detail = new MonthlyBalanceDetail();
        detail.income   = 0;
        detail.expenses = 0;
        for (AggregateResult ar : [
            SELECT Transaction_Type__c txType, SUM(Amount__c) total
            FROM Salon_Transaction__c
            WHERE Transaction_Date__c >= :startDate
              AND Transaction_Date__c <= :endDate
            WITH SECURITY_ENFORCED
            GROUP BY Transaction_Type__c
        ]) {
            Decimal total = (Decimal) ar.get('total');
            if (total == null) continue;
            if ((String) ar.get('txType') == 'Ingreso')    detail.income   += total;
            else if ((String) ar.get('txType') == 'Gasto') detail.expenses += total;
        }
        detail.balance = detail.income - detail.expenses;

        // La lista visible se limita a 200 movimientos; los totales de arriba incluyen todos.
        detail.transactions = [
            SELECT Id, Name, Transaction_Type__c, Amount__c,
                   Transaction_Date__c, Category__c, Description__c,
                   Payment_Method__c
            FROM Salon_Transaction__c
            WHERE Transaction_Date__c >= :startDate
              AND Transaction_Date__c <= :endDate
            WITH SECURITY_ENFORCED
            ORDER BY Transaction_Date__c DESC
            LIMIT 200
        ];
        return detail;
    }

    @AuraEnabled
    public static Decimal getMonthlyBalance() {
        Date startOfMonth = Date.today().toStartOfMonth();
        Decimal balance = 0;
        for (AggregateResult ar : [
            SELECT Transaction_Type__c txType, SUM(Amount__c) total
            FROM Salon_Transaction__c
            WHERE Transaction_Date__c >= :startOfMonth
            WITH SECURITY_ENFORCED
            GROUP BY Transaction_Type__c
        ]) {
            Decimal total = (Decimal) ar.get('total');
            if (total == null) continue;
            if ((String) ar.get('txType') == 'Ingreso') balance += total;
            else if ((String) ar.get('txType') == 'Gasto') balance -= total;
        }
        return balance;
    }

    @AuraEnabled
    public static Integer getOpenAppointmentsCount() {
        Datetime fromToday = startOfToday();
        return [
            SELECT COUNT()
            FROM Salon_Appointment__c
            WHERE Status__c IN :OPEN_STATUSES
              AND Appointment_Date__c >= :fromToday
            WITH SECURITY_ENFORCED
        ];
    }

    @AuraEnabled
    public static Integer getLowStockCount() {
        return getLowStockProducts().size();
    }

    @AuraEnabled
    public static Integer getDormantClientsCount() {
        Date threshold = Date.today().addDays(-60);
        return [
            SELECT COUNT()
            FROM Salon_Client__c
            WHERE Last_Visit_Date__c < :threshold
               OR Last_Visit_Date__c = null
            WITH SECURITY_ENFORCED
        ];
    }

    @AuraEnabled
    public static List<Salon_Product__c> getLowStockProducts() {
        List<Salon_Product__c> result = new List<Salon_Product__c>();
        for (Salon_Product__c p : [
            SELECT Name, Category__c, Stock_Quantity__c, Low_Stock_Alert__c
            FROM Salon_Product__c
            WHERE Low_Stock_Alert__c > 0
            WITH SECURITY_ENFORCED
            ORDER BY Name ASC
            LIMIT 500
        ]) {
            if (p.Stock_Quantity__c != null && p.Stock_Quantity__c <= p.Low_Stock_Alert__c) {
                result.add(p);
            }
        }
        return result;
    }

    @AuraEnabled
    public static List<Salon_Client__c> getDormantClients() {
        Date threshold = Date.today().addDays(-60);
        return [
            SELECT Full_Name__c, Phone__c, Last_Visit_Date__c
            FROM Salon_Client__c
            WHERE Last_Visit_Date__c < :threshold
               OR Last_Visit_Date__c = null
            WITH SECURITY_ENFORCED
            ORDER BY Last_Visit_Date__c ASC NULLS FIRST
            LIMIT 200
        ];
    }

    // ─── Tarjeta de Cliente ───────────────────────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static Salon_Client__c getClientCard(Id clientId) {
        if (clientId == null) {
            throw auraError('Se requiere el ID del cliente.');
        }
        List<Salon_Client__c> clients = [
            SELECT Id, Name, Full_Name__c, Phone__c, Email__c,
                   Birthday__c, Preferred_Services__c,
                   Allergies_Notes__c, Total_Visits__c,
                   Total_Spent__c, VIP_Client__c, Last_Visit_Date__c
            FROM Salon_Client__c
            WHERE Id = :clientId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
        if (clients.isEmpty()) {
            throw auraError('Cliente no encontrado.');
        }
        return clients[0];
    }

    @AuraEnabled(cacheable=true)
    public static List<Salon_Appointment__c> getClientRecentAppointments(Id clientId) {
        return [
            SELECT Id, Name, Appointment_Date__c, Status__c,
                   Services__c, Total_Amount__c
            FROM Salon_Appointment__c
            WHERE Client__c = :clientId
            WITH SECURITY_ENFORCED
            ORDER BY Appointment_Date__c DESC
            LIMIT 5
        ];
    }

    // ─── Imagen de Producto ───────────────────────────────────────────────────

    @AuraEnabled
    public static String getProductImageVersionId(Id productId) {
        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :productId
            WITH SECURITY_ENFORCED
            ORDER BY SystemModstamp DESC
            LIMIT 50
        ];

        if (links.isEmpty()) return null;

        Set<Id> docIds = new Set<Id>();
        for (ContentDocumentLink l : links) {
            docIds.add(l.ContentDocumentId);
        }

        List<ContentVersion> versions = [
            SELECT Id
            FROM ContentVersion
            WHERE ContentDocumentId IN :docIds
              AND IsLatest = true
              AND FileType IN ('JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'BMP')
            WITH SECURITY_ENFORCED
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];

        return versions.isEmpty() ? null : versions[0].Id;
    }

    // ─── Actualizar estado de cita ────────────────────────────────────────────

    @AuraEnabled
    public static void updateAppointmentStatus(Id appointmentId, String newStatus) {
        if (String.isBlank(newStatus)) {
            throw auraError('El estado no puede estar vacío.');
        }
        if (!VALID_STATUSES.contains(newStatus)) {
            throw auraError('Estado no válido: ' + newStatus);
        }
        try {
            update new Salon_Appointment__c(
                Id = appointmentId,
                Status__c = newStatus
            );
        } catch (DmlException e) {
            throw auraError(e.getDmlMessage(0));
        }
    }

    // AuraHandledException solo expone el texto a getMessage() si además se llama a setMessage().
    private static AuraHandledException auraError(String message) {
        AuraHandledException error = new AuraHandledException(message);
        error.setMessage(message);
        return error;
    }
}
