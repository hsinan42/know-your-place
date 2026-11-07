using Finance;
var count=0;
void Check(bool condition,string name){if(!condition)throw new Exception(name);Console.WriteLine($"PASS {name}");count++;}
var card=new Card("c","Kart",17);
Check(Calculator.StatementDate(new(2026,10,17),card)==new DateOnly(2026,10,17),"Kesim günündeki işlem aynı döneme girer");
Check(Calculator.StatementDate(new(2026,10,18),card)==new DateOnly(2026,11,17),"Kesim sonrası işlem sonraki döneme girer");
Check(Calculator.StatementDate(new(2026,12,31),card)==new DateOnly(2027,1,17),"Yıl geçişi");
Check(Calculator.Closing(2028,2,31)==new DateOnly(2028,2,29),"Artık yıl");
var p=new Installment("p","Plan","Diğer",100,new(2026,10,21),1,0,"c");
var s=FinanceFixture.Empty with{Cards=[card],Installments=[p],Settings=new(1000,100,new(2026,9,1))};
Check(Calculator.Statements(s,2026,11)[0].Total==100,"Kesim sonrası tek taksit Kasım ekstresinde");
Check(Calculator.Statements(s,2026,12)[0].Total==0,"Son taksit sonraki ekstrede tekrar sayılmaz");
s=s with{Installments=[p with{Count=4,ManualPaid=1}],Payments=[new("paid","c",new(2026,12,17))]};
Check(Calculator.PaidCount(s,s.Installments[0])==2,"Manuel ilk taksit ile farklı ekstre ödemesi birleşir");
s=s with{Payments=[new("paid","c",new(2026,11,17))]};
Check(Calculator.PaidCount(s,s.Installments[0])==1,"Aynı taksit manuel ve ekstre yoluyla çift sayılmaz");
Check(Calculator.InstallmentDues(p with{FirstDate=new(2027,1,31),Count=3}).Last().Date==new DateOnly(2027,3,31),"Ay sonu tarih kayması birikmez");
s=s with{Subscriptions=[new("sub","Örnek abonelik","Film",370,23,new(2026,9,23))],Installments=[],Payments=[]};
Check(Calculator.Statements(s,2026,10)[0].Total==0,"Kartsız abonelik ekstreye girmez");
s=s with{Subscriptions=[s.Subscriptions[0] with{CardId="c"}]};
Check(Calculator.Statements(s,2026,10)[0].Total==370,"23 Eylül tahsilatı 17 Ekim ekstresine girer");
Check(Calculator.Statements(s,2026,9)[0].Total==0,"Başlangıçtan önce abonelik tahsilatı yok");
s=s with{Incomes=[new("advance",new(2026,11,1),"Avans","",500,true)]};
var m=Calculator.Month(s,2026,11,new(2026,11,7));
Check(m.EarnedIncome==0 && m.Borrowing==500 && m.Net==630,"Avans kazanılmış gelirden ayrıdır");
Check(m.ForecastExpense==4120,"İçinde bulunulan ayın bütçesi de tahmine girer");
Check(Calculator.Month(s,2026,8,new(2026,11,7)).SalaryPlan==0,"Takip öncesi ayda hayali maaş üretilmez");
s=s with{Payments=[new("paid","c",new(2026,11,17))]};
Check(Calculator.Month(s,2026,11,new(2026,11,7)).Expense==370,"Ekstre ödemesi ikinci harcama olmaz");
Check(Validation.Check(s with{Expenses=[new("bad",new(2026,11,1),"food","",10,"Kredi Kartı")]}).Count>0,"Kartsız kart harcaması reddedilir");
Check(Validation.Check(s with{Installments=[p with{Count=0}]}).Count>0,"Sıfır taksit adedi reddedilir");
Check(Validation.Check(s with{Cards=[]}).Count>0,"Bağlı kart silinemez");
var salaryState=s with { SalaryPeriods=[new(new(2026,9,1),1000),new(new(2026,11,1),2000)],Settings=s.Settings with{Salary=2000}};
Check(Calculator.Month(salaryState,2026,10,new(2026,11,7)).SalaryPlan==1000 && Calculator.Month(salaryState,2026,11,new(2026,11,7)).SalaryPlan==2000,"Maaş artışı geçmişi değiştirmez");
var subHistory=s with {Subscriptions=[new("old","Abone","",100,15,new(2026,9,1),new(2026,10,31)),new("new","Abone","",200,15,new(2026,11,1))]};
Check(Calculator.Month(subHistory,2026,10,new(2026,11,7)).Subscriptions==100 && Calculator.Month(subHistory,2026,11,new(2026,11,7)).Subscriptions==200,"Abonelik fiyat geçmişi dönemlere göre hesaplanır");
// Asset ledger starts from zero and never resets at a month/year boundary.
var ledger=FinanceFixture.Empty with {Settings=new(0,0,new(2026,1,1)),Categories=[new("food","Yemek",0)],
    Incomes=[new("old-income",new(2025,12,5),"Gelir","",1000)],Expenses=[new("cash",new(2026,1,10),"food","",100,"Nakit")]};
Check(Calculator.Balance(ledger,new(2026,1,31))==900,"Önceki yılın geliri takip başlangıcından eski olsa bile varlıktan kaybolmaz");
var yearLedger=Calculator.Year(ledger,2026,new(2026,2,15));
Check(yearLedger[0].OpeningBalance==1000 && yearLedger[0].ClosingBalance==900 && yearLedger[1].OpeningBalance==900,"Ay ve yıl değişiminde bakiye aynen devreder");
Check(yearLedger[0].PlanClosingBalance==900 && yearLedger[1].PlanOpeningBalance==900,"Varlık planı yılbaşında sıfırlanmaz");
var futureIncome=ledger with {Incomes=[..ledger.Incomes,new("future",new(2026,2,20),"Gelir","",300)]};
Check(Calculator.Balance(futureIncome,new(2026,2,15))==900,"Gelecek tarihli gelir henüz nakde eklenmez");
Check(Calculator.Balance(futureIncome,new(2026,2,21))==1200,"Gelir kendi tarihinde bakiyeye girer");
var salaryLedger=ledger with {Settings=new(5000,0,new(2026,1,1)),Expenses=[],Incomes=[]};
Check(Calculator.Balance(salaryLedger,new(2026,1,31))==0,"Planlanan maaş gerçekleşmiş varlık değildir");
salaryLedger=salaryLedger with {Incomes=[new("salary",new(2026,1,15),"Maaş","",5000)]};
var salaryMonth=Calculator.Month(salaryLedger,2026,1,new(2026,2,15));
Check(salaryMonth.SalaryReceived==5000 && salaryMonth.SalaryPlan==5000 && salaryMonth.EarnedIncome==0 && salaryMonth.Net==5000,"Gerçek maaş planla ikinci kez sayılmaz");
Check(Calculator.Balance(salaryLedger,new(2026,1,31))==5000,"Gerçekleşen maaş varlığı artırır");
var borrowedLedger=ledger with {Expenses=[],Incomes=[new("loan",new(2026,1,2),"Avans","",500,true)]};
Check(Calculator.Balance(borrowedLedger,new(2026,1,31))==500 && Calculator.Month(borrowedLedger,2026,1,new(2026,2,1)).EarnedIncome==0,"Borçlanma nakdi artırır ama kazanılmış gelir sayılmaz");
var cardLedger=ledger with {Cards=[card],Expenses=[new("card-expense",new(2026,1,10),"food","",100,"Kredi Kartı",CardId:"c")]};
Check(Calculator.Balance(cardLedger,new(2026,1,31))==1000 && Calculator.Assets(cardLedger,2026,1,new(2026,2,1)).CardDebt==100,"Kart alışverişi nakdi düşürmez, borcu artırır");
cardLedger=cardLedger with {Payments=[new("card-payment","c",new(2026,1,17),new(2026,2,3),100)]};
Check(Calculator.Balance(cardLedger,new(2026,1,31))==1000 && Calculator.Balance(cardLedger,new(2026,2,3))==900,"Kart ödemesi yalnızca ödeme tarihinde bir kez nakitten düşer");
Check(!Calculator.Statements(cardLedger,2026,1,new(2026,1,31))[0].Paid && Calculator.Assets(cardLedger,2026,2,new(2026,2,3)).CardDebt==0,"Gelecek ödeme geçmişte ödendi sayılmaz; ödeme borcu kapatır");
Check(Validation.Check(cardLedger).Count==0,"Tutarı yakalanan tam ekstre ödemesi geçerlidir");
Check(Validation.Check(cardLedger with{Payments=[cardLedger.Payments[0] with{Amount=50}]}).Count>0,"Kısmi tutar tam ödeme gibi işaretlenemez");
var direct=ledger with {Expenses=[],Subscriptions=[new("cash-sub","Abone","",100,15,new(2026,1,1))]};
Check(Calculator.Balance(direct,new(2026,1,31))==1000 && Calculator.Assets(direct,2026,1,new(2026,2,1)).UnpaidCashDues.Count==1,"Ödenmemiş kartsız abonelik nakdi düşürmez ve bekleyen listesinde görünür");
direct=direct with{CashPayments=[new("cash-paid","Abonelik","cash-sub",new(2026,1,15),new(2026,1,20),100)]};
Check(Calculator.Balance(direct,new(2026,1,31))==900 && Calculator.Assets(direct,2026,1,new(2026,2,1)).UnpaidCashDues.Count==0,"Nakit abonelik ödemesi tek hareketle varlıktan düşer");
Check(Validation.Check(direct).Count==0 && Validation.Check(direct with{CashPayments=[..direct.CashPayments!,direct.CashPayments![0] with{Id="duplicate"}]}).Count>0,"Aynı nakit vadesi iki kez ödenemez");
Check(Validation.Check(direct with{Subscriptions=[]}).Count>0,"Ödeme geçmişi olan kaynak silinip varlık hesabı bozulamaz");
var legacy=cardLedger with{Payments=[cardLedger.Payments[0] with{Amount=null,PaidOn=null}]};
Check(Calculator.Assets(legacy,2026,1,new(2026,2,1)).HasEstimatedPayments,"Eksik eski ödeme bilgileri tahmin olarak işaretlenir");
var futurePaid=ledger with {Cards=[card],Installments=[new("inst","Taksit","",100,new(2026,1,10),2,CardId:"c")],Payments=[new("later","c",new(2026,1,17),new(2026,2,5))]};
Check(Calculator.PaidCount(futurePaid,futurePaid.Installments[0],new(2026,1,31))==0 && Calculator.PaidCount(futurePaid,futurePaid.Installments[0],new(2026,2,5))==1,"Taksit borcu geçmiş tarihli raporda gelecek ödemeyle azalmaz");
var manual=ledger with{Expenses=[],Installments=[new("manual","Plan","",100,new(2026,1,10),2,1)],CashPayments=[new("manual-cash","Taksit","manual",new(2026,1,10),new(2026,1,10),100)]};
Check(Calculator.Balance(manual,new(2026,1,31))==900,"Manuel ödenmiş taksit nakit ödeme kaydıyla çift düşmez");
Check(Validation.Check(ledger with{Incomes=[new("invalid",new(2026,1,1),"Maaş","",100,true,true)]}).Count>0,"Maaş ve borçlanma aynı gelirde birlikte işaretlenemez");
var transfer=ledger with{Incomes=[..ledger.Incomes,new("transfer-in",new(2026,1,4),"Virman","",500,IsTransfer:true)],Expenses=[..ledger.Expenses,new("transfer-out",new(2026,1,4),"food","",500,"Havale/EFT",IsTransfer:true)]};
Check(Calculator.Balance(transfer,new(2026,1,31))==900 && Calculator.Month(transfer,2026,1,new(2026,2,1)).Daily==100,"Kendi hesapları arası transfer gelir, gider ve bütçeyi şişirmez");
var earlyManual=manual with{CashPayments=[manual.CashPayments![0] with{PaidOn=new(2026,2,10)}]};
Check(Calculator.PaidCount(earlyManual,earlyManual.Installments[0],new(2026,1,31))==0 && Calculator.Assets(earlyManual,2026,1,new(2026,2,1)).UnpaidCashDues.Count==1,"Gerçek ödeme tarihi biliniyorsa manuel varsayım geçmiş ödeme oluşturmaz ve vade bekler");
var manualCard=futurePaid with{Installments=[futurePaid.Installments[0] with{ManualPaid=1}]};
Check(Calculator.PaidCount(manualCard,manualCard.Installments[0],new(2026,1,31))==0,"Kartın bilinen ödeme tarihi manuel adet varsayımından önceliklidir");
var datedCard = card with { ClosingDay = 7, StatementDates = [new(new(2026, 10, 9), new(2026, 10, 19))] };
var trackedPlan = new Installment("tracked", "Plan", "", 120, new(2026, 10, 7), 3,
    CardId: datedCard.Id, FirstAmount: 119.99m, LastAmount: 120.02m);
var trackedState = FinanceFixture.Empty with
{
    Settings = FinanceFixture.Empty.Settings with { TrackingStart = new(2026, 10, 1) },
    Cards = [datedCard], Installments = [trackedPlan]
};
var octoberStatement = Calculator.Statements(trackedState, 2026, 10)[0];
Check(octoberStatement.ClosingDate == new DateOnly(2026, 10, 9) && octoberStatement.DueDate == new DateOnly(2026, 10, 19)
    && Calculator.StatementDate(new(2026, 10, 9), datedCard) == octoberStatement.ClosingDate
    && Calculator.StatementDate(new(2026, 10, 10), datedCard) == new DateOnly(2026, 11, 7),
    "Kesim ve vade istisnası yalnızca doğrulanan ekstre dönemine uygulanır");
var september = Calculator.Month(trackedState, 2026, 9, new(2026, 11, 1));
Check(Calculator.Progress(trackedState, trackedPlan, new(2026, 9, 30)) == new InstallmentProgress(0, 3, 360.01m, new(new(2026, 10, 19), 119.99m))
    && september.Expense == 0 && september.Budget == 0 && september.SavingsTarget == 0
    && Calculator.Balance(trackedState, new(2026, 9, 30)) == 0,
    "Takip öncesi dönem gider, ödeme, bütçe veya tasarruf hedefi üretmez");
var trackedPaid = trackedState with { Payments = [new("recorded", datedCard.Id, octoberStatement.ClosingDate, new(2026, 10, 19), 119.99m)] };
Check(Validation.Check(trackedPaid).Count == 0
    && Calculator.Progress(trackedPaid, trackedPlan, new(2026, 11, 1)) == new InstallmentProgress(1, 2, 240.02m, new(new(2026, 11, 17), 120m)),
    "Farklı ilk ve son taksit tutarları ekstreye ve kalan borca doğru yansır");
var agendaState = FinanceFixture.Empty with
{
    Cards = [datedCard],
    Expenses = [
        new("recorded-charge", new(2026, 10, 7), "food", "", 20, "Kredi Kartı", CardId: card.Id),
        new("overdue-charge", new(2026, 11, 7), "food", "", 30, "Kredi Kartı", CardId: card.Id),
        new("dec-charge", new(2026, 12, 24), "food", "", 100, "Kredi Kartı", CardId: card.Id),
        new("jan-charge", new(2027, 1, 7), "food", "", 50, "Kredi Kartı", CardId: card.Id),
    ],
    Subscriptions = [new("cash-sub", "Abonelik", "", 40, 3, new(2026, 12, 1))],
    Installments = [new("cash-plan", "Taksit", "", 60, new(2026, 12, 20), 2, ManualPaid: 1, LastAmount: 59.99m)],
    Payments = [new("recorded-statement", card.Id, new(2026, 10, 9), new(2026, 12, 28), 20)],
    CashPayments = [new("recorded-cash", "Abonelik", "cash-sub", new(2026, 12, 3), new(2026, 12, 28), 40)],
};
var agenda = Calculator.UpcomingPayments(agendaState, new(2026, 12, 27));
Check(agenda.Statements.Select(statement => (statement.DueDate, statement.Total)).SequenceEqual(
    new[] { (new DateOnly(2026, 11, 17), 30m), (new DateOnly(2027, 1, 17), 150m) }),
    "Ödeme listesi gecikmiş ve yıl devreden ekstreleri toplar, kayıtlı ödemeleri çıkarır");
Check(agenda.CashDues.Select(due => (due.Date, due.Amount)).SequenceEqual(
    new[] { (new DateOnly(2027, 1, 3), 40m), (new DateOnly(2027, 1, 20), 59.99m) })
    && Calculator.Progress(agendaState, agendaState.Installments[0], new(2026, 12, 27)).NextDue == new InstallmentDue(new(2027, 1, 20), 59.99m),
    "Ödeme listesi ve sıradaki taksit kayıtlı veya eskiden ödenmiş vadeleri tekrarlamaz");
Console.WriteLine($"{count} checks passed.");
