namespace Finance;
public static class Validation
{
    public static List<string> Check(FinanceState s)
    {
        if (s.Settings is null || HasMissingRecords(s.Cards) || HasMissingRecords(s.Categories) ||
            HasMissingRecords(s.Expenses) || HasMissingRecords(s.Incomes) || HasMissingRecords(s.Subscriptions) ||
            HasMissingRecords(s.Installments) || HasMissingRecords(s.Payments) ||
            HasMissingRecords(s.CashPayments ?? []) || HasMissingRecords(s.SalaryPeriods ?? []))
            return ["Eksik veya geçersiz veri yapısı."];

        var errors = new List<string>();
        void Require(bool ok, string message) { if (!ok) errors.Add(message); }
        bool Money(decimal v, bool zero = false) => v >= (zero ? 0 : 0.01m) && v <= 1_000_000_000 && decimal.Round(v, 2) == v;
        bool Date(DateOnly d) => d.Year is >= 2000 and <= 2100;
        var cards = s.Cards.Select(c => c.Id).ToHashSet(); var categories = s.Categories.Select(c => c.Id).ToHashSet();
        foreach (var list in new[] { s.Cards.Select(x=>x.Id), s.Categories.Select(x=>x.Id), s.Expenses.Select(x=>x.Id), s.Incomes.Select(x=>x.Id), s.Subscriptions.Select(x=>x.Id), s.Installments.Select(x=>x.Id), s.Payments.Select(x=>x.Id), (s.CashPayments??[]).Select(x=>x.Id) })
            Require(list.All(x => !string.IsNullOrWhiteSpace(x) && x.Length <= 100) && list.Distinct().Count() == list.Count(), "Kayıt kimlikleri boş veya tekrarlı olamaz.");
        Require(Money(s.Settings.Salary,true) && Money(s.Settings.SavingsTarget,true) && Date(s.Settings.TrackingStart), "Ayarlar geçersiz.");
        foreach(var p in s.SalaryPeriods ?? []) Require(Date(p.Start) && p.Start.Day==1 && Money(p.Amount,true), "Maaş dönemi geçersiz.");
        Require((s.SalaryPeriods??[]).Select(x=>x.Start).Distinct().Count()==(s.SalaryPeriods?.Count??0), "Maaş dönemleri tekrarlı olamaz.");
        foreach(var c in s.Categories) Require(!string.IsNullOrWhiteSpace(c.Name) && Money(c.MonthlyLimit,true), "Kategori / bütçe geçersiz.");
        foreach(var c in s.Cards)
        {
            Require(!string.IsNullOrWhiteSpace(c.Name) && c.ClosingDay is >= 1 and <= 31 && c.DueDays is >= 0 and <= 60, "Kart günleri geçersiz.");
            var overrides = c.StatementDates ?? [];
            if (HasMissingRecords(overrides))
            {
                errors.Add("Kart ekstre tarihleri geçersiz veya dönem tekrarlı.");
                continue;
            }
            Require(overrides.All(dates => Date(dates.ClosingDate) && Date(dates.DueDate) &&
                dates.DueDate.DayNumber - dates.ClosingDate.DayNumber is >= 0 and <= 60) &&
                overrides.Select(dates => (dates.ClosingDate.Year, dates.ClosingDate.Month)).Distinct().Count() == overrides.Count,
                "Kart ekstre tarihleri geçersiz veya dönem tekrarlı.");
        }
        foreach(var e in s.Expenses) Require(Date(e.Date) && Money(e.Amount) && categories.Contains(e.CategoryId) &&
            new[]{"Kredi Kartı","Banka Kartı","Nakit","Havale/EFT","Diğer"}.Contains(e.Method) &&
            (e.Method == "Kredi Kartı" ? e.CardId != null && cards.Contains(e.CardId) : e.CardId == null) && !(e.IsTransfer && e.CardId!=null), "Harcama tarihi, tutarı, kategorisi veya kartı geçersiz.");
        foreach(var i in s.Incomes) Require(Date(i.Date) && Money(i.Amount) && !(i.IsSalary && i.IsBorrowing) && !(i.IsTransfer && (i.IsSalary || i.IsBorrowing)), "Gelir geçersiz; transfer, maaş ve borçlanma birbiriyle çelişemez.");
        foreach(var p in s.Subscriptions) Require(!string.IsNullOrWhiteSpace(p.Name) && Money(p.Amount) && Date(p.Start) &&
            p.PaymentDay is >= 1 and <= 31 && (p.End == null || Date(p.End.Value) && p.End >= p.Start) && (p.CardId == null || cards.Contains(p.CardId)), "Abonelik geçersiz.");
        foreach(var p in s.Installments) Require(!string.IsNullOrWhiteSpace(p.Name) && Money(p.Amount) && Date(p.FirstDate) &&
            p.Count is >= 1 and <= 600 &&
            p.ManualPaid >= 0 && p.ManualPaid <= p.Count &&
            (p.FirstAmount is null || Money(p.FirstAmount.Value)) && (p.LastAmount is null || Money(p.LastAmount.Value)) &&
            (p.Count > 1 || p.FirstAmount is null || p.LastAmount is null || p.FirstAmount == p.LastAmount) &&
            (p.CardId == null || cards.Contains(p.CardId)), "Taksit planı geçersiz.");
        foreach(var p in s.Payments) Require(cards.Contains(p.CardId) && Date(p.ClosingDate) && (p.PaidOn == null || Date(p.PaidOn.Value)) && (p.Amount==null || Money(p.Amount.Value,true)), "Ödeme geçersiz.");
        foreach(var p in s.CashPayments??[]) Require(Date(p.DueDate) && Date(p.PaidOn) && Money(p.Amount) && p.Kind is "Abonelik" or "Taksit", "Nakit ödeme geçersiz.");
        Require(s.Payments.Select(p => (p.CardId,p.ClosingDate)).Distinct().Count() == s.Payments.Count, "Aynı ekstre iki kez ödenemez.");
        Require((s.CashPayments??[]).Select(p=>(p.Kind,p.SourceId,p.DueDate)).Distinct().Count()==(s.CashPayments?.Count??0), "Aynı vade iki kez ödenemez.");
        if(errors.Count==0) {
            foreach(var p in s.Payments.Where(p=>p.Amount!=null)) {
                var statement=Calculator.Statements(s,p.ClosingDate.Year,p.ClosingDate.Month).First(x=>x.CardId==p.CardId);
                Require(statement.ClosingDate==p.ClosingDate && statement.Total==p.Amount, "Ödeme, ekstre toplamıyla uyuşmuyor. Bu sürüm tam ekstre ödemesi kaydeder; ödenmiş dönem kayıtlarını değiştiriyorsanız ödeme tutarını da kontrol edin.");
            }
            foreach(var p in s.CashPayments??[]) Require(Calculator.Dues(s,p.DueDate.Year).Any(d=>d.CardId==null && d.Kind==p.Kind && d.SourceId==p.SourceId && d.Date==p.DueDate && d.Amount==p.Amount),"Ödenmiş vadenin kaynağı/tutarı değiştirilemez. Önce ödeme kaydını düzeltin.");
        }
        Require(s.Expenses.Count + s.Incomes.Count + s.Installments.Count + s.Subscriptions.Count < 50000, "Kayıt sınırı aşıldı.");
        return errors;
    }

    private static bool HasMissingRecords<T>(List<T>? records) =>
        records is null || records.Any(record => record is null);
}
