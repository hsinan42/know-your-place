namespace Finance;

public static class Calculator
{
    public static DateOnly Closing(int year, int month, int day) => new(year, month, Math.Min(day, DateTime.DaysInMonth(year, month)));
    private static StatementDates CardDates(int year, int month, Card card)
    {
        var exact = card.StatementDates?.FirstOrDefault(dates => dates.ClosingDate.Year == year && dates.ClosingDate.Month == month);
        if (exact is not null) return exact;
        var closing = Closing(year, month, card.ClosingDay);
        return new(closing, closing.AddDays(card.DueDays));
    }

    public static DateOnly StatementDate(DateOnly date, Card card)
    {
        var closing = CardDates(date.Year, date.Month, card).ClosingDate;
        var next = new DateOnly(date.Year, date.Month, 1).AddMonths(1);
        return date <= closing ? closing : CardDates(next.Year, next.Month, card).ClosingDate;
    }
    // Generate each installment independently from the original date: Jan 31 -> Feb 28 -> Mar 31.
    public static IEnumerable<Due> InstallmentDues(Installment p) => Enumerable.Range(0, p.Count)
        .Select(i => new Due(p.Id, p.Name, "Taksit", p.FirstDate.AddMonths(i),
            (i == 0 ? p.FirstAmount : null) ?? (i == p.Count - 1 ? p.LastAmount : null) ?? p.Amount, p.CardId, i + 1));
    public static IEnumerable<Due> Dues(FinanceState s, int year)
    {
        foreach (var e in s.Expenses.Where(x => x.Date.Year == year && !x.IsTransfer))
            yield return new(e.Id, string.IsNullOrWhiteSpace(e.Description) ? "Harcama" : e.Description, "Harcama", e.Date, e.Amount, e.CardId);
        foreach (var p in s.Installments)
            foreach (var d in InstallmentDues(p).Where(d => d.Date.Year == year)) yield return d;
        foreach (var p in s.Subscriptions)
            for (var m = 1; m <= 12; m++)
            {
                var date = Closing(year, m, p.PaymentDay);
                if (date >= p.Start && (p.End is null || date <= p.End))
                    yield return new(p.Id, p.Name, "Abonelik", date, p.Amount, p.CardId);
            }
    }
    public static bool IsSalary(Income i) => !i.IsBorrowing && (i.IsSalary || i.Type.Trim().Equals("Maaş", StringComparison.OrdinalIgnoreCase) || i.Type.Trim().Equals("Maas", StringComparison.OrdinalIgnoreCase));
    public static int PaidCount(FinanceState s, Installment p, DateOnly? asOf = null) => Progress(s, p, asOf).Paid;

    public static InstallmentProgress Progress(FinanceState s, Installment p, DateOnly? asOf = null)
    {
        var cutoff=asOf??DateOnly.MaxValue;
        var card = s.Cards.FirstOrDefault(c => c.Id == p.CardId);
        var remaining = 0;
        var debt = 0m;
        InstallmentDue? nextDue = null;
        foreach (var due in InstallmentDues(p))
        {
            var closing = card is null ? due.Date : StatementDate(due.Date, card);
            var cashPayment = s.CashPayments?.FirstOrDefault(x => x.Kind == "Taksit" && x.SourceId == p.Id && x.DueDate == due.Date);
            var cardPayment = card is null ? null : s.Payments.FirstOrDefault(x => x.CardId == card.Id && x.ClosingDate == closing);
            var paid = cashPayment?.PaidOn <= cutoff || (cardPayment?.PaidOn ?? cardPayment?.ClosingDate) <= cutoff
                || (cashPayment is null && cardPayment is null && due.Sequence <= p.ManualPaid && due.Date <= cutoff);
            if (paid) continue;
            remaining++;
            debt += due.Amount;
            var paymentDate = card is null ? due.Date : CardDates(closing.Year, closing.Month, card).DueDate;
            if (nextDue is null || paymentDate < nextDue.Date) nextDue = new(paymentDate, due.Amount);
        }
        return new(p.Count - remaining, remaining, debt, nextDue);
    }
    public static MonthReport Month(FinanceState s, int year, int month, DateOnly today)
    {
        var date = new DateOnly(year, month, 1);
        var tracked = date.AddMonths(1) > s.Settings.TrackingStart;
        var dues = Dues(s, year).Where(x => x.Date.Month == month).ToList();
        var salary = tracked ? s.SalaryPeriods?.Where(p=>p.Start<=date).OrderByDescending(p=>p.Start).FirstOrDefault()?.Amount ?? s.Settings.Salary : 0;
        var incomes=s.Incomes.Where(x=>x.Date.Year==year && x.Date.Month==month && !x.IsTransfer).ToList();
        var salaryReceived=incomes.Where(IsSalary).Sum(x=>x.Amount);
        salary=Math.Max(salary,salaryReceived);
        var earned = incomes.Where(x=>!x.IsBorrowing && !IsSalary(x)).Sum(x => x.Amount);
        var borrowed = incomes.Where(x=>x.IsBorrowing).Sum(x => x.Amount);
        decimal Sum(string kind) => dues.Where(x => x.Kind == kind).Sum(x => x.Amount);
        var daily = Sum("Harcama"); var subs = Sum("Abonelik"); var installments = Sum("Taksit");
        var budget = s.Categories.Sum(x => x.MonthlyLimit);
        // Current month also needs a remaining-month budget; browsing history never changes forecasting.
        var forecastDaily = tracked && date.AddMonths(1) > today ? Math.Max(daily, budget) : daily;
        var expense = daily + subs + installments; var forecast = forecastDaily + subs + installments;
        return new(month, salary, earned, borrowed, daily, subs, installments, expense,
            salary + earned - expense, forecast, salary + earned + borrowed - forecast,
            tracked ? s.Settings.SavingsTarget : 0, tracked ? budget : 0, tracked ? budget - daily : 0,
            salary + earned == 0 ? null : (salary + earned - expense) / (salary + earned), tracked, salaryReceived);
    }
    public static List<Statement> Statements(FinanceState s, int year, int month, DateOnly? asOf = null)
    {
        // Previous December is required for January statements.
        var dues = Dues(s, year - 1).Concat(Dues(s, year)).ToList();
        return s.Cards.Select(card => {
            var (close, due) = CardDates(year, month, card);
            var items = dues.Where(x => x.CardId == card.Id && StatementDate(x.Date, card) == close).ToList();
            return new Statement(card.Id, card.Name, close, due, items.Sum(x => x.Amount),
                s.Payments.Any(x => x.CardId == card.Id && x.ClosingDate == close && (x.PaidOn??x.ClosingDate)<=(asOf??DateOnly.MaxValue)), items);
        }).ToList();
    }

    public static DateOnly AsOf(int year,int month,DateOnly today)
    {
        var end=new DateOnly(year,month,DateTime.DaysInMonth(year,month));
        return end<today?end:today;
    }

    private static IEnumerable<Due> DuesThrough(FinanceState state, DateOnly through)
    {
        var start = state.Settings.TrackingStart.Year;
        var firstYear = new[]
        {
            start,
            state.Expenses.Select(expense => expense.Date.Year).DefaultIfEmpty(start).Min(),
            state.Installments.Select(plan => plan.FirstDate.Year).DefaultIfEmpty(start).Min(),
            state.Subscriptions.Select(plan => plan.Start.Year).DefaultIfEmpty(start).Min()
        }.Min();
        return Enumerable.Range(firstYear, Math.Max(0, through.Year - firstYear + 1))
            .SelectMany(year => Dues(state, year)).Where(due => due.Date <= through);
    }

    private static bool CashDueIsPending(Due due, FinanceState state, DateOnly paymentCutoff)
    {
        if (due.CardId is not null || due.Kind == "Harcama") return false;
        var payment = state.CashPayments?.FirstOrDefault(p => p.Kind == due.Kind && p.SourceId == due.SourceId && p.DueDate == due.Date);
        if (payment is not null) return payment.PaidOn > paymentCutoff;
        return due.Kind != "Taksit" || due.Sequence > state.Installments.First(p => p.Id == due.SourceId).ManualPaid;
    }

    public static PaymentAgenda UpcomingPayments(FinanceState state, DateOnly today)
    {
        var through = today.AddDays(30);
        var dues = DuesThrough(state, through).ToList();
        var cards = state.Cards.ToDictionary(card => card.Id);
        var recorded = state.Payments.Select(payment => (payment.CardId, payment.ClosingDate)).ToHashSet();
        var statements = dues.Where(due => due.CardId is not null)
            .GroupBy(due =>
            {
                var card = cards[due.CardId!];
                return (Card: card, Closing: StatementDate(due.Date, card));
            })
            .Where(group => !recorded.Contains((group.Key.Card.Id, group.Key.Closing)))
            .Select(group =>
            {
                var (card, closing) = group.Key;
                var dueDate = CardDates(closing.Year, closing.Month, card).DueDate;
                return new StatementPayment(card.Id, card.Name, closing, dueDate, group.Sum(due => due.Amount));
            })
            .Where(statement => statement.DueDate <= through && statement.Total > 0)
            .OrderBy(statement => statement.DueDate)
            .ToList();
        var cash = dues.Where(due => CashDueIsPending(due, state, DateOnly.MaxValue)).OrderBy(due => due.Date).ToList();
        return new(today, through, statements, cash);
    }
    public static IEnumerable<(DateOnly Date,decimal Amount)> CashLedger(FinanceState s)
    {
        foreach(var i in s.Incomes.Where(x=>!x.IsTransfer)) yield return (i.Date,i.Amount);
        foreach(var e in s.Expenses.Where(x=>x.CardId==null && !x.IsTransfer)) yield return(e.Date,-e.Amount);
        foreach(var p in s.CashPayments??[]) yield return(p.PaidOn,-p.Amount);
        foreach(var p in s.Installments.Where(p=>p.CardId==null && p.ManualPaid>0))
            foreach(var d in InstallmentDues(p).Where(d=>d.Sequence<=p.ManualPaid && !(s.CashPayments??[]).Any(x=>x.Kind=="Taksit" && x.SourceId==p.Id && x.DueDate==d.Date)))
                yield return(d.Date,-d.Amount);
        foreach(var p in s.Payments) {
            // Imported checkbox records have no captured amount/date: show the estimate explicitly.
            var amount=p.Amount??Statements(s,p.ClosingDate.Year,p.ClosingDate.Month).First(x=>x.CardId==p.CardId).Total;
            yield return(p.PaidOn??p.ClosingDate,-amount);
        }
    }
    public static decimal Balance(FinanceState s,DateOnly asOf) => CashLedger(s)
        .Where(x=>x.Date<=asOf).Sum(x=>x.Amount);

    public static List<MonthReport> Year(FinanceState s,int year,DateOnly today)
    {
        var result=new List<MonthReport>();
        var planBalance=0m;
        var firstRecord=new[]{s.Settings.TrackingStart,s.Incomes.Select(x=>x.Date).DefaultIfEmpty(s.Settings.TrackingStart).Min(),s.Expenses.Select(x=>x.Date).DefaultIfEmpty(s.Settings.TrackingStart).Min(),s.Installments.Select(x=>x.FirstDate).DefaultIfEmpty(s.Settings.TrackingStart).Min(),s.Subscriptions.Select(x=>x.Start).DefaultIfEmpty(s.Settings.TrackingStart).Min()}.Min();
        var baseline=new DateOnly(firstRecord.Year,firstRecord.Month,1);
        var first=baseline<new DateOnly(year,1,1)?baseline:new DateOnly(year,1,1);
        for(var date=first;date<=new DateOnly(year,12,1);date=date.AddMonths(1)) {
            var m=Month(s,date.Year,date.Month,today);
            var opening=planBalance;
            if(date>=baseline)planBalance+=m.ForecastNet;
            if(date.Year!=year)continue;
            var cutoff=AsOf(year,date.Month,today);
            var before=date.AddDays(-1);
            // Future months have no realized changes yet; they carry today's recorded cash.
            if(before>today)before=today;
            var ledger=CashLedger(s).Where(x=>x.Date>=date && x.Date<=cutoff).ToList();
            result.Add(m with {OpeningBalance=Balance(s,before),ClosingBalance=Balance(s,cutoff),
                CashIncome=ledger.Where(x=>x.Amount>0).Sum(x=>x.Amount),CashOutflow=-ledger.Where(x=>x.Amount<0).Sum(x=>x.Amount),
                PlanOpeningBalance=opening,PlanClosingBalance=planBalance});
        }
        return result;
    }
    public static IEnumerable<Due> PendingCashDues(FinanceState state, DateOnly cutoff) =>
        DuesThrough(state, cutoff).Where(due => CashDueIsPending(due, state, cutoff));

    public static AssetSummary Assets(FinanceState s,int year,int month,DateOnly today,List<MonthReport>? months=null)
    {
        var cutoff=AsOf(year,month,today);
        var dues=DuesThrough(s,cutoff).ToList();
        var debt=dues.Where(d=>d.CardId!=null).GroupBy(d=>(d.CardId,Closing:StatementDate(d.Date,s.Cards.First(c=>c.Id==d.CardId)))).Sum(g=> {
            var paid=s.Payments.Where(p=>p.CardId==g.Key.CardId && p.ClosingDate==g.Key.Closing && (p.PaidOn??p.ClosingDate)<=cutoff).Sum(p=>p.Amount??Statements(s,p.ClosingDate.Year,p.ClosingDate.Month).First(x=>x.CardId==p.CardId).Total);
            return Math.Max(0,g.Sum(d=>d.Amount)-paid);
        });
        var unpaid=dues.Where(d=>CashDueIsPending(d,s,cutoff)).OrderBy(d=>d.Date).ToList();
        return new(cutoff,Balance(s,cutoff),debt,(months??Year(s,year,today)).Last().PlanClosingBalance,
            s.Payments.Any(p=>(p.Amount==null || p.PaidOn==null) && (p.PaidOn??p.ClosingDate)<=cutoff) ||
            s.Installments.Any(p=>p.ManualPaid>0 && p.FirstDate<=cutoff),unpaid);
    }
}
