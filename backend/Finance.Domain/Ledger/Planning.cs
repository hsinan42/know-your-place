namespace Finance;

public record Settings(decimal Salary = 0, decimal SavingsTarget = 0, DateOnly TrackingStart = default);
public record SalaryPeriod(DateOnly Start, decimal Amount);
public record Category(string Id, string Name, decimal MonthlyLimit);
